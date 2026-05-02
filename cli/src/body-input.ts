import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

export function readFromFile(path: string): string {
  return readFileSync(path, 'utf-8');
}

export async function readFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

export function editInEditor(initial: string): string {
  const editor = process.env.EDITOR ?? 'vi';
  const dir = mkdtempSync(join(tmpdir(), 'wai-edit-'));
  const file = join(dir, 'page.md');
  try {
    writeFileSync(file, initial, 'utf-8');
    const r = spawnSync(editor, [file], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`editor exited with status ${r.status}`);
    return readFileSync(file, 'utf-8');
  } finally {
    try { unlinkSync(file); } catch { /* ignore */ }
    try { rmdirSync(dir); } catch { /* ignore */ }
  }
}
