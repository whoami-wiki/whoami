import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { purgeCommand } from '../src/commands/purge.js';
import { UsageError } from '../src/errors.js';
import type { WikiClient } from '../src/wiki-client.js';

function mockClient(
  overrides: Partial<Record<string, any>> = {},
): WikiClient {
  return {
    purgePages: async (titles: string[]) =>
      titles.map((t) => ({ title: t, purged: true, missing: false })),
    ...overrides,
  } as unknown as WikiClient;
}

const globals = { json: false, quiet: false };
const jsonGlobals = { json: true, quiet: false };

describe('purgeCommand', () => {
  it('throws UsageError when no titles given', async () => {
    await assert.rejects(
      () => purgeCommand([], globals, mockClient()),
      UsageError,
    );
  });

  it('purges a single title', async () => {
    let received: string[] | null = null;
    const client = mockClient({
      purgePages: async (titles: string[]) => {
        received = titles;
        return titles.map((t) => ({ title: t, purged: true, missing: false }));
      },
    });
    await purgeCommand(['Main Page'], globals, client);
    assert.deepEqual(received, ['Main Page']);
  });

  it('purges multiple titles', async () => {
    let received: string[] | null = null;
    const client = mockClient({
      purgePages: async (titles: string[]) => {
        received = titles;
        return titles.map((t) => ({ title: t, purged: true, missing: false }));
      },
    });
    await purgeCommand(['Main Page', 'Featured:2026-05-26/TFA'], globals, client);
    assert.deepEqual(received, ['Main Page', 'Featured:2026-05-26/TFA']);
  });

  it('forwards --force-link-update flag to the client', async () => {
    let received: { titles: string[]; opts: any } | null = null;
    const client = mockClient({
      purgePages: async (titles: string[], opts: any) => {
        received = { titles, opts };
        return titles.map((t) => ({ title: t, purged: true, missing: false }));
      },
    });
    await purgeCommand(['Main Page', '--force-link-update'], globals, client);
    assert.equal(received!.opts.forceLinkUpdate, true);
  });

  it('outputs JSON when -j is set', async () => {
    const logs: any[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args);
    try {
      await purgeCommand(['Main Page'], jsonGlobals, mockClient());
    } finally {
      console.log = origLog;
    }
    const parsed = JSON.parse(logs[0][0]);
    assert.equal(Array.isArray(parsed), true);
    assert.equal(parsed[0].title, 'Main Page');
    assert.equal(parsed[0].purged, true);
  });
});
