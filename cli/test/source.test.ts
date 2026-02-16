import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sourceCommand } from '../src/commands/source.js';
import type { WikiClient } from '../src/wiki-client.js';

// ── Helpers ───────────────────────────────────────────────────────────

function mockClient(overrides: Partial<Record<string, any>> = {}): WikiClient {
  return {
    getNamespaces: async () => [{ id: 0, name: '' }],
    listAllPages: async () => [],
    ...overrides,
  } as unknown as WikiClient;
}

const globals = { json: false, quiet: false };

// ── Tests ─────────────────────────────────────────────────────────────

describe('sourceCommand', () => {
  it('throws on unknown subcommand with "Did you mean" hint', async () => {
    await assert.rejects(
      () => sourceCommand(['foo'], globals, mockClient()),
      (err: any) => {
        assert.match(err.message, /Unknown subcommand: "foo"/);
        assert.match(err.message, /Did you mean: list/);
        assert.equal(err.exitCode, 1);
        return true;
      },
    );
  });

  it('throws on missing subcommand with available list', async () => {
    await assert.rejects(
      () => sourceCommand([], globals, mockClient()),
      (err: any) => {
        assert.match(err.message, /Missing subcommand/);
        assert.match(err.message, /Available: list/);
        assert.equal(err.exitCode, 1);
        return true;
      },
    );
  });

  it('lists source pages successfully', async () => {
    const client = mockClient({
      getNamespaces: async () => [{ id: 0, name: '' }, { id: 100, name: 'Source' }],
      listAllPages: async () => ['Source:Page A', 'Source:Page B'],
    });

    // Should not throw
    await sourceCommand(['list'], globals, client);
  });

  it('handles missing Source namespace gracefully', async () => {
    const client = mockClient({
      getNamespaces: async () => [{ id: 0, name: '' }],
    });

    // Should not throw
    await sourceCommand(['list'], globals, client);
  });
});
