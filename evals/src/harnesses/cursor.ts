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

Source directories to ingest:
${sources}

Wiki URL: ${wikiUrl}

Instructions:
1. Snapshot each source directory using \`wai snapshot <dir>\`
2. Read the ingested source pages using \`wai source list\` and \`wai read\`
3. Extract facts from the source data
4. Write a well-structured wikitext page following editorial standards
5. Include proper citations using {{Cite ...}} templates
6. Create the page using \`wai create\` or \`wai write\`

Return the final wikitext of the page you created.`;
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
