import { spawn, execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Harness, HarnessResult, HarnessRunOptions } from './types.js';
import type { TestCase } from '../types.js';
import { buildSourcePrompt, buildContentPrompt, buildCheckpointPrompt } from './prompts.js';

function buildPrompt(task: TestCase, wikiUrl: string): string {
  const sources = task.sources
    .map((s) => `- ${s.type}: ${s.path} (snapshot: ${s.snapshotId})`)
    .join('\n');

  return `Write a ${task.pageType} page for whoami.wiki.

Task: ${task.description}

Sources:
${sources}

Wiki URL: ${wikiUrl}

Use the wai CLI to read sources and create the page. Follow Wikipedia-style editorial standards.`;
}

export function createCodexHarness(model?: string): Harness {
  // Parse provider from model string: "lmstudio:model-name" or "ollama:model-name"
  let provider: string | undefined;
  let modelName = model;
  if (model?.includes(':')) {
    const [prefix, ...rest] = model.split(':');
    if (prefix === 'lmstudio' || prefix === 'ollama') {
      provider = prefix;
      modelName = rest.join(':');
    }
  }

  return {
    name: 'codex',
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

      const args: string[] = [];

      if (resumeSessionId) {
        // Resume existing session: codex exec resume <id> <prompt> --full-auto --json
        args.push('exec', 'resume', resumeSessionId, prompt, '--full-auto', '--json');
      } else {
        // Fresh session: codex exec --full-auto --json <prompt>
        args.push('exec', '--full-auto', '--json', prompt);
      }

      if (provider) {
        args.push('--oss', '--local-provider', provider);
      }
      if (modelName) {
        args.push('--model', modelName);
      }

      const timeoutMs = options?.timeoutMs ?? 45 * 60 * 1000;

      return new Promise((resolve, reject) => {
        // Reuse working directory when resuming so the agent can see files it created
        const cwd = options?.cwd ?? mkdtempSync(join(tmpdir(), 'whoami-eval-harness-'));
        if (!options?.cwd) {
          execSync('git init -q', { cwd });
        }
        const proc = spawn('codex', args, {
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
          // Extract thread_id from JSONL output for session resume
          let sessionId: string | undefined;
          let resolvedModel: string | undefined;
          for (const line of stdout.split('\n')) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === 'thread.started' && event.thread_id) {
                sessionId = event.thread_id;
              }
            } catch {
              // Not JSON, skip
            }
          }
          resolvedModel = modelName ?? model;

          if (timedOut) {
            resolve({ output: '', log: stdout + '\n[TIMEOUT] Agent killed after ' + (timeoutMs / 1000) + 's', model: resolvedModel, sessionId, cwd });
          } else if (code !== 0) {
            reject(new Error(`codex exited with code ${code}: ${stderr}`));
          } else {
            resolve({ output: '', log: stdout, model: resolvedModel, sessionId, cwd });
          }
        });

        proc.on('error', (err) => {
          clearTimeout(timer);
          reject(new Error(`Failed to spawn codex: ${err.message}`));
        });
      });
    },
  };
}
