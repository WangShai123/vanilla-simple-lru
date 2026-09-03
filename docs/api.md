# vanilla-lru API

`vanilla-lru` is a zero-dependency LRU cache for JavaScript. The exported `Lru` class extends the native `Map`, so it keeps the familiar `Map` surface while adding bounded capacity, LRU promotion, optional expiration, and eviction hooks. The named `createLru()` factory returns the same `Lru` instance type when you prefer a function entry.

```js
import Lru, { createLru } from 'vanilla-lru';

const cache = new Lru({
  maxSize: 1000,
  maxAge: 1000 * 60 * 5,
  onEviction(key, value) {
    console.warn('Evicted:', key, value);
  },
});

cache.set('/api/user', { name: 'Ada' });
cache.get('/api/user');

const factoryCache = createLru({ maxSize: 1000 });
```

## Constructor

```js
new Lru(options);
```

## Factory

```js
createLru(options);
```

Returns a new `Lru` instance. It accepts the same options as the constructor and preserves the full `Lru` and `Map` API surface.

### options.maxSize

Type: `number`

Required. The maximum number of entries to keep. It must be a positive integer.

### options.maxAge

Type: `number`

Default: `Infinity`

How long each entry stays valid, in milliseconds. Use `Infinity` for entries that do not expire by time.

### options.onEviction

Type: `(key, value) => void`

Called when entries are evicted because the cache rotates, when `evict()` is called, or when an expired entry is lazily removed. Manual `delete()` and `clear()` do not call this hook.

### Migration aliases

For migration from the earlier cache project, `{ max, ttl }` are accepted as aliases for `{ maxSize, maxAge }`.

## Map API

`Lru` extends `Map` and implements the most important `Map` methods:

```js
cache.set(key, value);
cache.get(key);
cache.has(key);
cache.delete(key);
cache.clear();
cache.size;
cache.keys();
cache.values();
cache.entries();
cache.forEach((value, key, cache) => {});
```

Like native `Map#get`, missing or expired entries return `undefined`.

Expiration is lazy. The `size` getter reports the stored item count and may include expired entries until a read, write-side rotation, or iteration removes them.

## LRU Methods

### set(key, value, options?)

Stores a value and marks it as recently used.

```js
cache.set('token', 'abc', { maxAge: 10_000 });
```

Per-entry `maxAge` overrides the constructor default for that entry only.

### get(key)

Returns the value and promotes the entry to the recent cache segment.

### peek(key)

Returns the value without changing recency. Use this when inspection should not make the entry harder to evict.

### expiresIn(key)

Returns the remaining lifetime in milliseconds, `Infinity`, or `undefined` if the key is missing.

This method does not mark the entry as recently used and does not trigger lazy expiration. It can return a negative number when an entry is already expired but has not yet been removed by a read, write, or iteration.

### resize(maxSize)

Changes the cache capacity and keeps the newest entries.

### evict()

Evicts the oldest entry from the older cache segment and calls `onEviction`.

### entriesAscending()

Iterates from least recently used to most recently used.

```js
for (const [key, value] of cache.entriesAscending()) {
  console.log(key, value);
}
```

### entriesDescending()

Iterates from most recently used to least recently used.

## Design Notes

The cache uses a two-`Map` design:

- `cache`: receives new writes and entries promoted by `get()`.
- `oldCache`: holds the previous generation.

When the current segment reaches `maxSize`, it becomes the old segment and the previous old segment is evicted. This keeps normal operations very cheap: `get()`, `set()`, `has()`, and `delete()` remain close to native `Map` operations with small constant overhead.

This design is intentionally lightweight. It does not use timers to remove expired entries; expiration is lazy and is checked when keys are read, inspected, or iterated.
