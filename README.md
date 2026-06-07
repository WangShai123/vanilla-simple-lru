# Simple LRU Cache

`vanilla-simple-lru` is a zero-dependency, browser-side JavaScript LRU cache. The exported `Lru` class inherits from the native `Map`, preserving the familiar `Map` interface while adding bounded capacity, LRU promotion, optional expiration, and eviction hooks functionality.

## Build Outputs

- `lru.mjs`: ESM Module.
- `lru.umd.js`: UMD，GlobalName: `lru`.

### Documentation

- [Api Documentation](./docs/api.md)
- [Design Documentation](./docs/design.md)

## Test

- File: `tests/lru.test.js`
- Run: `vp test`

## Compatibility

To maintain compatibility with my previous cache-related projects, two parameter aliases are retained: `max` and `ttl`. The mapping is as follows:

- `max` -> `maxSize`
- `ttl` -> `maxAge`
