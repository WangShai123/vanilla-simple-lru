import { describe, expect, it, vi } from 'vite-plus/test';

import Lru from '../src/index.ts';

const delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

describe('Lru', () => {
  it('extends Map and exposes Map-compatible APIs', () => {
    const cache = new Lru({ maxSize: 3 });

    cache.set('a', 1).set('b', 2);

    expect(cache).toBeInstanceOf(Map);
    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe(1);
    expect(cache.has('b')).toBe(true);
    expect([...cache.keys()]).toEqual(['a', 'b']);
    expect([...cache.values()]).toEqual([1, 2]);
    expect([...cache.entries()]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    expect([...cache]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });

  it('keeps the most recently used items across rotations', () => {
    const cache = new Lru({ maxSize: 2 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    cache.set('d', 4);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
    expect([...cache.entriesAscending()]).toEqual([
      ['a', 1],
      ['c', 3],
      ['d', 4],
    ]);
  });

  it('does not update recency when peeking', () => {
    const cache = new Lru({ maxSize: 2 });

    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.peek('a')).toBe(1);

    cache.set('c', 3);
    cache.set('d', 4);

    expect(cache.has('a')).toBe(false);
    expect([...cache.entriesAscending()]).toEqual([
      ['c', 3],
      ['d', 4],
    ]);
  });

  it('supports maxAge and per-entry maxAge overrides', async () => {
    const cache = new Lru({ maxSize: 3, maxAge: 20 });

    cache.set('short', 'value');
    cache.set('long', 'value', { maxAge: 100 });

    expect(cache.expiresIn('short')).toBeGreaterThan(0);

    await delay(35);

    expect(cache.get('short')).toBeUndefined();
    expect(cache.get('long')).toBe('value');
  });

  it('reports expiration without changing recency or deleting stale entries', async () => {
    const cache = new Lru({ maxSize: 2, maxAge: 10 });

    cache.set('a', 1);

    await delay(20);

    expect(cache.expiresIn('a')).toBeLessThan(0);
    expect(cache.has('a')).toBe(false);
  });

  it('returns undefined for missing values like Map', () => {
    const cache = new Lru({ maxSize: 2 });

    expect(cache.get('missing')).toBeUndefined();
    expect(cache.peek('missing')).toBeUndefined();
    expect(cache.expiresIn('missing')).toBeUndefined();
  });

  it('calls onEviction when an old cache segment is evicted', () => {
    const onEviction = vi.fn();
    const cache = new Lru({ maxSize: 2, onEviction });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);

    expect(onEviction).toHaveBeenCalledTimes(2);
    expect(onEviction).toHaveBeenNthCalledWith(1, 'a', 1);
    expect(onEviction).toHaveBeenNthCalledWith(2, 'b', 2);
  });

  it('calls onEviction when stale entries are removed', async () => {
    const onEviction = vi.fn();
    const cache = new Lru({ maxSize: 2, maxAge: 10, onEviction });

    cache.set('a', 1);

    await delay(20);

    expect(cache.get('a')).toBeUndefined();
    expect(onEviction).toHaveBeenCalledWith('a', 1);
  });

  it('does not remove stale entries from size alone', async () => {
    const onEviction = vi.fn();
    const cache = new Lru({ maxSize: 2, maxAge: 10, onEviction });

    cache.set('a', 1);

    await delay(20);

    expect(cache.size).toBe(1);
    expect(onEviction).not.toHaveBeenCalled();
    expect(cache.has('a')).toBe(false);
    expect(onEviction).toHaveBeenCalledWith('a', 1);
  });

  it('supports manual eviction', () => {
    const onEviction = vi.fn();
    const cache = new Lru({ maxSize: 4, onEviction });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.evict(2);

    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
    expect(onEviction).toHaveBeenCalledWith('a', 1);
    expect(onEviction).toHaveBeenCalledWith('b', 2);
  });

  it('supports delete and clear', () => {
    const cache = new Lru({ maxSize: 3 });

    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.delete('a')).toBe(true);
    expect(cache.delete('missing')).toBe(false);
    expect(cache.has('a')).toBe(false);

    cache.clear();

    expect(cache.size).toBe(0);
    expect([...cache]).toEqual([]);
  });

  it('resizes while keeping the newest values', () => {
    const cache = new Lru({ maxSize: 4 });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    cache.get('b');
    cache.resize(2);

    expect(cache.maxSize).toBe(2);
    expect([...cache.entriesAscending()]).toEqual([
      ['d', 4],
      ['b', 2],
    ]);
  });

  it('supports old option aliases for migration from the simple cache', () => {
    const cache = new Lru({ max: 2, ttl: 50 });

    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.max).toBe(2);
    expect(cache.ttl).toBe(50);
    expect(cache.get('a')).toBe(1);
  });

  it('validates constructor and method options', () => {
    expect(() => new Lru()).toThrow(/maxSize/);
    expect(() => new Lru({ maxSize: 0 })).toThrow(/maxSize/);
    expect(() => new Lru({ maxSize: 1, maxAge: 0 })).toThrow(/maxAge/);
    expect(() => new Lru({ maxSize: 1, maxAge: -1 })).toThrow(/maxAge/);
    expect(() => new Lru({ maxSize: 1, onEviction: true })).toThrow(
      /onEviction/
    );

    const cache = new Lru({ maxSize: 1 });

    expect(() => cache.resize(0)).toThrow(/maxSize/);
    expect(() => cache.set('a', 1, { maxAge: -1 })).toThrow(/maxAge/);
  });
});
