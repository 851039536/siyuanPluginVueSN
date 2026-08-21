# AGENTS_BUILD.md

构建与验证流程、viteStaticCopy 资源复制规则与依赖清单。

## 构建与验证

> **重要**：AI 不得执行 `pnpm vite build` 和 `pnpm lint`。这些验证由用户自行完成。AI 仅负责编写代码，用户自行验证构建和 lint。

常见 Vite 警告：

| 警告 | 原因 | 处理 |
|------|------|------|
| `is dynamically imported by ... but also statically imported` | 某模块同时被静态和动态导入 | 改为统一静态 `import` |

## 强制规则：viteStaticCopy 静态资源复制必须 stripBase

用 `viteStaticCopy` 复制**位于 src 子目录内的静态资源**（字体、图片等）到插件目录时，`dest` 会附加源路径的**完整目录结构**，导致产物路径变为 `dest/src/features/.../原文件名` 的嵌套结构，而运行时按 `${assetsPath}/fonts/xxx` 引用时 404。

**必须添加 `rename: { stripBase: true }`** 让输出扁平化：

```ts
{
  src: "./src/features/generalSettings/assets/fonts/LXGWWenKai-Regular.ttf",
  dest: "./assets/fonts/",
  rename: { stripBase: true },  // ← 必须：否则产物是 assets/fonts/src/features/.../xxx.ttf
},
```

**验证方式**（构建后检查产物路径）：

```bash
Get-ChildItem "{workspace}\data\plugins\{pluginName}\assets" -Recurse -Filter "*.ttf"
# 期望：...\assets\fonts\LXGWWenKai-Regular.ttf（扁平）
# 若出现 ...\assets\fonts\src\features\...\ 嵌套 → 缺 stripBase
```

**关键认知**：
- `vite build --watch` 模式下**修改 `vite.config.ts` 不会自动重启**，必须重启 `pnpm dev` 才能加载新配置；否则构建产物仍是旧配置路径（表现为"改了配置但产物没变"）
- 内置字体等大体积静态资源会增加插件包体积，需在功能设计时评估

## 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Vue | ^3.3.8 | 前端框架 |
| TypeScript | ^5.0.4 | 类型系统 |
| Vite | ^6.2.1 | 构建工具 |
| siyuan | 1.1.0 | Siyuan API 类型 |
| sass | ^1.62.1 | SCSS 编译（dev） |
| eslint | ^9.22.0 | 代码检查（dev / @antfu/eslint-config） |
