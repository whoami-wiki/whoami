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
  queues.set(key, prev.then(() => next));

  await prev;
  try {
    return await body();
  } finally {
    release();
    if (queues.get(key) === prev.then(() => next)) {
      queues.delete(key);
    }
  }
}
