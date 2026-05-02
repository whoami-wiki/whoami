import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { startWiki, writePageDirect, type WikiInstance } from '../../src/wiki.js';

let wiki: WikiInstance;

before(async () => {
  wiki = await startWiki();
  await writePageDirect(wiki.vaultPath, 'atomic-page', 'original body', { title: 'Atomic Page' });
});

after(async () => { await wiki.destroy(); });

function installFailingHook(): void {
  const hookPath = join(wiki.vaultPath, '.git', 'hooks', 'pre-commit');
  mkdirSync(join(wiki.vaultPath, '.git', 'hooks'), { recursive: true });
  writeFileSync(hookPath, '#!/bin/sh\nexit 1\n');
  chmodSync(hookPath, 0o755);
}

function removeHook(): void {
  const hookPath = join(wiki.vaultPath, '.git', 'hooks', 'pre-commit');
  if (existsSync(hookPath)) execSync(`rm -f "${hookPath}"`);
}

test('atomic write: failed commit leaves on-disk file unchanged', async () => {
  installFailingHook();
  try {
    const res = await fetch(`${wiki.url}/api/pages/atomic-page`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'attempted overwrite', summary: 'force fail' }),
    });
    assert.equal(res.ok, false, 'expected 5xx, got ' + res.status);

    const onDisk = readFileSync(join(wiki.vaultPath, 'pages', 'atomic-page.md'), 'utf-8');
    assert.match(onDisk, /original body/, 'previous body should be preserved');
    assert.equal(onDisk.includes('attempted overwrite'), false, 'failed write must not leak');
  } finally {
    removeHook();
  }
});

test('atomic write: no orphan .tmp file after failure', async () => {
  installFailingHook();
  try {
    await fetch(`${wiki.url}/api/pages/atomic-orphan`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'should fail', summary: 'orphan check' }),
    });
    const tmp = join(wiki.vaultPath, 'pages', 'atomic-orphan.md.tmp');
    assert.equal(existsSync(tmp), false, '.tmp orphan should have been cleaned up');
  } finally {
    removeHook();
  }
});
