# vanilla-lru 视频教程脚本

## 目标观众

有基础 JavaScript 经验，了解 `Map`，但没有系统实现过缓存结构的前端开发者。

## 视频结构

建议时长：20 到 30 分钟。

## 1. 开场：为什么要写一个 LRU

画面：浏览器应用中的接口缓存、搜索建议缓存、图片元数据缓存。

讲解要点：

- Web 前端经常需要保存最近使用的数据。
- 无限增长的缓存会带来内存风险。
- LRU 的目标是保留最近使用的数据，淘汰较久没有使用的数据。
- 本项目目标是轻量、零依赖、继承 `Map` 的 API，提供 LRU 缓存。

示例台词：

```text
这一节我们从零实现一个适合浏览器端使用的 LRU 缓存。它不是一个大型缓存系统，
而是一个小而清晰的工具：限制容量、支持过期、保留 Map 的使用体验。
```

## 2. API 预览

画面：展示 `docs/api.md` 中的基础示例。

讲解要点：

- `new Lru({ maxSize, maxAge, onEviction })`
- `set/get/has/delete/clear`
- `peek` 不更新最近使用顺序。
- `expiresIn` 查看剩余时间。
- `entriesAscending` 和 `entriesDescending` 用于调试和展示顺序。

代码片段：

```js
const cache = new Lru({ maxSize: 2 });

cache.set('a', 1);
cache.set('b', 2);
cache.get('a');
cache.set('c', 3);

console.log([...cache]); // [['a', 1], ['c', 3]]
```

## 3. 为什么继承 Map

画面：左侧展示 `Map` API，右侧展示 `Lru extends Map`。

讲解要点：

- 用户不需要学习一套完全陌生的 API。
- `instanceof Map` 成立。
- 迭代、`size`、链式 `set()` 都更自然。
- 函数式封装可以作为额外入口，但主实现用 class 更符合目标。

示例台词：

```text
如果我们只返回一个普通对象，也可以模拟 get 和 set，但它不是真正的 Map。
这个项目把 Map 兼容性作为核心目标，所以 class extends Map 是更稳妥的选择。
```

## 4. 双 Map 架构

画面：画两个区域，`oldCache` 和 `cache`。用箭头表示 set、get、rotate。

讲解要点：

- 新数据进入 `cache`。
- 老数据保存在 `oldCache`。
- 从 `oldCache` 命中的数据会移动到 `cache`。
- `cache.size >= maxSize` 时发生轮换。
- 轮换时旧的 `oldCache` 被淘汰，`cache` 变成新的 `oldCache`。

可视化流程：

```text
set(a), set(b)
cache: a, b
oldCache: empty

rotate
cache: empty
oldCache: a, b

get(a)
cache: a
oldCache: b

set(c)
cache: a, c
oldCache: b

rotate
evict b
oldCache: a, c
```

## 5. 过期控制

画面：展示每个 entry 内部保存 `{ value, expiry }`。

讲解要点：

- `maxAge` 是毫秒。
- 每次写入时计算绝对过期时间。
- 不使用定时器，而是读的时候惰性清理。
- 惰性清理更适合轻量工具和浏览器环境。

代码片段：

```js
const cache = new Lru({ maxSize: 10, maxAge: 1000 });

cache.set('message', 'hello');

setTimeout(() => {
  console.log(cache.get('message')); // undefined
}, 1200);
```

## 6. 测试讲解

画面：打开 `tests/lru.test.ts`。

讲解要点：

- 测 Map 兼容。
- 测 LRU 淘汰顺序。
- 测 `peek` 不更新顺序。
- 测过期。
- 测 `onEviction`。
- 测参数校验。

命令：

```bash
npm test
```

## 7. 构建与发布前检查

画面：终端运行命令。

命令：

```bash
npm test
npm run build
```

讲解要点：

- 源码入口在 `src/index.ts`。
- 产物输出到 `dist/`。
- 包入口由 `package.json` 的 `exports` 指定。

## 8. 结尾

讲解要点：

- 这个实现保持了小体积和零依赖。
- 双 Map 架构让代码量和运行成本都比较低。
- 适合浏览器端短生命周期缓存。
- 如果需要严格精确 LRU，可以进一步实现 Map 加双向链表版本。

示例结尾台词：

```text
到这里，我们已经完成了一个具有 Map API、容量控制、过期控制和淘汰回调的
轻量 LRU 缓存。它的重点不是堆功能，而是在浏览器里用最少的依赖和清晰的
数据结构解决真实缓存问题。
```
