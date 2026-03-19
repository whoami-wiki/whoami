import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import {
  readManifest,
  readObject,
  findInManifest,
  findAllInManifest,
  extractMessagesNearDate,
} from '../src/vault.js';
import { resolveCitations } from '../src/graders/citation-resolver.js';

function createTempDir(): string {
  const dir = join(tmpdir(), `vault-test-${randomBytes(4).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('readManifest', () => {
  let vaultPath: string;

  beforeEach(() => {
    vaultPath = createTempDir();
    mkdirSync(join(vaultPath, 'snapshots'), { recursive: true });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('reads a valid manifest', () => {
    const manifest = {
      files: [
        { path: 'messages/thread_123/message_1.json', hash: 'abc123def456' },
        { path: 'photos/photo_1.jpg', hash: 'fff000111222' },
      ],
    };
    writeFileSync(
      join(vaultPath, 'snapshots', 'snap1234.json'),
      JSON.stringify(manifest),
    );

    const result = readManifest(vaultPath, 'snap1234');
    assert.notEqual(result, null);
    assert.equal(result!.files.length, 2);
    assert.equal(result!.files[0].path, 'messages/thread_123/message_1.json');
  });

  it('returns null for missing manifest', () => {
    const result = readManifest(vaultPath, 'nonexistent');
    assert.equal(result, null);
  });

  it('returns null for invalid JSON', () => {
    writeFileSync(join(vaultPath, 'snapshots', 'bad.json'), 'not json');
    const result = readManifest(vaultPath, 'bad');
    assert.equal(result, null);
  });
});

describe('readObject', () => {
  let vaultPath: string;

  beforeEach(() => {
    vaultPath = createTempDir();
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('reads an object by hash', () => {
    const hash = 'abcdef1234567890';
    const prefix = hash.slice(0, 2);
    mkdirSync(join(vaultPath, 'objects', prefix), { recursive: true });
    writeFileSync(join(vaultPath, 'objects', prefix, hash), 'file contents');

    const result = readObject(vaultPath, hash);
    assert.notEqual(result, null);
    assert.equal(result!.toString('utf-8'), 'file contents');
  });

  it('returns null for missing object', () => {
    const result = readObject(vaultPath, 'deadbeef00000000');
    assert.equal(result, null);
  });
});

describe('findInManifest', () => {
  const manifest = {
    files: [
      { path: 'messages/test_contact_100200300/message_1.json', hash: 'aaa' },
      { path: 'messages/test_contact_100200300/message_2.json', hash: 'bbb' },
      { path: 'photos/photo_1.jpg', hash: 'ccc' },
    ],
  };

  it('finds a file matching thread directory', () => {
    const result = findInManifest(manifest, (p) =>
      p.includes('test_contact_100200300') && p.endsWith('.json'),
    );
    assert.notEqual(result, undefined);
    assert.equal(result!.hash, 'aaa');
  });

  it('returns undefined when no match', () => {
    const result = findInManifest(manifest, (p) => p.includes('nonexistent'));
    assert.equal(result, undefined);
  });
});

describe('findAllInManifest', () => {
  const manifest = {
    files: [
      { path: 'messages/test_contact_100200300/message_1.json', hash: 'aaa' },
      { path: 'messages/test_contact_100200300/message_2.json', hash: 'bbb' },
      { path: 'photos/photo_1.jpg', hash: 'ccc' },
    ],
  };

  it('finds all files matching predicate', () => {
    const results = findAllInManifest(manifest, (p) =>
      p.includes('test_contact_100200300'),
    );
    assert.equal(results.length, 2);
  });

  it('returns empty array when no match', () => {
    const results = findAllInManifest(manifest, (p) => p.includes('nonexistent'));
    assert.equal(results.length, 0);
  });
});

describe('extractMessagesNearDate', () => {
  const threadJson = JSON.stringify({
    participants: [{ name: 'Owner' }, { name: 'Contact' }],
    messages: [
      { sender_name: 'Owner', timestamp_ms: 1573689600000, content: 'Hello' },       // 2019-11-14
      { sender_name: 'Contact', timestamp_ms: 1573700400000, content: 'Hi there!' },    // 2019-11-14
      { sender_name: 'Owner', timestamp_ms: 1573776000000, content: 'Day 2 msg' },   // 2019-11-15
      { sender_name: 'Contact', timestamp_ms: 1574294400000, content: 'Much later' },   // 2019-11-21
    ],
  });

  it('extracts messages within window', () => {
    const result = extractMessagesNearDate(threadJson, '2019-11-14', 1);
    assert.ok(result.includes('Owner: Hello'));
    assert.ok(result.includes('Contact: Hi there!'));
    assert.ok(result.includes('Owner: Day 2 msg'));
    assert.ok(!result.includes('Much later'));
  });

  it('returns empty string for date with no messages', () => {
    const result = extractMessagesNearDate(threadJson, '2020-06-01', 1);
    assert.equal(result, '');
  });

  it('includes participant info', () => {
    const result = extractMessagesNearDate(threadJson, '2019-11-14', 1);
    assert.ok(result.includes('Owner'));
    assert.ok(result.includes('Contact'));
  });

  it('returns empty string for invalid JSON', () => {
    const result = extractMessagesNearDate('not json', '2019-11-14');
    assert.equal(result, '');
  });

  it('returns empty string for missing messages array', () => {
    const result = extractMessagesNearDate('{"participants": []}', '2019-11-14');
    assert.equal(result, '');
  });

  it('caps at 50 messages', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      sender_name: 'Test',
      timestamp_ms: 1573689600000 + i * 1000,
      content: `msg ${i}`,
    }));
    const json = JSON.stringify({ participants: [{ name: 'Test' }], messages });
    const result = extractMessagesNearDate(json, '2019-11-14', 1);
    const lines = result.split('\n').filter((l) => l.startsWith('['));
    assert.equal(lines.length, 50);
  });
});

describe('resolveCitations', () => {
  let vaultPath: string;

  beforeEach(() => {
    vaultPath = createTempDir();
    mkdirSync(join(vaultPath, 'snapshots'), { recursive: true });
  });

  afterEach(() => {
    rmSync(vaultPath, { recursive: true, force: true });
  });

  it('resolves a message citation from vault', () => {
    // Set up manifest
    const hash = 'ab1234567890abcdef';
    const manifest = {
      files: [
        { path: 'messages/test_contact_100200300/message_1.json', hash },
      ],
    };
    writeFileSync(
      join(vaultPath, 'snapshots', '329f2f56f6122638.json'),
      JSON.stringify(manifest),
    );

    // Set up object
    const prefix = hash.slice(0, 2);
    mkdirSync(join(vaultPath, 'objects', prefix), { recursive: true });
    const msgData = {
      participants: [{ name: 'Owner' }, { name: 'Contact' }],
      messages: [
        { sender_name: 'Contact', timestamp_ms: 1573689600000, content: 'Hello from November 14' },
      ],
    };
    writeFileSync(
      join(vaultPath, 'objects', prefix, hash),
      JSON.stringify(msgData),
    );

    const wikitext = '{{Cite message | snapshot=329f2f56f6122638 | date=2019-11-14 | thread=test_contact_100200300 | author=Contact}}';
    const results = resolveCitations(wikitext, vaultPath);

    assert.equal(results.length, 1);
    assert.equal(results[0].resolved, true);
    assert.ok(results[0].sourceExcerpt.includes('Hello from November 14'));
  });

  it('returns unresolved for missing manifest', () => {
    const wikitext = '{{Cite message | snapshot=nonexistent | date=2019-11-14 | thread=test | author=Test}}';
    const results = resolveCitations(wikitext, vaultPath);

    assert.equal(results.length, 1);
    assert.equal(results[0].resolved, false);
    assert.ok(results[0].error?.includes('Manifest not found'));
  });

  it('resolves a direct hash citation', () => {
    const hash = 'cd9876543210fedcba';
    const prefix = hash.slice(0, 2);
    mkdirSync(join(vaultPath, 'objects', prefix), { recursive: true });
    writeFileSync(join(vaultPath, 'objects', prefix, hash), 'raw object data');

    const wikitext = `{{Cite photo | hash=${hash} | date=2020-01-01}}`;
    const results = resolveCitations(wikitext, vaultPath);

    assert.equal(results.length, 1);
    assert.equal(results[0].resolved, true);
    assert.ok(results[0].sourceExcerpt.includes('raw object data'));
  });

  it('handles wikitext with no citations', () => {
    const results = resolveCitations('Just some text.', vaultPath);
    assert.equal(results.length, 0);
  });

  it('handles multiple citations with cache reuse', () => {
    const hash = 'ef1234567890abcdef';
    const manifest = {
      files: [
        { path: 'messages/thread_1/message_1.json', hash },
      ],
    };
    writeFileSync(
      join(vaultPath, 'snapshots', 'snap123.json'),
      JSON.stringify(manifest),
    );

    const prefix = hash.slice(0, 2);
    mkdirSync(join(vaultPath, 'objects', prefix), { recursive: true });
    const msgData = {
      participants: [{ name: 'Alice' }],
      messages: [
        { sender_name: 'Alice', timestamp_ms: 1573689600000, content: 'msg1' },
        { sender_name: 'Alice', timestamp_ms: 1573776000000, content: 'msg2' },
      ],
    };
    writeFileSync(join(vaultPath, 'objects', prefix, hash), JSON.stringify(msgData));

    const wikitext = [
      '{{Cite message | snapshot=snap123 | date=2019-11-14 | thread=thread_1 | author=Alice}}',
      '{{Cite message | snapshot=snap123 | date=2019-11-15 | thread=thread_1 | author=Alice}}',
    ].join('\n');

    const results = resolveCitations(wikitext, vaultPath);
    assert.equal(results.length, 2);
    assert.equal(results[0].resolved, true);
    assert.equal(results[1].resolved, true);
  });
});
