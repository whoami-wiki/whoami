import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Harness, HarnessResult, HarnessRunOptions } from './types.js';
import type { TestCase } from '../types.js';
import { buildSourcePrompt, buildContentPrompt, buildCheckpointPrompt } from './prompts.js';

function buildPrompt(task: TestCase, wikiUrl: string): string {
  const sources = task.sources
    .map((s) => `- ${s.path}`)
    .join('\n');

  return `You are writing a ${task.pageType} page for whoami.wiki.

Task: ${task.description}

Source directories (already pre-staged into the vault by the runner):
${sources}

Wiki URL: ${wikiUrl}

Instructions:
1. Sources are pre-snapshotted by the runner — citation hashes already resolve. List source-prefixed pages with \`wai search source\`, then read each via \`wai read source-<name>\`.
2. Extract facts from the source data (use \`jq\` / \`sqlite3\` against vault objects, per the source pages).
3. Write a well-structured markdown page using:
   - \`## Heading\` / \`### Subheading\` (NOT \`==Heading==\`)
   - \`**bold**\` / \`*italic*\`
   - \`[[Page]]\` wiki links (preserved as-is)
   - \`![caption](/assets/path)\` for media
   - Footnotes \`text[^id]\` with bodies \`[^id]: source\`
4. Cite with leaf directives (single colon-pair, single line): \`::cite-message{snapshot=H date=YYYY-MM-DD ...}\`, \`::cite-vault{snapshot=H}\`, \`::cite-voice-note{speaker="X" ...}\`, \`::cite-testimony{speaker="X" date=D}\`.
   Use container directives (triple-colon, body on subsequent lines, closed by \`:::\` on its own line) for \`:::blockquote{by="..."}\`, \`:::dialogue{speaker="..."}\`, \`:::infobox-person\`. The one-line \`:::name{...}:::\` form does NOT parse.
5. Create/update the page via \`wai create <slug> --summary "<msg>" --stdin\` (or \`--file <path>\`) / \`wai write <slug> --summary "<msg>" --stdin\`. Slugs are lowercase-hyphenated (e.g. "Steven Barash" → \`steven-barash\`).

Return the final markdown of the page you created.`;
}

export function createCursorHarness(model?: string): Harness {
  return {
    name: 'cursor',
    async run(task: TestCase, env: Record<string, string | undefined>, options?: HarnessRunOptions): Promise<HarnessResult> {
      const wikiUrl = env['WIKI_SERVER'] ?? 'http://localhost:8081';

      let prompt: string;
      if (options?.checkpoint) {
        prompt = buildCheckpointPrompt(task, wikiUrl, options.checkpoint, options.checkpointIndex ?? 0, options.priorPages ?? [], options.ownerInput);
      } else {
        switch (options?.phase) {
          case 'source':
            prompt = buildSourcePrompt(task, wikiUrl);
            break;
          case 'content':
            prompt = buildContentPrompt(task, wikiUrl);
            break;
          default:
            prompt = buildPrompt(task, wikiUrl);
            break;
        }
      }

      const resumeSessionId = options?.sessionId;

      // cursor-agent -p --force --output-format stream-json [--model <m>] [--resume <id>] <prompt>
      const args: string[] = [
        '-p',
        '--force',
        '--output-format', 'stream-json',
      ];

      if (resumeSessionId) {
        args.push('--resume', resumeSessionId);
      }

      if (model) {
        args.push('--model', model);
      }

      args.push(prompt);

      const timeoutMs = options?.timeoutMs ?? 45 * 60 * 1000;

      return new Promise((resolve, reject) => {
        const cwd = options?.cwd ?? mkdtempSync(join(tmpdir(), 'whoami-eval-harness-'));
        const proc = spawn('cursor-agent', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd,
          env,
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;

        const timer = setTimeout(() => {
          timedOut = true;
          proc.kill('SIGTERM');
          setTimeout(() => proc.kill('SIGKILL'), 10_000);
        }, timeoutMs);

        proc.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on('close', (code) => {
          clearTimeout(timer);
          // Extract chatId and model from NDJSON stream
          let sessionId: string | undefined;
          let resolvedModel: string | undefined;
          for (const line of stdout.split('\n')) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.chatId && !sessionId) {
                sessionId = event.chatId;
              }
              if (event.model && !resolvedModel) {
                resolvedModel = event.model;
              }
            } catch {
              // Not JSON, skip
            }
          }
          if (!resolvedModel && model) {
            resolvedModel = model;
          }

          if (timedOut) {
            resolve({ output: '', log: stdout + '\n[TIMEOUT] Agent killed after ' + (timeoutMs / 1000) + 's', model: resolvedModel, sessionId, cwd });
          } else if (code !== 0) {
            reject(new Error(`cursor-agent exited with code ${code}: ${stderr}`));
          } else {
            resolve({ output: '', log: stdout, model: resolvedModel, sessionId, cwd });
          }
        });

        proc.on('error', (err) => {
          clearTimeout(timer);
          reject(new Error(`Failed to spawn cursor-agent: ${err.message}`));
        });
      });
    },
  };
}
