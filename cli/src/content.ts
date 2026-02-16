import { readFileSync } from 'node:fs';
import { UsageError } from './errors.js';

/**
 * Read all data from stdin as a stream (avoids EAGAIN on large pipes).
 */
function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

/**
 * Resolve content from -c flag, -f flag, or stdin.
 * Precedence: -c → -f → stdin (if not a TTY) → error
 */
export async function resolveContent(options: { content?: string; file?: string }): Promise<string> {
  if (options.content !== undefined) return options.content;
  if (options.file) return readFileSync(options.file, 'utf-8');
  if (!process.stdin.isTTY) {
    return readStdin();
  }
  throw new UsageError('No content provided. Use -c, -f, or pipe to stdin.');
}
