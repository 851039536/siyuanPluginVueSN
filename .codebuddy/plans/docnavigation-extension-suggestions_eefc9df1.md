---
name: docnavigation-extension-suggestions
overview: 基于 docNavigation 当前功能分析与思源官方 API 能力矩阵，提出 6 个可落地扩展方向，覆盖反向链接、搜索导航、元数据展示、文档大纲、标签过滤、文档树增强等场景。
design:
  styleKeywords:
    - 极简 Codex
    - 信息高密度
    - 下拉面板
    - 半透明元数据
    - 搜索过滤
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 12px
      weight: 500
    subheading:
      size: 10px
      weight: 500
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - "#8b5cf6"
      - "#7c3aed"
    background:
      - var(--b3-theme-background)
      - var(--b3-theme-surface-lighter)
    text:
      - var(--b3-theme-on-surface)
      - var(--b3-theme-primary)
    functional:
      - "#28a745"
      - "#6b7280"
todos:
  - id: add-api-wrappers
    content: 在 src/api.ts 封装 getBacklink/getBackmention/getDoc 3 个 API，新增 BacklinkItem/DocMeta 类型，DocNavSettings 扩展 filterKeywords 字段
    status: completed
  - id: extend-cache-and-fetch
    content: DocNavigationCache 新增 backlinkCache/metaCache 槽位，storage.ts 新增 fetchBacklinks/fetchDocMeta 数据获取函数
    status: completed
    dependencies:
      - add-api-wrappers
  - id: extend-composable
    content: useDocNavigation.ts 新增 backlinks/docMeta/filterKeywords 状态与 computed，loadHierarchy 内并行获取反链+元数据，升级 filteredChildDocs 为多关键词匹配
    status: completed
    dependencies:
      - extend-cache-and-fetch
  - id: create-backlink-dropdown
    content: 新建 BacklinkDropdown.vue + BacklinkDropdown.scss：触发按钮 + 搜索输入框 + 扁平链接列表 + 点击外部关闭 + Transition 动画
    status: completed
    dependencies:
      - extend-composable
  - id: create-meta-bar
    content: 新建 DocMetaBar.vue + DocMetaBar.scss：右对齐元数据信息条（相对更新时间 + 短日期创建时间 + 块数统计）
    status: completed
    dependencies:
      - extend-composable
  - id: integrate-ui-and-i18n
    content: DocNavContainer.vue 集成 BacklinkDropdown + DocMetaBar，"参考"下拉升级为"过滤"下拉，新增约 15 个 i18n 键 + 2 个图标 + README 更新
    status: completed
    dependencies:
      - create-backlink-dropdown
      - create-meta-bar
---

## 产品概述

在现有 docNavigation 功能基础上扩展 3 个新能力，将导航栏从简单层级导航升级为上下文感知的文档探索器。所有新增功能通过 computed 条件渲染，完全向后兼容。

## 核心扩展

### 1. 反向链接导航面板

在导航栏新增「反向链接 (N)」下拉按钮，展示所有引用/提及了当前文档的文档列表，支持面板内搜索过滤。数据来自 SiYuan 内核级反链 API（`getBacklink` + `getBackmention`），截断上限 50 条。编辑区内即可看到"谁关联了我"，无需切到侧边栏反链面板。下拉面板复用 ChildDocDropdown 的外壳模式（触发按钮 + Transition 动画 + 点击外部关闭 + Codex 大写标题），内容为扁平链接列表。

### 2. 文档元数据信息条

在导航栏最右侧展示当前文档的关键元数据：最后更新时间（相对时间如"3 天前"）、创建时间（短日期如"08-08"）、文档块数统计。数据来自 `getDoc(id)` API，在 `loadHierarchy` 时并行获取一次，缓存 60s。低开销，用户一眼即可判断文档修改历史和规模。布局紧凑，使用辅助字号（`$font-size-2xs`），不干扰主导航。

### 3. 可配置的子文档关键词过滤

升级现有的硬编码「参考」过滤（仅支持中文 `doc.content.includes("参考")`）为可配置的多关键词过滤。`DocNavSettings` 新增 `filterKeywords` 字段（默认值 `["参考"]`），保持向后兼容。将「参考」下拉的触发文本改为「过滤 (N)」，下拉面板标题改为「过滤结果」，支持多语言场景。未来可在设置面板中配置关键词列表。

## 技术栈

- 框架：Vue 3 + TypeScript（现有项目技术栈）
- 样式：SCSS + 设计 Token（Codex 风格，`@/variables.scss`）
- API：SiYuan Kernel API（通过 `fetchSyncPost` 封装在 `src/api.ts`）
- 存储：TypedStorage（持久化设置）+ DocNavigationCache（内存缓存，TTL 60s）

## 实现方案

### 总体策略

采用**增量扩展**模式——不改动现有数据流和组件结构，仅新增计算属性和子组件。所有新 API 在 `loadHierarchy` 中与现有数据并行获取，不影响面包屑/层级加载速度。新增组件自包含（自管理面板开关状态 + document click 外部关闭），父容器仅传必要 props。

### 数据流设计

```
loadHierarchy(docId)
  ├─ getPathByID(docId)           ← 已有
  ├─ Promise.all([
  │    fetchDocHierarchy(...),     ← 已有
  │    fetchBreadcrumb(...),       ← 已有
  │    fetchSiblingDocs(...),      ← 已有
  │    fetchBacklinks(...),        ← NEW：反链数据
  │    fetchDocMeta(...),          ← NEW：元数据
  │  ])
  └─ 结果注入 ref → computed 驱动组件渲染
```

### 关键设计决策

- **并行加载**：新增的 `fetchBacklinks` 和 `fetchDocMeta` 与现有 3 个 fetch 合并到同一个 `Promise.all`，不增加串行等待时间
- **缓存独立 TTL**：反链数据和元数据各使用独立缓存槽位，过期策略与现有缓存一致（60s TTL + LRU 驱逐）
- **截断策略**：反链数据量可能较大（文档被大量引用时），前端截断为 50 条 + 面板内搜索过滤，避免 UI 卡顿
- **过滤升级零破坏**：`filterKeywords` 默认值为 `["参考"]`，与当前硬编码行为完全一致；未来可通过设置面板扩展

## 目录结构

```
src/
├── api.ts                                                          # [MODIFY] 新增 getBacklink/getBackmention/getDoc 3 个 API 封装
├── config/
│   └── icons.ts                                                    # [MODIFY] FEATURE_ICONS 新增 docNavBacklink/docNavMeta 图标
├── i18n/
│   ├── zh_CN/
│   │   └── docNavigation.json                                      # [MODIFY] 新增约 15 个翻译键
│   └── en_US/
│       └── docNavigation.json                                      # [MODIFY] 新增约 15 个翻译键
└── features/
    └── docNavigation/
        ├── README.md                                               # [MODIFY] 补充新功能特性
        ├── types/
        │   ├── index.ts                                            # [MODIFY] 新增 BacklinkItem/DocMeta 类型，DocNavSettings 扩展 filterKeywords
        │   └── storage.ts                                          # [MODIFY] DocNavigationCache 新增 backlinkCache/metaCache 槽位 + fetchBacklinks/fetchDocMeta 函数
        ├── composables/
        │   └── useDocNavigation.ts                                 # [MODIFY] 新增 backlinks/docMeta/filterKeywords 状态 + hasBacklinks/hasMeta computed + loadHierarchy 内并行获取
        ├── components/
        │   ├── DocNavContainer.vue                                 # [MODIFY] 集成 BacklinkDropdown + DocMetaBar，升级 filteredChildDocs 使用 filterKeywords
        │   ├── BacklinkDropdown.vue                                # [NEW] 反向链接下拉面板：触发按钮 + 搜索输入框 + 扁平链接列表 + 点击外部关闭
        │   └── DocMetaBar.vue                                      # [NEW] 元数据信息条：更新时间 + 创建时间 + 块数统计
        └── styles/
            ├── index.scss                                          # [MODIFY] 新增 doc-meta-bar 样式
            ├── BacklinkDropdown.scss                               # [NEW] 反向链接面板样式（复用 ChildDocDropdown 外壳 + 搜索框样式）
            └── DocMetaBar.scss                                     # [NEW] 元数据信息条样式
```

## 关键代码结构

### 新增类型定义（types/index.ts）

```typescript
// 反向链接条目
export interface BacklinkItem {
  id: string
  content: string
  hpath: string
  box?: string
}

// 文档元数据
export interface DocMeta {
  created: string   // YYYYMMDDHHMMSS
  updated: string   // YYYYMMDDHHMMSS
  count: number     // 块数
  icon: string      // emoji 图标
  memo: string      // 备注
  size: number      // 文件大小（字节）
}

// DocNavSettings 扩展
export interface DocNavSettings {
  maxVisibleChildren: number
  position: "top" | "bottom"
  filterKeywords: string[]  // [NEW] 子文档过滤关键词列表，默认 ["参考"]
}
```

### 新增 API 封装（src/api.ts）

```typescript
// 获取反向链接文档
export async function getBacklink(id: BlockId): Promise<{ files: IFile[] } | null>
// 获取反向提及文档
export async function getBackmention(id: BlockId): Promise<{ files: IFile[] } | null>
// 获取文档详情（含元数据）
export async function getDoc(id: BlockId, mode?: number): Promise<DocDetail | null>
```

### Composables 扩展（useDocNavigation.ts）

```typescript
// 新增返回字段
interface UseDocNavigationReturn {
  // ... 现有字段保持不变 ...
  backlinks: Ref<BacklinkItem[]>        // 反链文档列表
  backlinkCount: ComputedRef<number>    // 反链数量
  hasBacklinks: ComputedRef<boolean>    // 是否有反链
  docMeta: Ref<DocMeta | null>          // 文档元数据
  hasMeta: ComputedRef<boolean>         // 是否有元数据
  filterKeywords: Ref<string[]>         // 过滤关键词列表（从设置加载）
}
```

## 实现注意事项

- **性能**：反链 API 返回可能包含大量条目，前端截断为 50 条并在面板内提供本地搜索过滤（`computed` 按 content 模糊匹配），避免额外的 API 调用
- **缓存隔离**：反链缓存与现有层级缓存在 DocNavigationCache 中独立管理，`clearAll()` 统一清理
- **时间格式化**：新增 `formatRelativeTime(iso: string): string` 纯函数放在 `types/index.ts`（共享工具），显示规则——7 天内显示"X 天前"，超过 7 天显示"MM-DD"
- **向后兼容**：`filterKeywords` 默认值 `["参考"]` 确保现有行为不变；`DEFAULT_NAV_SETTINGS` 新增字段后，`TypedStorage.loadOrDefault()` 自动合并默认值
- **i18n 规则**：仅修改分片文件（`zh_CN/docNavigation.json` + `en_US/docNavigation.json`），顶层合并文件由 `pnpm i18n:merge` 自动生成
- **图标注册**：`docNavBacklink`（`mdi:link-variant`，颜色 `#8b5cf6` 同系列）、`docNavMeta`（`mdi:information-variant`，颜色 `#8b5cf6`），图标选择与现有 docNav* 系列保持视觉一致

## 设计风格

延续现有 Codex 设计体系，新增组件完全复用现有下拉面板外壳和设计 Token。核心原则：极简克制，信息密度高但不拥挤。

### 页面区块设计（从上到下）

**1. 面包屑导航行（已有，不变）**
Root / Parent / Current 的逐级路径，可点击跳转，当前项加粗高亮。

**2. 导航按钮行（扩展后）**
从左到右排列：上级文档链接（面包屑无时显示）→ 同级下拉 → 下级文档下拉 → 过滤下拉 → 反向链接下拉 → DocMetaBar（右对齐）。各按钮采用相同外壳：图标 + 文字 (N) + 三角箭头，间距 `$spacing-2`，flex-wrap 自动换行。

**3. 反向链接下拉面板**
打开后显示在按钮下方，绝对定位：面板顶部「反向链接 (N)」大写字幕标题 + 分隔线，下方为搜索过滤输入框（placeholder "搜索..."，等宽字体 10px），再下方为扁平文档链接列表（28px 行高，hover 变底色，点击跳转）。面板最大高度 280px 可滚动，无匹配时显示"无结果"占位文。

**4. 文档元数据信息条**
位于导航行最右侧（`margin-left: auto`），辅助字号 10px，半透明文字颜色。格式：`01-15 创建 · 08-08 更新 · 42 块`，各项用 `·` 分隔。hover 时显示完整 tooltip（含完整时间戳和文件大小）。

### 交互效果

- 下拉触发按钮：hover 显示主色最淡底色（`--b3-theme-primary-lightest`），active 缩放 0.97
- 下拉面板：Transition 150ms 淡入淡出 + 向上 4px 位移
- 反向链接搜索：输入即时过滤列表项（computed 响应式，无 debounce），高亮匹配文本
- 元数据栏：静态展示，hover 时 `opacity: 0.7 → 1`

## 代理扩展

### Skill

- **grill-me**
- 用途：对每个扩展方向进行严苛面试式审查，验证 API 可用性、性能边界、UI 复杂度、与现有架构的贴合度，筛除不成熟或过度设计的方案
- 预期结果：确认 3 个扩展方向（反链面板/元数据条/可配置过滤）均通过架构审查，无阻塞性问题，工作量可控