export interface RateLimiterOptions {
  windowMs: number;
  maxAttempts: number;
}

export interface RateLimiter {
  check(key: string): 'ok' | 'limited';
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const buckets = new Map<string, number[]>();

  return {
    check(key: string): 'ok' | 'limited' {
      const now = Date.now();
      const cutoff = now - opts.windowMs;
      const stamps = (buckets.get(key) ?? []).filter(t => t > cutoff);
      if (stamps.length >= opts.maxAttempts) {
        buckets.set(key, stamps);
        return 'limited';
      }
      stamps.push(now);
      buckets.set(key, stamps);
      return 'ok';
    },
  };
}
