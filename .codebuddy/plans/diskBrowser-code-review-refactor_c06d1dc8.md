---
name: diskBrowser-code-review-refactor
overview: 对 src/features/diskBrowser 模块进行代码审查与重构：修复 CLAUDE.md 违规、删除死代码、合并冗余、优化性能，并提供功能扩展建议。
todos:
  - id: fix-storage-dual-instance
    content: 修复 Storage 双重实例化：将 DiskBrowserStorage 改为单例通过 props 传入 composable
    status: completed
  - id: fix-vue-event-naming
    content: 修复 Vue 事件命名：FolderList.vue 中 kebab-case 改为 camelCase，同步 index.vue
    status: completed
  - id: remove-dead-code
    content: 删除死代码：移除 utils/index.ts 中 isNetworkSlow() 及相关网络逻辑
    status: completed
  - id: refactor-favoriteset-computed
    content: favoriteSet 改为 computed 派生状态，移除手动同步代码
    status: completed
    dependencies:
      - fix-storage-dual-instance
  - id: fix-spinwait-queue
    content: 修复 spin-wait 反模式：retryExec 改用 Promise 链式队列替代忙等轮询
    status: completed
  - id: dedup-scss-cachetag
    content: SCSS 样式去重：提取 cache-tag-base mixin，消除两处重复样式
    status: completed
  - id: fix-type-assertions-global-style
    content: 修复 index.ts 类型断言和 styles/index.scss 全局样式引用
    status: completed
---

## 用户需求

对 `src/features/diskBrowser/` 模块进行全面的 TypeScript/SCSS 代码审查与重构：

- 识别并合并冗余代码（重复逻辑、死代码、冗余状态）
- 评估并实施性能优化
- 修复所有 CLAUDE.md 编码规范违规
- 在不影响现有功能逻辑的前提下完成重构
- 给出功能扩展建议

## 审查范围

共 11 个文件：`index.ts`、`index.vue`、`composables/useDiskBrowser.ts`、`types/index.ts`、`types/storage.ts`、`utils/index.ts`、`styles/index.scss` 及 5 个 Vue 组件。

## 核心发现

- **2 项 CLAUDE.md 硬违规**：Storage 双重实例化 + Vue 事件命名 kebab-case
- **1 处死代码**：`isNetworkSlow()` 网络速度检测函数在纯本地磁盘场景完全无意义
- **1 处冗余状态**：`favoriteSet` 作为独立 ref 需手动同步
- **1 处性能反模式**：spin-wait 忙等待
- **1 处样式重复**：两处几乎相同的 cache-tag 样式规则

## 技术栈

- TypeScript 5 + Vue 3 Composition API
- SCSS（scoped + Codex 风格变量/mixins）
- 思源笔记插件 API（siyuan Plugin）

## 重构方案

### 1. Storage 双重实例化修复（CLAUDE.md 违规）

**问题**：`DiskBrowserStorage` 在 `index.ts` 的 `registerDiskBrowser()` 中 `new DiskBrowserStorage(plugin)` 并调用 `init()`，同时在 `useDiskBrowser.ts` 中又 `new DiskBrowserStorage(plugin)` 创建第二个实例。CLAUDE.md 明确规定「禁止两个组件各自实例化 Storage」。

**方案**：在 `index.ts` 中创建 `storage` 单例，通过 props 传入 `index.vue`，再由 `useDiskBrowser` composable 接收。修改 `createVueDockApp` 调用传入 `extraProps: { storage }`，`index.vue` 的 Props 增加 `storage: DiskBrowserStorage`，`useDiskBrowser` 改为接收 `storage` 参数而非内部 `new`。

### 2. Vue 事件命名规范修复

**问题**：`FolderList.vue` 有三个 kebab-case emit：`item-dblclick`、`toggle-favorite`、`copy-path`。CLAUDE.md 硬规则「emit 事件必须 camelCase」。

**方案**：改为 `itemDblclick`、`toggleFavorite`、`copyPath`，同步更新 `index.vue` 模板中的 `@` 事件绑定。`index.vue` 模板语法支持 kebab-case 监听器自动转换，但对于显式定义，统一使用 camelCase 保持一致性。

### 3. 删除死代码 `isNetworkSlow()`

**问题**：`utils/index.ts` 中 `isNetworkSlow()` 检查 `navigator.connection.effectiveType` 网络速度，但 diskBrowser 访问的是本地磁盘（通过 PowerShell 命令），完全不涉及网络。该函数及 `getCacheExpiryTime()` 中的网络分支是无意义的死代码。

**方案**：删除 `isNetworkSlow()` 函数及 `cachedNetworkSlow` 模块变量。将 `getCacheExpiryTime()` 简化为直接返回固定缓存时间（60 分钟）。同时 `isNetworkSlow` 的模块级缓存变量 `cachedNetworkSlow` 也随之移除。

### 4. 冗余状态 `favoriteSet` 改为 computed

**问题**：`favoriteSet` 是独立 `ref(new Set<string>())`，需要在 `loadFavorites()` 和 `toggleFavorite()` 中手动调用 `updateFavoriteSet()` 同步，增加维护负担且存在不同步风险。

**方案**：将 `favoriteSet` 改为 `computed(() => new Set(favoriteFolders.value))`，删除 `updateFavoriteSet()` 函数。`FolderList.vue` 中当前接收 `favoriteSet: Set<string>` prop，改为接收 `favoriteFolders: string[]`，将 `isFavorite()` 判断逻辑移入 composable 并以函数形式暴露，或直接在组件内使用 `props.favoriteFolders.includes(path)`。

### 5. Spin-wait 性能反模式修复

**问题**：`retryExec()` 中 `while (isExecutingCommand) { await new Promise(resolve => setTimeout(resolve, 100)) }` 是忙等待，不高效。

**方案**：使用 Promise 链式队列替代忙等待。维护一个 `execQueue: Promise<void>` 变量，每次调用 `retryExec` 时将实际执行链入队列 `.then(() => execWithTimeout(...))`。这样前一个命令完成后自动执行下一个，无需轮询。

### 6. SCSS 样式去重

**问题**：`PanelHeader.vue` 的 `.cache-tag` 和 `FolderList.vue` 的 `.cache-tag-small` 几乎完全相同（font-family: $mono, font-size: 10px, font-weight: 600, padding: 1-2px 6-8px, border-radius: 3px, white-space: nowrap）。

**方案**：在 `styles/index.scss` 中新增 `@mixin cache-tag-base`，两个组件使用 `@include cache-tag-base;` 替代重复样式规则，各自覆盖差异属性（如 `.cache-tag` 的 `letter-spacing: 0.04em` 和 `.cache-tag-small` 的细微 padding 差异）。

### 7. 类型断言优化

**问题**：`index.ts` 中 `(plugin.i18n as any).diskBrowser`。

**方案**：在 `types/index.ts` 中扩展类型定义，使用 `DiskBrowserI18n` 接口描述 i18n 结构，在 `index.ts` 中使用 `plugin.i18n as { diskBrowser: DiskBrowserI18n }` 替代 `as any`。

### 8. 全局样式引用

**问题**：`styles/index.scss` 未引用 `@use "@/index.scss" as *;`。

**方案**：在文件头部添加该引用，确保 Codex 全局变量可用。

## 目录结构变更

```
src/features/diskBrowser/
├── index.ts                  # [MODIFY] 单例 Storage 通过 props 传入，类型断言优化
├── index.vue                 # [MODIFY] Props 增加 storage，事件名更新
├── composables/
│   └── useDiskBrowser.ts     # [MODIFY] 接收 storage 参数，删除内部 new；favoriteSet→computed；修复 spin-wait
├── types/
│   └── index.ts              # [MODIFY] DiskBrowserI18n 类型增强
├── utils/
│   └── index.ts              # [MODIFY] 删除 isNetworkSlow()，getCacheExpiryTime() 简化
├── styles/
│   └── index.scss            # [MODIFY] 添加 @use "@/index.scss" as *; 新增 cache-tag-base mixin
├── components/
│   ├── FolderList.vue        # [MODIFY] kebab-case → camelCase；favoriteSet prop → favoriteFolders；cache-tag 使用 mixin
│   ├── PanelHeader.vue       # [MODIFY] cache-tag 使用 mixin
│   └── FavoritesSection.vue  # 无需修改（已合规）
```

## 性能优化要点

- **并发控制**：Promise 链式队列替代 spin-wait，消除 100ms 轮询开销
- **响应式优化**：`favoriteSet` 从独立 ref+手动同步改为 `computed`，减少不必要响应式追踪
- **死代码清理**：移除 `isNetworkSlow()` 减少模块初始化计算

## 功能扩展建议

1. **文件搜索/过滤**：在 FolderList 头部增加搜索输入框，支持按文件名实时过滤
2. **路径历史导航**：添加前进/后退按钮，维护导航历史栈
3. **多选批量操作**：支持 Ctrl/Shift 多选文件夹/文件，批量复制路径或打开
4. **自定义缓存时间**：将缓存时间从硬编码改为用户可配置选项
5. **文件夹大小递归计算**：对文件夹支持递归计算总大小（可异步后台计算）
6. **拖拽排序收藏夹**：支持拖拽调整收藏夹中文件夹的顺序
7. **深色/浅色主题自适应**：当前已使用 CSS 变量适配，可增加手动切换入口
