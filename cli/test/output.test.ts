import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { outputJson, outputPage, outputTable, outputResult } from '../src/output.js';

// ── Helpers ───────────────────────────────────────────────────────────

let logs: string[];
let origLog: typeof console.log;

function captureConsole() {
  logs = [];
  origLog = console.log;
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '));
}

function restoreConsole() {
  console.log = origLog;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('outputJson', () => {
  beforeEach(captureConsole);
  afterEach(restoreConsole);

  it('outputs formatted JSON', () => {
    outputJson({ foo: 'bar', n: 42 });
    const parsed = JSON.parse(logs[0]);
    assert.equal(parsed.foo, 'bar');
    assert.equal(parsed.n, 42);
  });

  it('handles arrays', () => {
    outputJson([1, 2, 3]);
    const parsed = JSON.parse(logs[0]);
    assert.deepEqual(parsed, [1, 2, 3]);
  });
});

describe('outputPage', () => {
  beforeEach(captureConsole);
  afterEach(restoreConsole);

  it('prints page title, revid, and content', () => {
    outputPage({ title: 'Test Page', revid: 100, timestamp: '2025-01-01', content: 'Hello\nWorld' });
    assert.ok(logs[0].includes('Test Page'));
    assert.ok(logs[1].includes('rev 100'));
  });

  it('suppresses header in quiet mode', () => {
    outputPage(
      { title: 'Test', revid: 1, content: 'line1' },
      { quiet: true },
    );
    // In quiet mode, no title/rev header
    assert.ok(!logs.some(l => l.includes('Test')));
  });

  it('outputs raw content when raw is set', () => {
    const origWrite = process.stdout.write;
    let written = '';
    process.stdout.write = ((chunk: string) => { written += chunk; return true; }) as any;

    outputPage(
      { title: 'Test', revid: 1, content: 'raw output' },
      { raw: true },
    );

    process.stdout.write = origWrite;
    assert.equal(written, 'raw output');
  });

  it('respects offset and limit', () => {
    outputPage(
      { title: 'T', revid: 1, content: 'a\nb\nc\nd\ne' },
      { quiet: true, offset: 1, limit: 2 },
    );
    // Should show lines 2 and 3 (b and c)
    assert.equal(logs.length, 2);
    assert.ok(logs[0].includes('b'));
    assert.ok(logs[1].includes('c'));
  });
});

describe('outputTable', () => {
  beforeEach(captureConsole);
  afterEach(restoreConsole);

  it('prints headers and rows', () => {
    outputTable(['Name', 'Age'], [['Alice', '30'], ['Bob', '25']]);
    assert.ok(logs[0].includes('Name'));
    assert.ok(logs[0].includes('Age'));
    assert.ok(logs[1].includes('-')); // separator
    assert.ok(logs[2].includes('Alice'));
  });

  it('does nothing for empty rows', () => {
    outputTable(['Name'], []);
    assert.equal(logs.length, 0);
  });
});

describe('outputResult', () => {
  beforeEach(captureConsole);
  afterEach(restoreConsole);

  it('prints action and details', () => {
    outputResult('Created', 'Test Page', { rev: 101, time: '2025-01-01' });
    assert.ok(logs[0].includes('Created'));
    assert.ok(logs[0].includes('Test Page'));
    assert.ok(logs[1].includes('rev'));
  });

  it('skips undefined detail values', () => {
    outputResult('Updated', 'Page', { a: 'yes', b: undefined });
    assert.equal(logs.length, 2); // action line + one detail
  });
});
