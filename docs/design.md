# Design Rationale

## Why `class Lru extends Map`

One of the goals of this project is to provide a native `Map`-style API. A class that extends `Map` is the most direct way to satisfy that contract:

- `cache instanceof Map` is true.
- `size`, iteration, `keys()`, `values()`, `entries()`, and `forEach()` behave
  like users expect from a `Map`.
- `set()` can return `this`, enabling normal `Map` chaining.

A functional factory is possible:

```js
function createLru(options) {
  return new Lru(options);
}
```

But a pure functional implementation cannot honestly be a native `Map`
subclass. It would either return a plain object with similar methods or use a
`Proxy`, which adds complexity and weakens compatibility. For this package,
`class Lru extends Map` is the better default. A tiny factory helper can still
be added later if the public API should feel more functional.

## Why two maps

Classic LRU caches often maintain a linked list plus a hash map. That is exact,
but it costs extra nodes and pointer updates. The two-`Map` architecture trades
perfect per-entry ordering for a simpler and very fast implementation:

1. New writes go into the recent map.
2. Reads from the old map move the entry into the recent map.
3. When the recent map reaches `maxSize`, the old map is evicted and the recent
   map becomes the old map.

The result is approximate LRU behavior with excellent practical performance and
minimal code.

## Expiration model

Entries store an absolute `expiry` timestamp. Expired entries are removed lazily
when they are touched by `get()`, `has()`, `peek()`, write-side rotation, or
iteration. `expiresIn()` is intentionally read-only: it reports remaining time
without changing recency or removing stale entries.

The `size` getter is also side-effect-free. It reports stored entries and can
include expired items until lazy cleanup happens through one of the operations
above.

This avoids background timers, keeps the package deterministic, and works well
in browser tabs that may be throttled or suspended.

## Eviction hook

`onEviction` is called when entries are removed by capacity rotation, manual
`evict()`, or lazy expiration cleanup. It is not called for explicit `delete()`
or `clear()`.
