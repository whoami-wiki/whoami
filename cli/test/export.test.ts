import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportCommand } from '../src/commands/export.js';
import type { WikiClient } from '../src/wiki-client.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeExportXml(pages: Array<{ title: string; text: string }>): string {
  let xml = '<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/">\n';
  xml += '  <siteinfo><sitename>Test</sitename></siteinfo>\n';
  for (const p of pages) {
    xml += `  <page>\n`;
    xml += `    <title>${p.title}</title>\n`;
    xml += `    <ns>0</ns>\n`;
    xml += `    <revision><text xml:space="preserve">${p.text}</text></revision>\n`;
    xml += `  </page>\n`;
  }
  xml += '</mediawiki>\n';
  return xml;
}

function mockClient(overrides: Partial<Record<string, any>> = {}): WikiClient {
  return {
    getNamespaces: async () => [{ id: 0, name: '' }],
    listAllPages: async () => [],
    exportPages: async () => makeExportXml([]),
    ...overrides,
  } as unknown as WikiClient;
}

// ── exportCommand ─────────────────────────────────────────────────────

describe('exportCommand', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wai-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true });
  });

  it('throws UsageError when no file given', async () => {
    await assert.rejects(
      () => exportCommand([], { json: false, quiet: false }, mockClient()),
      { name: 'UsageError' },
    );
  });

  it('dry run lists pages without writing file', async () => {
    const outPath = join(tmp, 'out.xml');
    const client = mockClient({
      getNamespaces: async () => [{ id: 0, name: '' }],
      listAllPages: async () => ['Page A', 'Page B'],
    });

    await exportCommand([outPath, '--dry-run'], { json: false, quiet: true }, client);
    assert.throws(() => readFileSync(outPath), /ENOENT/);
  });

  it('uses --ns filter instead of getNamespaces', async () => {
    const outPath = join(tmp, 'out.xml');
    const queriedNs: number[] = [];
    let getNamespacesCalled = false;

    const client = mockClient({
      getNamespaces: async () => { getNamespacesCalled = true; return []; },
      listAllPages: async (ns: number) => {
        queriedNs.push(ns);
        return ns === 0 ? ['Main Page'] : ['Talk:Main Page'];
      },
      exportPages: async (titles: string[]) => makeExportXml(
        titles.map((t) => ({ title: t, text: 'content' })),
      ),
    });

    await exportCommand([outPath, '--ns', '0,1'], { json: false, quiet: true }, client);
    assert.equal(getNamespacesCalled, false);
    assert.deepEqual(queriedNs, [0, 1]);
  });

  it('writes valid XML with pages from single batch', async () => {
    const outPath = join(tmp, 'out.xml');
    const client = mockClient({
      listAllPages: async () => ['Page A', 'Page B'],
      exportPages: async () => makeExportXml([
        { title: 'Page A', text: 'content a' },
        { title: 'Page B', text: 'content b' },
      ]),
    });

    await exportCommand([outPath], { json: false, quiet: true }, client);

    const xml = readFileSync(outPath, 'utf-8');
    assert.ok(xml.startsWith('<mediawiki'));
    assert.ok(xml.includes('<title>Page A</title>'));
    assert.ok(xml.includes('<title>Page B</title>'));
    assert.ok(xml.endsWith('</mediawiki>\n'));
  });

  it('merges multiple batches into single XML', async () => {
    const outPath = join(tmp, 'out.xml');
    // Generate 75 page titles to force two batches (batch size = 50)
    const allTitles = Array.from({ length: 75 }, (_, i) => `Page ${i}`);
    let exportCallCount = 0;

    const client = mockClient({
      listAllPages: async () => allTitles,
      exportPages: async (titles: string[]) => {
        exportCallCount++;
        return makeExportXml(titles.map((t) => ({ title: t, text: `content of ${t}` })));
      },
    });

    await exportCommand([outPath], { json: false, quiet: true }, client);

    assert.equal(exportCallCount, 2);

    const xml = readFileSync(outPath, 'utf-8');
    // Should have single opening and closing tag
    assert.equal((xml.match(/<mediawiki/g) || []).length, 1);
    assert.equal((xml.match(/<\/mediawiki>/g) || []).length, 1);
    // Should have single siteinfo
    assert.equal((xml.match(/<siteinfo>/g) || []).length, 1);
    // Should have all 75 pages
    assert.equal((xml.match(/<page>/g) || []).length, 75);
    // Spot-check first and last batch pages
    assert.ok(xml.includes('<title>Page 0</title>'));
    assert.ok(xml.includes('<title>Page 74</title>'));
  });

  it('json output includes page count', async () => {
    const outPath = join(tmp, 'out.xml');
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    const client = mockClient({
      listAllPages: async () => ['A', 'B'],
      exportPages: async () => makeExportXml([
        { title: 'A', text: 'a' },
        { title: 'B', text: 'b' },
      ]),
    });

    try {
      await exportCommand([outPath], { json: true, quiet: false }, client);
      const output = JSON.parse(logs[logs.length - 1]);
      assert.equal(output.pages, 2);
      assert.equal(output.file, outPath);
    } finally {
      console.log = origLog;
    }
  });
});
