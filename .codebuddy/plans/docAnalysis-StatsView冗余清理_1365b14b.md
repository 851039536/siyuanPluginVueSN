---
name: docAnalysis-StatsView冗余清理
overview: 审查并修复 docAnalysis/StatsView 的冗余：移除 HeroCard 问题速览徽章（与表格行重复显示）、清理 useStatsOverview 死代码（deductionRows/healthyDocs/hasIssues）、消除魔法字符串重复并把分区特判逻辑元数据化为 STAT_SECTIONS 配置驱动。
todos:
  - id: types-metadata
    content: types/index.ts 新增 ExtraRowKind 与 StatSectionDef.extraRows，STAT_SECTIONS 声明 bookmark/publish 追加行，删除 DeductionRow 接口
    status: completed
  - id: composable-cleanup
    content: useStatsOverview.ts 删除 deductionRows/healthyDocs/hasIssues 并移除对应导出与导入，收窄 getCardValue/cardLabel/docsInSystem 导出面
    status: completed
    dependencies:
      - types-metadata
  - id: view-refactor
    content: StatsView/index.vue 移除 HeroCard 徽章绑定与解构，cardRowsMap/handleRowSelect 改为 extraRows 注册表驱动，删除 PUBLISH_SUMMARY_IDS
    status: completed
    dependencies:
      - types-metadata
      - composable-cleanup
  - id: herocard-slim
    content: HeroCard.vue 删除问题速览徽章区块与 selectCategory emit、精简 Props，HeroCard.scss 删除 issue 徽章样式
    status: completed
    dependencies:
      - view-refactor
  - id: readme-sync
    content: 更新 docAnalysis README.md 中「问题速览」相关表述，提示用户运行 pnpm lint 与 npx tsc --noEmit 验证
    status: completed
    dependencies:
      - herocard-slim
---

## 需求概述

审查 `src/features/docAnalysis/components/StatsView` 目录的冗余并实施修复。已确认四项问题及处理决定：

1. **重复显示**：HeroCard 问题速览徽章（`0B空`/`重名`/`孤文档`）与下方「大小分布」「文档质量」表格行展示同一批数字 → **移除速览徽章**，HeroCard 只保留总文档 + 健康度，问题全部在表格中查看
2. **死代码清理**：`useStatsOverview.ts` 中 `deductionRows`/`healthyDocs`（注释称供 HeroCard 弹出面板，但面板不存在）、`hasIssues`（仅徽章消费）无消费方 → 删除；`DeductionRow` 接口一并删除；`getCardValue`/`cardLabel`/`docsInSystem` 仅内部使用，收窄导出面
3. **魔法字符串重复**：`PUBLISH_SUMMARY_IDS` 与 `hasBookmark`/`noBookmark` 硬编码 id 与 `STAT_SECTIONS` 元数据重复 → 改为从分区 `cards` 推导
4. **分区特判耦合**：`cardRowsMap`/`handleRowSelect` 硬编码 bookmark/publish 分区 key 特判 → 元数据化：`StatSectionDef` 增加 `extraRows` 可选配置 + 组件内注册表分发

不涉及 i18n 键、图标注册、设置项变更。修改后由用户自行验证 `pnpm lint` 与 `npx tsc --noEmit`（AI 不运行构建与 lint）。

## 技术栈

沿用现有 Vue 3 + TypeScript 组合式 API 架构，无新增依赖。

## 实现方案

### 1. 元数据模型扩展（types/index.ts）

为 `StatSectionDef` 增加「动态追加行」可选声明，消除组件内分区 key 特判：

```ts
/** 统计分区动态追加行来源（书签值分布/平台分布，点击下钻事件与来源一一对应） */
export type ExtraRowKind = "bookmarkDistribution" | "platformDistribution"

export interface StatSectionDef {
  key: string
  title: string
  icon: string
  cards: StatCardDef[]
  /** 分区动态追加行来源（默认无；声明后表格在汇总卡片行后追加该分布行） */
  extraRows?: ExtraRowKind
  /** 默认折叠 */
  collapsed?: boolean
}
```

- `STAT_SECTIONS.bookmark` 声明 `extraRows: "bookmarkDistribution"`（追加书签值行，点击 emit `selectBookmark`）
- `STAT_SECTIONS.publish` 声明 `extraRows: "platformDistribution"`（追加平台分布行，点击 emit `selectPlatform`）
- 汇总行 id（原 `PUBLISH_SUMMARY_IDS` / `hasBookmark`/`noBookmark`）不再硬编码，统一由 `section.cards` 推导
- 删除 `DeductionRow` 接口（已 grep 确认仅 useStatsOverview 消费）

### 2. composable 死代码清理（useStatsOverview.ts）

- 删除 `deductionRows`、`healthyDocs`、`hasIssues` 三个 computed 及返回值导出，移除 `DeductionRow` 类型导入
- 返回对象移除 `getCardValue`、`cardLabel`、`docsInSystem`（保留内部定义：前两者被 `toCardRows` 内部调用，后者被 `avgPlatformsPerDoc`/`coveragePct` 内部调用）
- **保留**：`effectiveDupDocs`（`valueCtx` 供卡片与健康度计算消费）、`_healthBreakdown`（`healthPct`/`healthTooltip` 消费）、`pctStr`/`toCardRows`/`platformEntries`/`avgPlatformsPerDoc`/`coveragePct`（视图消费）

### 3. 视图编排重构（StatsView/index.vue）

- `<HeroCard>` 移除 `:has-issues`、`:effective-dup-docs`、`@selectCategory` 绑定；解构移除 `hasIssues`、`effectiveDupDocs`
- 新增两个注册表，`cardRowsMap` 与 `handleRowSelect` 全部改为元数据驱动：

```ts
const EXTRA_ROW_SOURCES: Record<ExtraRowKind, () => StatTableRow[]> = {
  bookmarkDistribution: () => bookmarkRows.value,
  platformDistribution: () => platformRows.value,
}
const EXTRA_SELECT_DISPATCH: Record<ExtraRowKind, (id: string) => void> = {
  bookmarkDistribution: (id) => emit("selectBookmark", id),
  platformDistribution: (id) => emit("selectPlatform", id),
}
```

- `cardRowsMap`：`section.extraRows ? [...toCardRows(section.cards), ...EXTRA_ROW_SOURCES[section.extraRows]()] : toCardRows(section.cards)`
- `handleRowSelect`：汇总 id 由 `section.cards` 推导 → 命中走 `selectCategory`；否则按 `section.extraRows` 走注册表分发；删除 `PUBLISH_SUMMARY_IDS`

### 4. HeroCard 精简（HeroCard.vue + HeroCard.scss）

- 模板删除 `.hero-issues` 徽章区块（0B空/重名/孤文档），Props 移除 `hasIssues`、`effectiveDupDocs`，删除 `selectCategory` emit（徽章是唯一点击来源），更新文件头注释
- `HeroCard.scss` 删除 `.hero-issues`、`.issue-item`、`.issue-value`、`.issue-label`、`.critical`、`.warn` 全部样式

### 5. 文档同步（README.md）

第 10 行「大小分布/健康度/问题速览/下钻列表四处统一生效」→ 移除「问题速览」，改为「大小分布/健康度/下钻列表三处」。

## 回归风险控制

- `effectiveDupDocs` 内部定义保留（`valueCtx` 供 `QUALITY_CARDS.duplicate` 与 `DEDUCTION_OPTIONS.duplicate` 消费），仅不再从 StatsView 解构传 HeroCard
- 删除前已 grep 确认：`DeductionRow`/`hasIssues`/`HeroCard`/`useStatsOverview` 均仅在 docAnalysis 模块内引用
- `handleRowSelect` 行为完全等价（汇总行走 selectCategory、追加行走专属事件），仅 id 来源从硬编码改为 `section.cards` 推导
- 视觉变化仅限 HeroCard 徽章移除，统计表格布局与下钻行为零改动

## 目录结构

```
src/features/docAnalysis/
├── components/StatsView/
│   ├── index.vue          # [MODIFY] 元数据驱动重构：注册表、cardRowsMap/handleRowSelect 改造、HeroCard 绑定精简、解构调整
│   └── HeroCard.vue       # [MODIFY] 移除问题速览徽章区块与 selectCategory emit，精简 Props
├── composables/
│   └── useStatsOverview.ts # [MODIFY] 删除 deductionRows/healthyDocs/hasIssues，收窄导出面，移除 DeductionRow 导入
├── styles/
│   └── HeroCard.scss      # [MODIFY] 删除 .hero-issues/.issue-item/.issue-* 徽章样式
├── types/
│   └── index.ts           # [MODIFY] 新增 ExtraRowKind、StatSectionDef.extraRows，STAT_SECTIONS 声明追加行，删除 DeductionRow
└── README.md              # [MODIFY] 「问题速览」相关表述同步更新
```

## 关键代码结构

见上文 ExtraRowKind / StatSectionDef 类型定义与组件内 EXTRA_ROW_SOURCES / EXTRA_SELECT_DISPATCH 注册表模式，这是本次重构的核心契约。