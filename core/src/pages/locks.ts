const queues = new Map<string, Promise<unknown>>();

/**
 * Run `body` while holding an exclusive lock keyed by `key`. Concurrent calls
 * with the same key serialize; different keys don't block each other.
 * Lock is released even if `body` throws.
 */
export async function withLock<T>(key: string, body: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((res) => { release = res; });
  const queued = prev.then(() => next);
  queues.set(key, queued);

  await prev;
  try {
    return await body();
  } finally {
    release();
    if (queues.get(key) === queued) {
      queues.delete(key);
    }
  }
}
