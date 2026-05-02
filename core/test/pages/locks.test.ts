import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withLock } from '../../src/pages/locks.ts';

test('withLock: serializes concurrent operations on the same key', async () => {
  const log: string[] = [];
  const slow = (label: string) => withLock('a', async () => {
    log.push(`enter-${label}`);
    await new Promise((r) => setTimeout(r, 20));
    log.push(`exit-${label}`);
  });
  await Promise.all([slow('1'), slow('2')]);
  assert.match(log.join(','), /enter-1,exit-1,enter-2,exit-2|enter-2,exit-2,enter-1,exit-1/);
});

test('withLock: different keys do not block each other', async () => {
  let aRunning = false;
  let bRanWhileARunning = false;
  await Promise.all([
    withLock('a', async () => {
      aRunning = true;
      await new Promise((r) => setTimeout(r, 30));
      aRunning = false;
    }),
    withLock('b', async () => {
      await new Promise((r) => setTimeout(r, 10));
      bRanWhileARunning = aRunning;
    }),
  ]);
  assert.equal(bRanWhileARunning, true);
});

test('withLock: returns the value from the body', async () => {
  const v = await withLock('a', async () => 42);
  assert.equal(v, 42);
});

test('withLock: releases the lock when body throws', async () => {
  await assert.rejects(withLock('a', async () => { throw new Error('boom'); }));
  const v = await Promise.race([
    withLock('a', async () => 'ok'),
    new Promise((_, rej) => setTimeout(() => rej(new Error('lock leaked')), 100)),
  ]);
  assert.equal(v, 'ok');
});
