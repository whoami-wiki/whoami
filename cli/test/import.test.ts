import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseDump } from '../src/commands/import.js';
import { importCommand } from '../src/commands/import.js';
import type { WikiClient } from '../src/wiki-client.js';

// ── Helpers ───────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface TestPage {
  title: string;
  ns?: number;
  revisions: string[];
}

function writeDump(dir: string, pages: TestPage[]): string {
  const path = join(dir, 'dump.xml');
  let xml = '<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/">\n';
  xml += '  <siteinfo><sitename>Test</sitename></siteinfo>\n';
  for (const p of pages) {
    xml += `  <page>\n`;
    xml += `    <title>${escapeXml(p.title)}</title>\n`;
    xml += `    <ns>${p.ns ?? 0}</ns>\n`;
    xml += `    <id>1</id>\n`;
    for (const text of p.revisions) {
      xml += `    <revision>\n`;
      xml += `      <id>1</id>\n`;
      xml += `      <text xml:space="preserve">${escapeXml(text)}</text>\n`;
      xml += `    </revision>\n`;
    }
    xml += `  </page>\n`;
  }
  xml += '</mediawiki>\n';
  writeFileSync(path, xml);
  return path;
}

function mockClient(overrides: Partial<Record<keyof WikiClient, any>> = {}): WikiClient {
  return {
    importPage: async () => ({ title: '', oldRevid: 0, newRevid: 1, timestamp: '' }),
    ...overrides,
  } as unknown as WikiClient;
}

// ── parseDump ─────────────────────────────────────────────────────────

describe('parseDump', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wai-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true });
  });

  it('parses single-revision pages', () => {
    const path = writeDump(tmp, [
      { title: 'Page One', revisions: ['Hello world'] },
      { title: 'Page Two', revisions: ['Goodbye world'] },
    ]);
    const pages = parseDump(path);
    assert.equal(pages.length, 2);
    assert.equal(pages[0].title, 'Page One');
    assert.equal(pages[0].text, 'Hello world');
    assert.equal(pages[1].title, 'Page Two');
    assert.equal(pages[1].text, 'Goodbye world');
  });

  it('takes last revision when multiple exist', () => {
    const path = writeDump(tmp, [
      { title: 'Multi', revisions: ['first', 'second', 'third'] },
    ]);
    const pages = parseDump(path);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].text, 'third');
  });

  it('parses namespace numbers', () => {
    const path = writeDump(tmp, [
      { title: 'Main', ns: 0, revisions: ['main content'] },
      { title: 'Talk:Main', ns: 1, revisions: ['talk content'] },
      { title: 'Template:Infobox', ns: 10, revisions: ['template'] },
    ]);
    const pages = parseDump(path);
    assert.equal(pages[0].ns, 0);
    assert.equal(pages[1].ns, 1);
    assert.equal(pages[2].ns, 10);
  });

  it('handles empty text', () => {
    const path = writeDump(tmp, [
      { title: 'Empty', revisions: [''] },
    ]);
    const pages = parseDump(path);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].text, '');
  });

  it('preserves wikitext markup', () => {
    const wikitext = "'''Bold''' and [[Link|display]] and {{Template|arg=val}}";
    const path = writeDump(tmp, [
      { title: 'Markup', revisions: [wikitext] },
    ]);
    const pages = parseDump(path);
    assert.equal(pages[0].text, wikitext);
  });

  it('handles special characters', () => {
    const path = writeDump(tmp, [
      { title: "L'nee Golay", revisions: ['Text with "quotes" & ampersands'] },
    ]);
    const pages = parseDump(path);
    assert.equal(pages[0].title, "L'nee Golay");
    assert.equal(pages[0].text, 'Text with "quotes" & ampersands');
  });

  it('throws on missing file', () => {
    assert.throws(() => parseDump('/nonexistent/path.xml'), /Cannot read file/);
  });

  it('returns empty array for empty dump', () => {
    const path = join(tmp, 'empty.xml');
    writeFileSync(path, '<mediawiki></mediawiki>');
    const pages = parseDump(path);
    assert.equal(pages.length, 0);
  });
});

// ── importCommand ─────────────────────────────────────────────────────

describe('importCommand', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wai-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true });
  });

  it('throws UsageError when no file given', async () => {
    await assert.rejects(
      () => importCommand([], { json: false, quiet: false }, mockClient()),
      { name: 'UsageError' },
    );
  });

  it('dry run lists pages without calling importPage', async () => {
    const path = writeDump(tmp, [
      { title: 'Page A', ns: 0, revisions: ['content a'] },
      { title: 'Page B', ns: 0, revisions: ['content b'] },
    ]);
    let called = false;
    const client = mockClient({
      importPage: async () => { called = true; },
    });

    await importCommand([path, '--dry-run'], { json: false, quiet: true }, client);
    assert.equal(called, false);
  });

  it('namespace filter restricts pages', async () => {
    const path = writeDump(tmp, [
      { title: 'Main Page', ns: 0, revisions: ['main'] },
      { title: 'Talk:Main Page', ns: 1, revisions: ['talk'] },
      { title: 'Template:Foo', ns: 10, revisions: ['tmpl'] },
    ]);
    const imported: string[] = [];
    const client = mockClient({
      importPage: async (title: string) => {
        imported.push(title);
        return { title, oldRevid: 0, newRevid: 1, timestamp: '' };
      },
    });

    await importCommand([path, '--ns', '0'], { json: false, quiet: true }, client);
    assert.deepEqual(imported, ['Main Page']);
  });

  it('calls importPage with correct summary', async () => {
    const path = writeDump(tmp, [
      { title: 'Test', revisions: ['content'] },
    ]);
    let receivedSummary = '';
    const client = mockClient({
      importPage: async (_t: string, _c: string, summary: string) => {
        receivedSummary = summary;
        return { title: _t, oldRevid: 0, newRevid: 1, timestamp: '' };
      },
    });

    await importCommand([path, '-m', 'Custom summary'], { json: false, quiet: true }, client);
    assert.equal(receivedSummary, 'Custom summary');
  });

  it('continues on error and sets exit code', async () => {
    const path = writeDump(tmp, [
      { title: 'Good', revisions: ['ok'] },
      { title: 'Bad', revisions: ['fail'] },
      { title: 'Also Good', revisions: ['ok'] },
    ]);
    const imported: string[] = [];
    const client = mockClient({
      importPage: async (title: string) => {
        if (title === 'Bad') throw new Error('API error');
        imported.push(title);
        return { title, oldRevid: 0, newRevid: 1, timestamp: '' };
      },
    });

    const origExitCode = process.exitCode;
    await importCommand([path], { json: false, quiet: true }, client);
    assert.deepEqual(imported, ['Good', 'Also Good']);
    assert.equal(process.exitCode, 1);
    process.exitCode = origExitCode;
  });
});
