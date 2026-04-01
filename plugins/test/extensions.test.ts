import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Paths ──────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_ROOT = resolve(__dirname, '..');
const WHOAMI_PLUGIN = join(PLUGINS_ROOT, 'whoami');

// ── Known wai subcommands (from `wai --help`) ─────────────────────────

const KNOWN_COMMANDS = new Set([
  'read', 'write', 'edit', 'create', 'search', 'upload',
  'section', 'talk', 'task', 'link', 'category', 'changes',
  'source', 'snapshot', 'export', 'import', 'auth', 'update',
  'place',
]);

// ── Helpers ────────────────────────────────────────────────────────────

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractWaiCommands(content: string): string[] {
  const commands: string[] = [];
  // Match `wai <command>` patterns in code blocks and inline code
  const regex = /\bwai\s+([a-z][\w-]*)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    commands.push(match[1]);
  }
  return commands;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('Claude Code plugin structure', () => {
  it('CLAUDE.md exists at plugin root', () => {
    assert.ok(existsSync(join(WHOAMI_PLUGIN, 'CLAUDE.md')));
  });

  it('skills directory exists', () => {
    assert.ok(existsSync(join(WHOAMI_PLUGIN, 'skills')));
  });

  it('agents directory exists', () => {
    assert.ok(existsSync(join(WHOAMI_PLUGIN, 'agents')));
  });

  it('CLAUDE.md is non-empty', () => {
    const content = readFileSync(join(WHOAMI_PLUGIN, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.length > 0);
  });
});

describe('SKILL.md files', () => {
  const skillFiles = findMarkdownFiles(join(WHOAMI_PLUGIN, 'skills'))
    .filter(f => f.endsWith('SKILL.md'));

  it('at least one SKILL.md exists', () => {
    assert.ok(skillFiles.length > 0, 'Expected at least one SKILL.md file');
  });

  for (const file of skillFiles) {
    const relative = file.slice(WHOAMI_PLUGIN.length + 1);

    it(`${relative} has valid YAML frontmatter`, () => {
      const content = readFileSync(file, 'utf-8');
      assert.ok(content.startsWith('---'), `${relative} should start with YAML frontmatter`);
      const endIdx = content.indexOf('---', 3);
      assert.ok(endIdx > 3, `${relative} should have closing frontmatter delimiter`);

      const frontmatter = content.slice(3, endIdx);
      assert.ok(frontmatter.includes('name:'), `${relative} frontmatter should have 'name' field`);
      assert.ok(frontmatter.includes('description:'), `${relative} frontmatter should have 'description' field`);
    });

    it(`${relative} is valid markdown (non-empty body)`, () => {
      const content = readFileSync(file, 'utf-8');
      const endIdx = content.indexOf('---', 3);
      const body = content.slice(endIdx + 3).trim();
      assert.ok(body.length > 0, `${relative} should have content after frontmatter`);
    });
  }
});

describe('Agent definition files', () => {
  const agentDir = join(WHOAMI_PLUGIN, 'agents');

  it('at least one agent definition exists', () => {
    const files = existsSync(agentDir)
      ? readdirSync(agentDir).filter(f => f.endsWith('.md'))
      : [];
    assert.ok(files.length > 0, 'Expected at least one agent definition');
  });

  if (existsSync(agentDir)) {
    for (const file of readdirSync(agentDir).filter(f => f.endsWith('.md'))) {
      it(`agents/${file} has valid YAML frontmatter`, () => {
        const content = readFileSync(join(agentDir, file), 'utf-8');
        assert.ok(content.startsWith('---'), `agents/${file} should start with YAML frontmatter`);
        const endIdx = content.indexOf('---', 3);
        assert.ok(endIdx > 3, `agents/${file} should have closing frontmatter delimiter`);

        const frontmatter = content.slice(3, endIdx);
        assert.ok(frontmatter.includes('name:'), `agents/${file} frontmatter should have 'name' field`);
        assert.ok(frontmatter.includes('description:'), `agents/${file} frontmatter should have 'description' field`);
      });
    }
  }
});

describe('wai commands referenced in plugin docs', () => {
  const allMarkdown = findMarkdownFiles(WHOAMI_PLUGIN);

  it('all referenced wai commands are valid subcommands', () => {
    const invalidRefs: string[] = [];

    for (const file of allMarkdown) {
      const content = readFileSync(file, 'utf-8');
      const commands = extractWaiCommands(content);
      const relative = file.slice(WHOAMI_PLUGIN.length + 1);

      for (const cmd of commands) {
        if (!KNOWN_COMMANDS.has(cmd)) {
          invalidRefs.push(`${relative}: wai ${cmd}`);
        }
      }
    }

    assert.equal(
      invalidRefs.length,
      0,
      `Found references to unknown wai commands:\n${invalidRefs.join('\n')}`,
    );
  });
});
