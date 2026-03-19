import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
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

export function createClaudeCodeHarness(model?: string): Harness {
  return {
    name: 'claude-code',
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
      const sessionId = resumeSessionId ?? randomUUID();

      const args: string[] = [];

      if (resumeSessionId) {
        // Resume existing session: --resume <id> sends the prompt as a new message
        args.push('--resume', resumeSessionId, '-p', prompt);
      } else {
        // Fresh session: use --session-id so we can resume later
        args.push('-p', prompt, '--session-id', sessionId);
      }

      args.push(
        '--dangerously-skip-permissions',
        '--verbose',
        '--output-format', 'stream-json',
      );

      if (model) {
        args.push('--model', model);
      }

      const timeoutMs = options?.timeoutMs ?? 45 * 60 * 1000; // default 45 minutes

      return new Promise((resolve, reject) => {
        // Reuse working directory when resuming so the agent can see files it created
        const cwd = options?.cwd ?? mkdtempSync(join(tmpdir(), 'whoami-eval-harness-'));
        const proc = spawn('claude', args, {
          stdio: ['ignore', 'pipe', 'inherit'],
          cwd,
          env,
        });

        let stdout = '';
        let resolved = false;
        let resolvedModel: string | undefined;

        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            proc.kill('SIGTERM');
            setTimeout(() => proc.kill('SIGKILL'), 10_000);
            resolve({ output: '', log: stdout + '\n[TIMEOUT] Agent killed after ' + (timeoutMs / 1000) + 's', model: resolvedModel, sessionId, cwd });
          }
        }, timeoutMs);

        proc.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;

          // Detect completion from stream-json events
          // Each line is a JSON object; look for {"type":"result"} which signals the session is done
          for (const line of chunk.split('\n')) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === 'system' && event.model) {
                resolvedModel = event.model;
              }
              if (event.type === 'result') {
                // Session complete — resolve and kill process (it may not exit on its own)
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timer);
                  resolve({ output: '', log: stdout, model: resolvedModel, sessionId, cwd });
                  // Give it a moment to exit gracefully, then force kill
                  setTimeout(() => {
                    try { proc.kill('SIGTERM'); } catch { /* already dead */ }
                    setTimeout(() => {
                      try { proc.kill('SIGKILL'); } catch { /* already dead */ }
                    }, 5_000);
                  }, 2_000);
                }
              }
            } catch {
              // Not valid JSON line, skip
            }
          }
        });

        proc.on('close', (code) => {
          clearTimeout(timer);
          if (!resolved) {
            resolved = true;
            if (code !== 0) {
              reject(new Error(`claude exited with code ${code}`));
            } else {
              resolve({ output: '', log: stdout, model: resolvedModel, sessionId, cwd });
            }
          }
        });

        proc.on('error', (err) => {
          clearTimeout(timer);
          if (!resolved) {
            resolved = true;
            reject(new Error(`Failed to spawn claude: ${err.message}`));
          }
        });
      });
    },
  };
}
