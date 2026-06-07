# vanilla-simple-lru API

`vanilla-simple-lru` 是一个零依赖的浏览器端 JavaScript LRU 缓存。导出的 `Lru` 类继承自原生 `Map`，因此保留了熟悉的 `Map` 接口，同时添加了有界容量、LRU 提升、可选过期和驱逐钩子功能。

```js
import Lru from 'vanilla-simple-lru';

const cache = new Lru({
  maxSize: 1000,
  maxAge: 1000 * 60 * 5,
  onEviction(key, value) {
    console.warn('已驱逐:', key, value);
  },
});

cache.set('/api/user', { name: 'Ada' });
cache.get('/api/user');
```

## 构造函数

```js
new Lru(options);
```

### options.maxSize

类型：`number`

必填。要保留的最大条目数。必须是正整数。

### options.maxAge

类型：`number`

默认值：`Infinity`

每个条目的有效时长，以毫秒为单位。使用 `Infinity` 表示不按时间过期的条目。

### options.onEviction

类型：`(key, value) => void`

当缓存轮换、调用 `evict()` 或惰性移除过期条目时调用此回调。手动调用 `delete()` 和 `clear()` 不会触发此钩子。

### 迁移别名

为了从早期的缓存项目迁移，`{ max, ttl }` 被接受为 `{ maxSize, maxAge }` 的别名。

## Map API

`Lru` 继承自 `Map` 并实现了最重要的 `Map` 方法：

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

与原生 `Map#get` 一样，缺失或过期的条目返回 `undefined`。

过期是惰性的。`size`  getter 报告存储的条目数量，可能包含过期条目，直到读取、写入侧轮换或迭代将其移除。

## LRU 方法

### set(key, value, options?)

存储一个值并将其标记为最近使用。

```js
cache.set('token', 'abc', { maxAge: 10_000 });
```

每个条目的 `maxAge` 仅覆盖该条目的构造函数默认值。

### get(key)

返回值并将条目提升到最近的缓存段。

### peek(key)

返回值而不改变最近使用状态。当检查不应使条目更难被驱逐时使用此方法。

### expiresIn(key)

返回剩余生命周期（毫秒）、`Infinity`，如果键不存在则返回 `undefined`。

此方法不会将条目标记为最近使用，也不会触发惰性过期。当条目已过期但尚未被读取、写入或迭代移除时，它可能返回负数。

### resize(maxSize)

更改缓存容量并保留最新的条目。

### evict()

从较旧的缓存段中驱逐最旧的条目并调用 `onEviction`。

### entriesAscending()

从最近最少使用到最近最多使用进行迭代。

```js
for (const [key, value] of cache.entriesAscending()) {
  console.log(key, value);
}
```

### entriesDescending()

从最近最多使用到最近最少使用进行迭代。

## 设计说明

缓存使用双 `Map` 设计：

- `cache`：接收新写入和通过 `get()` 提升的条目。
- `oldCache`：保存上一代条目。

当当前段达到 `maxSize` 时，它变为旧段，之前的旧段被驱逐。这使得常规操作非常廉价：`get()`、`set()`、`has()` 和 `delete()` 保持接近原生 `Map` 操作，仅有较小的常量开销。

这种设计特意保持轻量级且对浏览器友好。它不使用定时器来移除过期条目；过期是惰性的，在读取、检查或迭代键时进行检查。
