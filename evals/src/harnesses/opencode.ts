import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
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

interface ProviderConfig {
  provider: string;   // e.g. "lmstudio", "vercel"
  modelName: string;  // e.g. "openai/gpt-oss-20b", "moonshotai/kimi-k2.5"
  baseURL: string;
  apiKeyEnv?: string; // env var name for API key (e.g. "AI_GATEWAY_API_KEY")
}

const PROVIDER_DEFAULTS: Record<string, { baseURL: string; apiKeyEnv?: string }> = {
  lmstudio: { baseURL: 'http://127.0.0.1:1234/v1' },
  ollama: { baseURL: 'http://127.0.0.1:11434/v1' },
  vercel: { baseURL: 'https://ai-gateway.vercel.sh/v1', apiKeyEnv: 'AI_GATEWAY_API_KEY' },
  moonshot: { baseURL: 'https://api.moonshot.ai/v1', apiKeyEnv: 'MOONSHOT_API_KEY' },
};

function parseProvider(model: string): ProviderConfig | undefined {
  if (!model.includes(':')) return undefined;
  const [prefix, ...rest] = model.split(':');
  const defaults = PROVIDER_DEFAULTS[prefix];
  if (!defaults) return undefined;
  return { provider: prefix, modelName: rest.join(':'), baseURL: defaults.baseURL, apiKeyEnv: defaults.apiKeyEnv };
}

function writeOpenCodeConfig(
  cwd: string,
  provider: ProviderConfig | undefined,
  env: Record<string, string | undefined>,
  allowPaths?: string[],
): void {
  const config: Record<string, unknown> = {
    $schema: 'https://opencode.ai/config.json',
  };

  if (provider) {
    const providerOptions: Record<string, unknown> = { baseURL: provider.baseURL };
    if (provider.apiKeyEnv) {
      const apiKey = env[provider.apiKeyEnv];
      if (apiKey) {
        providerOptions.headers = { Authorization: `Bearer ${apiKey}` };
      }
    }
    config.provider = {
      [provider.provider]: {
        npm: '@ai-sdk/openai-compatible',
        name: provider.provider,
        options: providerOptions,
        models: {
          [provider.modelName]: {
            name: provider.modelName,
          },
        },
      },
    };
  }

  // Allow access to source directories, vault, and common tool paths
  const rules: Record<string, string> = {};
  if (allowPaths) {
    for (const p of allowPaths) {
      rules[`${p}/**`] = 'allow';
    }
  }
  // Allow vault path (where wai stores snapshots/objects)
  const vaultPath = env['WAI_VAULT_PATH'];
  if (vaultPath) {
    rules[`${vaultPath}/**`] = 'allow';
  }
  // Allow wai CLI and common tool locations
  rules['/usr/local/bin/*'] = 'allow';
  rules[`${env['HOME'] ?? '~'}/.local/bin/*`] = 'allow';
  // Allow tmp directories (eval working dirs)
  rules['/tmp/**'] = 'allow';
  rules['/private/var/folders/**'] = 'allow';
  config.permission = { external_directory: rules };

  writeFileSync(join(cwd, 'opencode.json'), JSON.stringify(config, null, 2));
}

export function createOpenCodeHarness(model?: string): Harness {
  const customProvider = model ? parseProvider(model) : undefined;

  return {
    name: 'opencode',
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

      // opencode run [flags] <message..>
      const args = ['run'];

      if (resumeSessionId) {
        // Resume existing session: --session <id> continues the conversation
        args.push('--session', resumeSessionId);
      }

      if (customProvider) {
        args.push('--model', `${customProvider.provider}/${customProvider.modelName}`);
      } else if (model) {
        args.push('--model', model);
      }

      args.push('--format', 'json');
      args.push(prompt);

      const timeoutMs = options?.timeoutMs ?? 45 * 60 * 1000;

      return new Promise((resolve, reject) => {
        // Reuse working directory when resuming so the agent can see files it created
        const cwd = options?.cwd ?? mkdtempSync(join(tmpdir(), 'whoami-eval-harness-'));

        // Write config with provider settings and filesystem permissions
        const sourcePaths = task.sources.map((s) => s.path);
        writeOpenCodeConfig(cwd, customProvider, env, sourcePaths);

        // Copy OpenCode extensions (AGENTS.md + skills) into the working directory
        if (!resumeSessionId) {
          const thisDir = dirname(fileURLToPath(import.meta.url));
          const extensionsDir = join(thisDir, '..', '..', '..', 'extensions', 'opencode');
          if (existsSync(extensionsDir)) {
            const agentsMd = join(extensionsDir, 'AGENTS.md');
            if (existsSync(agentsMd)) {
              execSync(`cp "${agentsMd}" "${cwd}/AGENTS.md"`);
            }
            const skillsDir = join(extensionsDir, 'skills');
            if (existsSync(skillsDir)) {
              execSync(`mkdir -p "${cwd}/.opencode/skills" && cp -r "${skillsDir}/"* "${cwd}/.opencode/skills/"`);
            }
          }
        }

        const proc = spawn('opencode', args, {
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
          let sessionId: string | undefined;
          let resolvedModel: string | undefined;
          for (const line of stdout.split('\n')) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.sessionID && !sessionId) { sessionId = obj.sessionID; }
              if (obj.model && !resolvedModel) { resolvedModel = obj.model; }
            } catch { /* skip non-JSON lines */ }
          }
          if (!resolvedModel && customProvider) {
            resolvedModel = `${customProvider.provider}/${customProvider.modelName}`;
          } else if (!resolvedModel && model) {
            resolvedModel = model;
          }

          // Detect API/billing errors in stderr (opencode exits 0 on these)
          const billingErrorPattern = /Insufficient balance|rate_limit_exceeded|billing.*error|quota.*exceeded/i;
          const hasBillingError = billingErrorPattern.test(stderr);

          if (timedOut) {
            resolve({ output: stdout, log: (stderr || stdout) + '\n[TIMEOUT] Agent killed after ' + (timeoutMs / 1000) + 's', model: resolvedModel, sessionId, cwd });
          } else if (code !== 0) {
            reject(new Error(`opencode exited with code ${code}: ${stderr}`));
          } else if (hasBillingError) {
            reject(new Error(`opencode hit API/billing error (exit 0): ${stderr.slice(0, 500)}`));
          } else {
            resolve({ output: stdout, log: stderr || stdout, model: resolvedModel, sessionId, cwd });
          }
        });

        proc.on('error', (err) => {
          clearTimeout(timer);
          reject(new Error(`Failed to spawn opencode: ${err.message}`));
        });
      });
    },
  };
}
