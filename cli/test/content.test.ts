import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveContent } from '../src/content.js';

// ── Tests ─────────────────────────────────────────────────────────────

describe('resolveContent', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wai-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true });
  });

  it('returns -c content when provided', async () => {
    const result = await resolveContent({ content: 'inline content' });
    assert.equal(result, 'inline content');
  });

  it('returns empty string from -c without error', async () => {
    // resolveContent itself allows empty; the write command guards against it
    const result = await resolveContent({ content: '' });
    assert.equal(result, '');
  });

  it('reads content from -f file', async () => {
    const filePath = join(tmp, 'test.txt');
    writeFileSync(filePath, 'file content');

    const result = await resolveContent({ file: filePath });
    assert.equal(result, 'file content');
  });

  it('-c takes precedence over -f', async () => {
    const filePath = join(tmp, 'test.txt');
    writeFileSync(filePath, 'file content');

    const result = await resolveContent({ content: 'inline', file: filePath });
    assert.equal(result, 'inline');
  });

  it('throws on non-existent file', async () => {
    await assert.rejects(
      () => resolveContent({ file: '/nonexistent/path.txt' }),
      { code: 'ENOENT' },
    );
  });

  it('reads large file content', async () => {
    const filePath = join(tmp, 'large.txt');
    const largeContent = 'x'.repeat(100_000);
    writeFileSync(filePath, largeContent);

    const result = await resolveContent({ file: filePath });
    assert.equal(result.length, 100_000);
  });

  it('throws UsageError when no source and stdin is TTY', async () => {
    // When running tests, stdin is typically a TTY
    if (process.stdin.isTTY) {
      await assert.rejects(
        () => resolveContent({}),
        { name: 'UsageError' },
      );
    }
  });
});
