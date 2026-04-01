import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WaiError, UsageError, AuthError, NotFoundError, ConflictError } from '../src/errors.js';

// ── Tests ─────────────────────────────────────────────────────────────

describe('WaiError', () => {
  it('sets message and exitCode', () => {
    const err = new WaiError('something broke', 42);
    assert.equal(err.message, 'something broke');
    assert.equal(err.exitCode, 42);
    assert.equal(err.name, 'WaiError');
    assert.ok(err instanceof Error);
  });
});

describe('UsageError', () => {
  it('has exit code 2', () => {
    const err = new UsageError('bad args');
    assert.equal(err.exitCode, 2);
    assert.equal(err.name, 'UsageError');
    assert.ok(err instanceof WaiError);
  });
});

describe('AuthError', () => {
  it('has exit code 3', () => {
    const err = new AuthError('not logged in');
    assert.equal(err.exitCode, 3);
    assert.equal(err.name, 'AuthError');
    assert.ok(err instanceof WaiError);
  });
});

describe('NotFoundError', () => {
  it('has exit code 4', () => {
    const err = new NotFoundError('page missing');
    assert.equal(err.exitCode, 4);
    assert.equal(err.name, 'NotFoundError');
    assert.ok(err instanceof WaiError);
  });
});

describe('ConflictError', () => {
  it('has exit code 5', () => {
    const err = new ConflictError('edit conflict');
    assert.equal(err.exitCode, 5);
    assert.equal(err.name, 'ConflictError');
    assert.ok(err instanceof WaiError);
  });
});
