import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeCommand } from '../src/commands/write.js';
import type { WikiClient } from '../src/wiki-client.js';

// ── Helpers ───────────────────────────────────────────────────────────

function mockClient(overrides: Partial<Record<string, any>> = {}): WikiClient {
  return {
    readPage: async () => ({ title: 'Test', revid: 100, content: 'old' }),
    writePage: async (_t: string, _c: string) => ({
      title: 'Test',
      oldRevid: 100,
      newRevid: 101,
      timestamp: '2025-01-01',
    }),
    ...overrides,
  } as unknown as WikiClient;
}

const globals = { json: false, quiet: false };
const jsonGlobals = { json: true, quiet: false };

// ── Tests ─────────────────────────────────────────────────────────────

describe('writeCommand', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wai-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true });
  });

  it('throws UsageError when no title given', async () => {
    await assert.rejects(
      () => writeCommand([], globals, mockClient()),
      { name: 'UsageError' },
    );
  });

  it('rejects empty content from -c flag', async () => {
    await assert.rejects(
      () => writeCommand(['Test', '-c', ''], globals, mockClient()),
      { message: /Refusing to write empty content/ },
    );
  });

  it('rejects whitespace-only content from -c flag', async () => {
    await assert.rejects(
      () => writeCommand(['Test', '-c', '   \n  '], globals, mockClient()),
      { message: /Refusing to write empty content/ },
    );
  });

  it('rejects empty file content', async () => {
    const filePath = join(tmp, 'empty.txt');
    writeFileSync(filePath, '');

    await assert.rejects(
      () => writeCommand(['Test', '-f', filePath], globals, mockClient()),
      { message: /Refusing to write empty content/ },
    );
  });

  it('writes content from -c flag', async () => {
    let written = '';
    const client = mockClient({
      writePage: async (_t: string, content: string) => {
        written = content;
        return { title: 'Test', oldRevid: 100, newRevid: 101, timestamp: '' };
      },
    });

    await writeCommand(['Test', '-c', 'Hello world'], globals, client);
    assert.equal(written, 'Hello world');
  });

  it('writes content from -f flag', async () => {
    const filePath = join(tmp, 'page.txt');
    writeFileSync(filePath, 'File content here');

    let written = '';
    const client = mockClient({
      writePage: async (_t: string, content: string) => {
        written = content;
        return { title: 'Test', oldRevid: 100, newRevid: 101, timestamp: '' };
      },
    });

    await writeCommand(['Test', '-f', filePath], globals, client);
    assert.equal(written, 'File content here');
  });

  it('writes content from positional file arg', async () => {
    const filePath = join(tmp, 'page.txt');
    writeFileSync(filePath, 'Positional file content');

    let written = '';
    const client = mockClient({
      writePage: async (_t: string, content: string) => {
        written = content;
        return { title: 'Test', oldRevid: 100, newRevid: 101, timestamp: '' };
      },
    });

    await writeCommand(['Test', filePath], globals, client);
    assert.equal(written, 'Positional file content');
  });

  it('-f flag takes precedence over positional file arg', async () => {
    const flagFile = join(tmp, 'flag.txt');
    const posFile = join(tmp, 'positional.txt');
    writeFileSync(flagFile, 'from flag');
    writeFileSync(posFile, 'from positional');

    let written = '';
    const client = mockClient({
      writePage: async (_t: string, content: string) => {
        written = content;
        return { title: 'Test', oldRevid: 100, newRevid: 101, timestamp: '' };
      },
    });

    await writeCommand(['Test', posFile, '-f', flagFile], globals, client);
    assert.equal(written, 'from flag');
  });

  it('reports no-change edit with exit code 1', async () => {
    const client = mockClient({
      writePage: async () => ({
        title: 'Test',
        oldRevid: 100,
        newRevid: 100,
        timestamp: '',
        noChange: true,
      }),
    });

    const origExitCode = process.exitCode;
    await writeCommand(['Test', '-c', 'same content'], globals, client);
    assert.equal(process.exitCode, 1);
    process.exitCode = origExitCode;
  });

  it('json output includes noChange for no-op edits', async () => {
    const client = mockClient({
      writePage: async () => ({
        title: 'Test',
        oldRevid: 100,
        newRevid: 100,
        timestamp: '',
        noChange: true,
      }),
    });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    const origExitCode = process.exitCode;

    try {
      await writeCommand(['Test', '-c', 'same content'], jsonGlobals, client);
      const output = JSON.parse(logs[logs.length - 1]);
      assert.equal(output.noChange, true);
    } finally {
      console.log = origLog;
      process.exitCode = origExitCode;
    }
  });

  it('passes summary to writePage', async () => {
    let receivedSummary = '';
    const client = mockClient({
      writePage: async (_t: string, _c: string, summary: string) => {
        receivedSummary = summary;
        return { title: 'Test', oldRevid: 100, newRevid: 101, timestamp: '' };
      },
    });

    await writeCommand(['Test', '-c', 'content', '-m', 'my summary'], globals, client);
    assert.equal(receivedSummary, 'my summary');
  });
});
