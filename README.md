# Simple LRU Cache

`vanilla-simple-lru` is a zero-dependency JavaScript LRU cache. The exported `Lru` class inherits from the native `Map`, preserving the familiar `Map` interface while adding bounded capacity, LRU promotion, optional expiration, and eviction hooks functionality. You can also use the named `createLru()` factory to create a new instance.

[中文](./README.zh.md)

## Install

npm:

```bash
npm install vanilla-simple-lru
```

script:

```html
<!-- es module -->
<script type="module">
  import { createLru } from 'https://unpkg.com/vanilla-simple-lru/dist/index.js';
  const cache = createLru({
    maxSize: 1000,
    maxAge: 1000 * 60 * 5,
    onEviction(key, value) {
      console.warn('Evicted:', key, value);
    },
  });
</script>

<!-- umd GlobalName: vanillaSimpleLru -->
<script src="https://unpkg.com/vanilla-simple-lru/dist/index.umd.js"></script>
```

### Documentation

- [Api](./docs/api.md)
- [Design](./docs/design.md)

## Test

- File: `tests/lru.test.ts`
- Run: `vp test`

## Compatibility

To maintain compatibility with old projects, two parameter aliases are retained: `max` and `ttl`. The mapping is as follows:

- `max` -> `maxSize`
- `ttl` -> `maxAge`
