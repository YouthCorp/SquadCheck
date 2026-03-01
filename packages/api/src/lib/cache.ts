import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return Promise.resolve(hit);

  return fn().then((result) => {
    cache.set(key, result, ttl);
    return result;
  });
}

export function invalidate(pattern?: string) {
  if (!pattern) {
    cache.flushAll();
    return;
  }
  const keys = cache.keys().filter((k) => k.startsWith(pattern));
  keys.forEach((k) => cache.del(k));
}
