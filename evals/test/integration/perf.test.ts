import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWiki, writePageDirect, type WikiInstance } from '../../src/wiki.js';

let wiki: WikiInstance;
const SKIP = process.env.CI === 'true';

before(async () => {
  if (SKIP) return;
  wiki = await startWiki();
  for (let i = 0; i < 30; i++) {
    await writePageDirect(wiki.vaultPath, `perf-${i}`, `body ${i} mentions Squirrel Hill and 1991.`, {
      title: `Perf ${i}`,
      type: 'meta',
    });
  }
});

after(async () => {
  if (!SKIP) await wiki.destroy();
});

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

async function timeN(n: number, fn: () => Promise<unknown>): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    await fn();
    out.push(performance.now() - t);
  }
  return out;
}

test('perf: page render p95 under 300ms (3× spec)', { skip: SKIP }, async () => {
  await fetch(`${wiki.url}/perf-0`);  // warm-up
  const samples = await timeN(20, () => fetch(`${wiki.url}/perf-0`).then(r => r.text()));
  const p = p95(samples);
  assert.ok(p < 300, `p95 ${p.toFixed(1)}ms exceeded 300ms`);
});

test('perf: search p95 under 300ms (3× spec)', { skip: SKIP }, async () => {
  await fetch(`${wiki.url}/api/search?q=squirrel`);
  const samples = await timeN(20, () => fetch(`${wiki.url}/api/search?q=squirrel`).then(r => r.json()));
  const p = p95(samples);
  assert.ok(p < 300, `p95 ${p.toFixed(1)}ms exceeded 300ms`);
});

test('perf: PUT+commit p95 under 1500ms (3× spec)', { skip: SKIP }, async () => {
  const samples = await timeN(10, async () => {
    const slug = `perf-write-${Math.random().toString(36).slice(2, 8)}`;
    return fetch(`${wiki.url}/api/pages/${slug}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'hello', summary: 'perf' }),
    }).then(r => r.json());
  });
  const p = p95(samples);
  assert.ok(p < 1500, `p95 ${p.toFixed(1)}ms exceeded 1500ms`);
});
