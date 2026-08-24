---
name: websiteNavigation 冗余清理
overview: 清理 websiteNavigation 模块内部冗余：删除薄 re-export 兼容层（types/constants.ts、types/storage.ts）并改为直接导入共享层，移除 useWebsiteNavigation 未消费的返回对象、内联 categoriesMap、移除 handleCategoriesSaved 的冗余 loadData。
todos:
  - id: remove-reexport-layer
    content: 删除 constants.ts/storage.ts 并精简 types/index.ts 的 re-export
    status: completed
  - id: refactor-composable
    content: 重构 useWebsiteNavigation.ts：改 sharedStorage 导入、删 categoriesMap、去返回对象
    status: completed
    dependencies:
      - remove-reexport-layer
  - id: update-panel
    content: 更新 index.vue 导入并移除 handleCategoriesSaved 与 @saved 绑定
    status: completed
    dependencies:
      - remove-reexport-layer
  - id: update-child-components
    content: 更新 4 个子组件导入路径并清理 CategoryManager 的 saved 死事件
    status: completed
    dependencies:
      - remove-reexport-layer
---

## 用户需求

审查并清理 `websiteNavigation` 模块内部冗余，不涉及 `minimalBrowser` 模块。

## 清理范围

- 删除薄 re-export 兼容层 `types/constants.ts`、`types/storage.ts`，组件与数据层改从 `@/utils/sharedStorage/websiteStorage` 直接导入。
- 移除 `useWebsiteNavigation()` 从未被消费的返回对象。
- 删除独立导出但仅被 `getCategoryById` 使用的 `categoriesMap`，`getCategoryById` 改用 `categories.value.find`。
- 移除 `index.vue` 中 `handleCategoriesSaved` 的冗余 `loadData()`（分类增删已在 composable 内更新内存态）。
- 清理 `CategoryManager` 中父组件不再监听的 `saved` 死事件。

## 视觉与交互

纯逻辑重构，无 UI 变更。保存/删除/添加网址、分类管理与筛选行为保持原样。

## 技术栈

- 现有项目技术栈不变：Vue 3 + TypeScript + SCSS。
- 不新增依赖，不改变存储键与数据模型（`src/utils/sharedStorage/websiteStorage.ts` 保持不变）。

## 实现方案

### 核心策略

1. **消除转发层**：删除 `types/constants.ts` 与 `types/storage.ts` 两个纯 re-export 文件；`types/index.ts` 移除类型与常量的 re-export，仅保留 `I18n` 接口与 `WebsiteNavigation` Manager 类。所有消费者改从共享层直接导入。
2. **收敛数据层接口**：`useWebsiteNavigation(plugin)` 只负责初始化单例 Storage 与 `onMounted` 加载数据，不再返回任何对象（`index.vue` 本就不接收返回值）；模块级导出的 `entries`/`categories`/CRUD 函数继续供子组件直接 import。
3. **简化分类查找**：删除 `categoriesMap` computed，`getCategoryById` 直接 `categories.value.find((c) => c.id === id)`。
4. **移除冗余刷新**：删除 `index.vue` 的 `handleCategoriesSaved` 与 `@saved` 绑定，分类筛选回退已由 `watch(categories)` 兜底；同步移除 `CategoryManager` 中不再被监听的 `saved` emit。

### 关键决策

- 删除 re-export 层会改动 6 个文件的导入路径，但换来单一数据源、消除两层转发，符合项目「模块内共享常量/类型沉淀到共享层」的分层原则。
- 保留 `I18n` 从 `../types` 导入（`I18n` 是 websiteNavigation 专属接口，不属共享层）。
- 保留 `loadData` 模块级函数导出（`useWebsiteNavigation` 内部 `onMounted` 仍调用），仅移除 `index.vue` 对其的外部导入与 `handleCategoriesSaved`。

## 修改文件清单

```
src/features/websiteNavigation/
├── types/
│   ├── constants.ts          # [删除] 纯 re-export，无真实实现
│   ├── storage.ts            # [删除] 纯 re-export，无真实实现
│   └── index.ts              # [修改] 移除类型/常量 re-export，仅保留 I18n + WebsiteNavigation 类
├── composables/
│   └── useWebsiteNavigation.ts  # [修改] 导入改 sharedStorage；删 categoriesMap；getCategoryById 用 find；useWebsiteNavigation 去返回对象；移除 computed 导入
├── index.vue                 # [修改] ALL_CATEGORY_ID 改 sharedStorage；删 loadData 导入；删 handleCategoriesSaved 与 @saved 绑定
└── components/
    ├── WebsiteDialog.vue     # [修改] CreateWebsiteDTO/WebsiteEntry/DEFAULT_CATEGORY_ID 改 sharedStorage
    ├── WebsiteCard.vue       # [修改] WebsiteEntry/DEFAULT_CATEGORY_COLOR/DEFAULT_CATEGORY_ID 改 sharedStorage
    ├── CategoryManager.vue   # [修改] DEFAULT_CATEGORY_ID/PRESET_CATEGORY_COLORS 改 sharedStorage；删 saved emit
    └── FilterBar.vue         # [修改] WebsiteCategory/ALL_CATEGORY_ID/DEFAULT_CATEGORY_COLOR 改 sharedStorage
```

## 实施要点

- `PanelHeader.vue` 仅依赖 `I18n`，无需改动。
- `types/index.ts` 更新文件头注释，说明类型/常量已下沉至共享存储层。
- 删除 `categoriesMap` 后，`useWebsiteNavigation.ts` 的 vue 导入去掉 `computed`（避免未使用导入）。
- 不执行 `pnpm lint` / `pnpm vite build`，由用户自行验证；完成后仅做 `read_lints` 确认无新增类型错误。