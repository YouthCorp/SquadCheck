import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
const inFlight = new Map<string, Promise<unknown>>();

export function cached<T>(
  key: string,
  ttl: number | ((result: T) => number),
  fn: () => Promise<T>,
): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return Promise.resolve(hit);

  // Deduplicate concurrent in-flight requests for the same key
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fn()
    .then((result) => {
      const actualTtl = typeof ttl === 'function' ? ttl(result) : ttl;
      cache.set(key, result, actualTtl);
      inFlight.delete(key);
      return result;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}

export function invalidate(pattern?: string) {
  if (!pattern) {
    cache.flushAll();
    return;
  }
  const keys = cache.keys().filter((k) => k.startsWith(pattern));
  keys.forEach((k) => cache.del(k));
}
