---
name: docNavigation 增加文档发布状态徽章
overview: 在 docNavigation 导航栏顶部（面包屑旁）为当前文档新增「已发布/未发布」双态徽章，判定标准与 docAnalysis 一致（存在任一 custom-&lt;平台&gt;-yaml 属性且值非空即已发布），由 DocNavSettings.enablePublishStatus 开关控制（默认开启）。
todos:
  - id: add-publish-types
    content: 在 types/index.ts 增加 DocMeta.published 与 DocNavSettings.enablePublishStatus（默认 true），utils.ts 新增 hasPublishYamlAttr 判定函数
    status: completed
  - id: extend-fetch-meta
    content: 扩展 fetchDocMeta：Promise.all 增加 getBlockAttrs，经 hasPublishYamlAttr 计算 published 写入 DocMeta 并走缓存
    status: completed
    dependencies:
      - add-publish-types
  - id: add-badge-ui
    content: DocNavContainer.vue 加载 enablePublishStatus 设置，在面包屑旁渲染已发布/未发布双态徽章
    status: completed
    dependencies:
      - extend-fetch-meta
  - id: badge-styles-icons-i18n
    content: styles/index.scss 新增徽章样式（$color-success/$color-muted），icons.ts 注册 docNavPublished/docNavUnpublished，i18n 分片同步新增键
    status: completed
    dependencies:
      - add-badge-ui
  - id: update-readme
    content: 更新 docNavigation README.md 功能说明，提示用户运行 pnpm i18n:verify / validate:icons / tsc 验证
    status: completed
    dependencies:
      - add-badge-ui
---

## 产品概述

在 docNavigation 文档导航栏顶部（面包屑旁/文档标题区域）为当前文档增加「是否已发布」状态徽章，参考 docAnalysis 的发布状态判定机制。

## 核心功能

- **判定标准（同 docAnalysis 平台属性机制）**：当前文档属性中存在任一 `custom-<平台>-yaml`（值非空，如 `custom-csdn-yaml`、`custom-juejin-yaml`）即视为已发布
- **显示形式**：双态徽章常驻显示——已发布（绿色）+ 未发布（灰色），置于导航栏面包屑旁、最醒目位置
- **设置开关**：在 DocNavSettings 中新增 `enablePublishStatus`（默认 true），由 DocNavSettingsStorage 持久化，可关闭该显示
- **性能**：发布状态随 `fetchDocMeta` 并行获取并复用现有 60s TTL 缓存，不增加额外请求链路

## 技术栈

- Vue 3 + TypeScript + SCSS（沿用 docNavigation 现有架构与设计 Token）
- 思源 API：`getBlockAttrs`（`@/api`，docAnalysis 已同款使用）读取文档属性
- 持久化：`TypedStorage`（DocNavSettingsStorage，与 position/filterKeywords 同机制）

## 实现方案

### 判定逻辑（泛化形状判定，而非跨模块导入）

项目硬规则「功能模块之间禁止直接相互导入」+ 平台列表在 docAnalysis 中可动态配置（PlatformManageModal），故 **不导入** docAnalysis 的 `platformPublish.ts` / `platformMeta`，而是在 docNavigation 的 `utils.ts` 新增纯函数 `hasPublishYamlAttr(attrs)`：扫描属性键，小写后 `startsWith("custom-") && endsWith("-yaml")` 且值非空即判定已发布。这与用户确认的标准「存在任一 custom-<平台>-yaml 属性（值非空）即视为已发布」完全一致，且天然兼容用户自定义平台，避免静态复制漂移。

### 数据链路

`DocNavContainer` 挂载 → `useDocNavigation.loadHierarchy()` → Promise.all 并行拉取层级/面包屑/同级/反链/元数据 → 扩展 `fetchDocMeta` 的 Promise.all 增加 `getBlockAttrs(docId)` → `hasPublishYamlAttr` 计算 `published` 写入 `DocMeta` → 复用现有 metaCache（60s TTL + LRU）缓存 → 模板中按 `enablePublishStatus && hasMeta` 渲染双态徽章。

### 关键决策

- 徽章放 `.doc-navigation` flex 行最前端（面包屑左侧），贴近文档标题下方，醒目且不破坏现有布局（DocMetaBar 保持右对齐不动）
- `enablePublishStatus` 落在存储层（默认 true）：docNavigation 目前无通用设置面板（仅 FilterKeywordsEditor 内联编辑），与 `position`/`maxVisibleChildren` 的纯存储层配置方式保持一致
- 图标走 IconWrapper + FEATURE_ICONS 注册（docNavPublished = mdi:cloud-check、docNavUnpublished = mdi:cloud-outline），图标色走配置色，文字色由 SCSS 语义 Token 控制
- 徽章为双态常驻：`docMeta.published` 有值即显示（meta 获取失败时 hasMeta 为 false，徽章自然隐藏，不出现错误态）

## 实施注意事项

- **禁止跨 feature 导入**：判定逻辑在 docNavigation 内自实现，不引用 docAnalysis 任何模块
- **缓存一致性**：`published` 作为 `DocMeta` 必填字段加入构造与缓存条目（缓存为内存级，插件重载即清空，无旧数据兼容问题）
- **i18n 只改分片**：`src/i18n/{zh_CN,en_US}/docNavigation.json` 同步新增 `docNavPublished`/`docNavUnpublished`，禁改顶层合并 JSON
- **图标注册**：`src/config/icons.ts` 的 FEATURE_ICONS 新增 2 个键，`pnpm validate:icons` 校验
- **样式规范**：禁硬编码字号/颜色/box-shadow，用 `$font-size-2xs`、`$line-height-tight`、`$radius-sm`、`$spacing-*`、`$color-success`（绿）、`$color-muted`（灰）、`$color-border`
- 验证由用户执行：`pnpm i18n:verify`、`pnpm validate:icons`、`npx tsc --noEmit`

## 架构设计

### 数据流

```
protyle 事件 → index.ts 防抖 → DocNavContainer 挂载
  → useDocNavigation.loadHierarchy(docId)
      → Promise.all[fetchDocHierarchy, fetchBreadcrumb, fetchSiblingDocs, fetchBacklinks, fetchDocMeta]
          → fetchDocMeta: Promise.all[getDoc, sql 块数, getBlockAttrs(docId)]
              → hasPublishYamlAttr(attrs) → DocMeta.published
              → setCachedMeta（60s TTL）
  → 模板渲染：enablePublishStatus && hasMeta → 双态徽章（面包屑旁）
```

- 组件关系：`DocNavContainer.vue`（新增徽章 + 设置加载）→ `DocMetaBar.vue`（不动）→ `types/storage.ts`（fetchDocMeta 扩展）→ `utils.ts`（判定函数）→ `types/index.ts`（类型）
- 无新架构模式引入，全部沿用模块内既有三层分层（types / utils / 视图）

## 目录结构

```
src/features/docNavigation/
├── types/index.ts                          # [MODIFY] DocMeta 增加 published: boolean（必填）；DocNavSettings 增加 enablePublishStatus: boolean；DEFAULT_NAV_SETTINGS 增加 enablePublishStatus: true
├── types/storage.ts                        # [MODIFY] fetchDocMeta 的 Promise.all 增加 api.getBlockAttrs(currentDoc.id)，经 hasPublishYamlAttr 计算 published 写入 DocMeta 构造（自动走 metaCache 缓存）
├── utils.ts                                # [MODIFY] 新增 hasPublishYamlAttr(attrs: Record<string,string>|null|undefined): boolean — 扫描 custom-*-yaml 键且值非空即返回 true（与 docAnalysis 平台属性语义一致）
├── components/DocNavContainer.vue          # [MODIFY] 新增 enablePublishStatus ref（默认取 DEFAULT_NAV_SETTINGS），onMounted 从 DocNavSettingsStorage 加载；模板在面包屑前渲染双态徽章（IconWrapper + i18n 文案，v-if="enablePublishStatus && hasMeta"）
├── styles/index.scss                       # [MODIFY] 新增 .doc-nav-publish-badge（inline-flex + gap + radius-sm + font-size-2xs），.is-published 用 $color-success、.is-unpublished 用 $color-muted，border 分隔、禁 box-shadow
└── README.md                               # [MODIFY] 功能列表补充发布状态徽章说明

src/config/icons.ts                         # [MODIFY] FEATURE_ICONS 新增 docNavPublished(mdi:cloud-check) 与 docNavUnpublished(mdi:cloud-outline)，沿用 #8b5cf6 紫色系
src/i18n/zh_CN/docNavigation.json           # [MODIFY] 新增 docNavPublished:"已发布"、docNavUnpublished:"未发布"
src/i18n/en_US/docNavigation.json           # [MODIFY] 新增 docNavPublished:"Published"、docNavUnpublished:"Unpublished"
```

## 关键代码结构

```ts
// utils.ts — 发布状态判定（纯函数，与 docAnalysis 平台属性语义一致，无跨模块依赖）
export function hasPublishYamlAttr(attrs: Record<string, string> | null | undefined): boolean

// types/index.ts — 类型扩展
interface DocMeta {
  created: string
  updated: string
  count: number
  icon: string
  memo: string
  size: number
  /** 是否已发布到至少一个平台（存在 custom-<平台>-yaml 属性且值非空） */
  published: boolean
}
interface DocNavSettings {
  maxVisibleChildren: number
  position: "top" | "bottom"
  filterKeywords: string[]
  /** 是否显示当前文档的发布状态徽章 */
  enablePublishStatus: boolean
}
```