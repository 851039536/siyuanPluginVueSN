---
name: docAnalysis-HeroCard-健康度扣分项配置
overview: 将 StatsView 的 Hero 汇总卡提取为独立组件 HeroCard，健康度信息图标从 title 悬浮改为点击弹出明细面板，并将健康度 7 项扣分项改为可勾选配置（勾选项才参与扣分计算），配置持久化到插件存储。
todos:
  - id: deduction-meta-storage
    content: 在 types/index.ts 新增扣分项元数据（DeductionKey/DEDUCTION_OPTIONS/HealthSettings/默认值），types/storage.ts 新增 healthSettings 存储槽
    status: completed
  - id: health-composable
    content: 改造 useStatsOverview 健康度按启用扣分项动态计算并导出 deductionRows，useDocAnalysis 增加加载与 watch 持久化
    status: completed
    dependencies:
      - deduction-meta-storage
  - id: hero-card
    content: 新建 HeroCard.vue 与 HeroCard.scss（含点击弹出明细/配置面板），改造 StatsView/index.vue 接入并清理 StatsOverview.scss
    status: completed
    dependencies:
      - health-composable
  - id: main-panel-wiring
    content: docAnalysis/index.vue 接入 healthSettings 加载/传入/更新，更新 README.md 说明扣分项配置
    status: completed
    dependencies:
      - hero-card
---

## 产品概述

对 docAnalysis 统计面板的 Hero 汇总卡进行重构与交互升级，并将健康度评分的扣分规则从硬编码改为用户可动态配置。

## 核心功能

- **Hero 汇总卡组件化**：将 `StatsView/index.vue` 内联的 `.stats-hero`（总文档 + 健康度 + 问题速览徽章）提取为独立组件 `HeroCard.vue`，问题徽章点击下钻行为保持不变
- **信息图标点击弹出**：健康度信息图标（`mdi:information-outline`）由 `:title` 悬浮提示改为点击弹出面板，展示健康度明细（各扣分项名称与当前数值、健康文档数/总数）
- **扣分项动态配置**：基于当前功能已有的 7 项统计指标（0B空、重名超出、不使用、无书签(排除0B)、部分发布、深度>7、字数>2万）生成可选扣分项列表，默认全部启用（健康度与现状一致）
- **勾选生效**：用户在弹出面板中勾选/取消扣分项，仅被选中的扣分项计入健康度扣分分析，健康度百分比随配置实时重算
- **设置持久化**：扣分项配置保存到插件存储，下次打开自动恢复；进度条与百分比的悬浮提示保留不变

## 技术栈

- 沿用项目现有技术栈：Vue 3 `<script setup>` + TypeScript + SCSS（Codex 设计 Token）
- 弹窗复用现有 Modal 模式（Teleport to body + overlay + panel，`styles/_mixins.scss` 的 `%modal-*` 占位符），参考 `BookmarkDetailModal.vue`
- 存储复用 `TypedStorage<T>`，设置持久化沿用 `duplicateNameFilter` 的"加载 + watch 回写 + 首次加载完成前跳过持久化"模式

## 实现方案

### 1. 扣分项元数据驱动（types 层）

在 `types/index.ts` 新增 `DeductionKey` 联合类型、`DeductionOptionDef` 接口（含 `key`/`label`/`resolve(stats, ctx, depthStats)` 计算函数）、`HealthSettings` 接口（`enabledDeductions: DeductionKey[]`）、`DEFAULT_HEALTH_SETTINGS`（默认全启用）与 `DEDUCTION_OPTIONS` 注册表（7 项，label 与 `WC_TOP_BIN_LABEL` 常量解耦引用）。`DocAnalysisStorage` 新增 `healthSettings` TypedStorage 槽位（key `doc-analysis-health-settings`）。`resolve` 计算逻辑与现硬编码逻辑逐项保持一致，保证默认配置下健康度结果不变。

### 2. 健康度计算动态化（composable 层）

`useStatsOverview.ts`：

- `UseStatsOverviewProps` 新增 `healthSettings`
- `_healthBreakdown` 改为遍历 `DEDUCTION_OPTIONS`，仅累加 `enabledDeductions` 中启用的项，`healthPct` 计算不变
- 新增导出 `deductionRows`（每项 `key/label/count/enabled`，禁用项也展示当前数值），供弹出面板渲染
- `healthTooltip` 改为按启用项生成明细（进度条 title 保留）

`useDocAnalysis.ts`：新增 `healthSettings` ref（初始化为 `DEFAULT_HEALTH_SETTINGS` 深拷贝）、`loadHealthSettings()`（`loadOrDefault` + `nextTick` 放行回写）、`watch` 持久化，供 `index.vue` 在 `onMounted` 调用加载。

### 3. Hero 卡组件提取 + 弹出面板（视图层）

- 新建 `components/StatsView/HeroCard.vue`：承接原 `.stats-hero` 渲染（hero-top + hero-issues 徽章行，徽章点击 emit `selectCategory`）；信息图标 `@click` 打开弹窗面板（含健康度明细列表 + 扣分项 checkbox 列表），勾选变化即时 emit `update:healthSettings`
- 新建 `styles/HeroCard.scss`：迁移 `.stats-hero`/`.hero-*`/`.issue-item` 样式 + 新增明细/配置面板样式（全部使用设计 Token，Codex 风格）
- `StatsView/index.vue`：移除内联 hero 块，替换为 `<HeroCard>`；Props 新增 `healthSettings`，Emits 新增 `update:healthSettings`；从 `useStatsOverview` 取 `deductionRows` 传入
- `styles/StatsOverview.scss`：删除已迁移的 hero/issue 样式，避免重复定义

### 4. 主面板接入（数据流串联）

`docAnalysis/index.vue`：从 `useDocAnalysis` 解构 `healthSettings` 与 `loadHealthSettings`，`onMounted` 加载；传给 `<StatsOverview :health-settings>` 并监听 `@update:health-settings` 更新。数据流：HeroCard 勾选 → emit → 主面板 ref 更新 → useStatsOverview 重算 healthPct → 持久化 watch 回写存储。

## 实现注意

- **循环依赖**：`DEDUCTION_OPTIONS` 引用 `utils/docStatsAnalyzer.ts` 的 `WC_TOP_BIN_LABEL`；该文件对 `types/index.ts` 仅 `import type`（运行时擦除），无运行时循环，可直接导入
- **默认值一致性**：`DEFAULT_HEALTH_SETTINGS` 必须包含全部 7 项，且 `resolve` 与现硬编码公式逐项一致，避免默认行为回归
- **持久化防回写覆盖**：`loadHealthSettings` 在 `watch` 注册前设置 loaded 标志（沿用 `dupFilterLoaded` 模式），加载回填不触发存储覆盖
- **样式迁移完整性**：`StatsOverview.scss` 中 hero 相关样式必须全部迁出，防止残留死代码；弹出面板样式限定 `scoped` 语义类（如 `hc-*` 前缀）避免污染
- **不执行 `pnpm vite build` / `pnpm lint`**：验证由用户自行完成（`npx tsc --noEmit`、ESLint）
- 无 i18n 改动（模块内文案均为硬编码中文）；无新图标引入（复用已注册的 `mdi:information-outline` 等）

## 目录结构

```
src/features/docAnalysis/
├── types/
│   ├── index.ts                  # [MODIFY] 新增 DeductionKey/DeductionOptionDef/DEDUCTION_OPTIONS/HealthSettings/DEFAULT_HEALTH_SETTINGS
│   └── storage.ts                # [MODIFY] DocAnalysisStorage 新增 healthSettings TypedStorage 槽位
├── composables/
│   ├── useDocAnalysis.ts         # [MODIFY] 新增 healthSettings ref + loadHealthSettings + watch 持久化
│   └── useStatsOverview.ts       # [MODIFY] 健康度按启用扣分项动态计算；新增 deductionRows 导出；Props 增加 healthSettings
├── components/StatsView/
│   ├── index.vue                 # [MODIFY] 移除内联 hero，替换 HeroCard；透传 healthSettings/deductionRows
│   └── HeroCard.vue              # [NEW] Hero 汇总卡组件 + 点击弹出健康度明细与扣分项配置面板
├── styles/
│   ├── HeroCard.scss             # [NEW] 迁移 hero/issue 样式 + 弹出面板样式（Codex Token）
│   └── StatsOverview.scss        # [MODIFY] 移除已迁移的 .stats-hero/.hero-*/.issue-item 样式
├── index.vue                     # [MODIFY] 接入 healthSettings 数据流（加载/传入/监听更新）
└── README.md                     # [MODIFY] 补充健康度扣分项可配置说明
```

## 关键代码结构

```ts
/** 健康度扣分项 key（可配置项标识） */
export type DeductionKey =
  | "zeroByte" | "duplicate" | "unused" | "noBookmark"
  | "partialPublish" | "deepGt7" | "wcGt20000"

/** 扣分项定义（元数据驱动，resolve 与现硬编码公式逐项一致） */
export interface DeductionOptionDef {
  key: DeductionKey
  label: string
  /** 计算当前扣分数量（depthStats 仅供深度项使用） */
  resolve: (stats: DocStats, ctx: CardValueContext, depthStats: DepthStats) => number
}

/** 健康度设置（持久化结构） */
export interface HealthSettings {
  /** 参与扣分计算的扣分项 key 列表 */
  enabledDeductions: DeductionKey[]
}

/** 可选扣分项注册表（默认全启用，保证与旧版健康度一致） */
export const DEDUCTION_OPTIONS: DeductionOptionDef[] = [ /* 7 项 */ ]
export const DEFAULT_HEALTH_SETTINGS: HealthSettings = {
  enabledDeductions: ["zeroByte", "duplicate", "unused", "noBookmark", "partialPublish", "deepGt7", "wcGt20000"],
}
```

# Agent Extensions

本任务为纯代码重构与逻辑改造（组件提取、计算逻辑动态化、存储持久化），改动均为项目既有成熟模式，无需调用额外扩展。已完成的代码探索覆盖全部修改目标，故不引入任何 Agent 扩展。