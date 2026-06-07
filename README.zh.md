# Simple LRU Cache

`vanilla-simple-lru` 是一个零依赖的浏览器端 JavaScript LRU 缓存。导出的 `Lru` 类继承自原生 `Map`，因此保留了熟悉的 `Map` 接口，同时添加了有界容量、LRU 提升、可选过期和驱逐钩子功能。

## 打包结果

- `lru.mjs`: ESM 模块
- `lru.umd.js`: UMD 模块，GlobalName: `lru`

### 文档

- [Api文档](./docs/api_zh.md)
- [设计文档](./docs/design_zh.md)

## 测试

- 文件：`tests/lru.test.js`
- 运行：`vp test`

## 兼容

为了兼容我的之前的cache相关项目，因此保留了两个参数别名：`max`和`ttl`。对应关系：

- `max` -> `maxSize`
- `ttl` -> `maxAge`
