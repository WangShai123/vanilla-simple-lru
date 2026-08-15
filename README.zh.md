# Simple LRU Cache

`vanilla-simple-lru` 是一个零依赖的 JavaScript LRU 缓存。导出的 `Lru` 类继承自原生 `Map`，因此保留了熟悉的 `Map` 接口，同时添加了有界容量、LRU 提升、可选过期和驱逐钩子功能。也可以使用命名导出的 `createLru()` 工厂函数创建新实例。

[English](./README.md)

## 安装

npm:

```bash
npm install vanilla-simple-lru
```

script:

```html
<!-- esm 模块导入 -->
<script type="module">
  import { createLru } from 'https://unpkg.com/vanilla-simple-lru/dist/index.js';
  const cache = createLru({
    maxSize: 1000,
    maxAge: 1000 * 60 * 5,
    onEviction(key, value) {
      console.warn('已驱逐:', key, value);
    },
  });
</script>

<!-- umd 全局变量 vanillaSimpleLru -->
<script src="https://unpkg.com/vanilla-simple-lru/dist/index.umd.js"></script>
```

### 文档

- [Api](./docs/api_zh.md)
- [设计](./docs/design_zh.md)

## 兼容

为了兼容旧项目，因此保留了两个参数别名：`max`和`ttl`。对应关系：

- `max` -> `maxSize`
- `ttl` -> `maxAge`
