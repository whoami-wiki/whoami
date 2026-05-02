import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWrite } from '../src/commands/write.js';

function fakeClient(captured: { slug?: string; body?: string; summary?: string }): any {
  return {
    write: async (slug: string, body: string, summary: string) => {
      captured.slug = slug;
      captured.body = body;
      captured.summary = summary;
      return { ok: true };
    },
  };
}

test('write: PUTs body and summary', async () => {
  const captured: { slug?: string; body?: string; summary?: string } = {};
  await runWrite({
    slug: 'foo',
    body: 'hello world',
    summary: 'init',
    client: fakeClient(captured),
    write: () => {},
  });
  assert.equal(captured.slug, 'foo');
  assert.equal(captured.body, 'hello world');
  assert.equal(captured.summary, 'init');
});

test('write: errors when summary missing', async () => {
  await assert.rejects(
    () => runWrite({
      slug: 'foo',
      body: 'x',
      summary: '',
      client: fakeClient({}),
      write: () => {},
    }),
    /summary/i,
  );
});
