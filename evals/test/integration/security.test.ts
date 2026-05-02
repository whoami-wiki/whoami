import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startWiki, type WikiInstance } from '../../src/wiki.js';

let wiki: WikiInstance;

before(async () => { wiki = await startWiki(); });
after(async () => { await wiki.destroy(); });

const XSS_BODY = `Plain prose.

<script>alert(1)</script>

<img src=x onerror="alert(2)">

[clean link](https://example.com)
`;

test('xss: <script> tags are stripped from rendered HTML', async () => {
  await fetch(`${wiki.url}/api/pages/xss-page`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: XSS_BODY, summary: 'xss seed' }),
  });
  const res = await fetch(`${wiki.url}/xss-page`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.equal(html.includes('<script>alert'), false, 'malicious <script> survived');
  assert.equal(html.includes('alert(1)'), false, 'alert(1) survived');
});

test('xss: onerror handler stripped', async () => {
  const res = await fetch(`${wiki.url}/xss-page`);
  const html = await res.text();
  assert.equal(/onerror=/i.test(html), false, 'onerror attribute survived');
  assert.equal(html.includes('alert(2)'), false, 'alert(2) survived');
});

test('xss: clean prose still renders', async () => {
  const res = await fetch(`${wiki.url}/xss-page`);
  const html = await res.text();
  assert.match(html, /Plain prose/);
  assert.match(html, /href="https:\/\/example\.com"/);
});

test('slug: uppercase rejected with 400', async () => {
  const res = await fetch(`${wiki.url}/api/pages/UPPERCASE`);
  assert.equal(res.status, 400);
});

test('slug: PUT with spaces rejected with 400', async () => {
  const res = await fetch(`${wiki.url}/api/pages/Has%20Space`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'x', summary: 'try' }),
  });
  assert.equal(res.status, 400);
});

test('slug: valid-shaped missing slug returns 404 not 400', async () => {
  const res = await fetch(`${wiki.url}/api/pages/does-not-exist`);
  assert.equal(res.status, 404);
});
