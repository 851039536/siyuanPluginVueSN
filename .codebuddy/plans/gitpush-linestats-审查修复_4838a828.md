---
name: gitpush-linestats-审查修复
overview: 修复 LineStatsPanel 审查发现的 4 项问题：汇总卡片统计口径错误（用截断后前 20 名累加却标注"总"）、netClass 三处重复、withLineBarPct 与 ProjectLineDetail 的 pct/share 计算重复、relativeTime 空串导致残缺文案。
todos:
  - id: extract-shared-utils
    content: 在 utils.ts 新增 netClass 与 withLineBarPct 共享纯函数
    status: completed
  - id: add-summary-type
    content: 在 types/meta.ts 新增 LineStatsSummary 接口并为 LineStatsCache 添加可选 summary 字段
    status: completed
  - id: wire-summary-state
    content: 在 useCommitAnalysis.ts 新增 lineStatsSummary 状态、buildLineRankings 返回全量合计、持久化与缓存降级恢复
    status: completed
    dependencies:
      - add-summary-type
  - id: pass-summary-prop
    content: 在 index.vue 解构 lineStatsSummary 并透传给 LineStatsPanel
    status: completed
    dependencies:
      - wire-summary-state
  - id: refactor-linestats-panel
    content: 改造 LineStatsPanel.vue：summary 改用 prop、复用 netClass/withLineBarPct、relativeTime 空串兜底
    status: completed
    dependencies:
      - extract-shared-utils
      - add-summary-type
      - pass-summary-prop
  - id: reuse-shared-in-detail
    content: 在 ProjectLineDetail.vue 与 AuthorContributionSection.vue 复用 netClass，ProjectLineDetail.authorRows 复用 withLineBarPct
    status: completed
    dependencies:
      - extract-shared-utils
---

## 产品概述

针对 gitPush 功能「行数统计」视图面板 LineStatsPanel.vue 的审查结论实施修复，消除数据准确性问题与重复代码。

## 核心功能

- 修正顶部汇总卡片统计口径：当前用截断后的前 20 个项目累加却标注「总新增/总删除/总净增」，改为基于全量项目数据合计，项目数超过 20 时数字准确。
- 消除 netClass 三处重复：统一提取到 utils.ts，三个组件（LineStatsPanel / ProjectLineDetail / AuthorContributionSection）复用。
- 消除 pct/share 百分比计算重复：提取 withLineBarPct 到 utils.ts，LineStatsPanel 与 ProjectLineDetail 复用。
- 修复 relativeTime 空串兜底：缓存损坏导致 analyzedAt 为空时，避免渲染残缺的「上次分析 」文案。

## 技术栈

- 基于现有 Vue 3 + TypeScript 项目，复用 gitPush 模块既有分层：types（类型/常量）、utils（纯函数）、composables（useCommitAnalysis）、components（各面板）。
- 不引入新依赖，不跨 feature 导入。

## 实现方案

### 1. 汇总口径修复：新增独立全量合计状态（方案选型说明）

**问题**：`buildLineRankings` 返回的 `projectRanking` 已 `.slice(0, 20)`，LineStatsPanel 的 `summary` 用截断后数据累加，导致「总」数字偏小。

**方案选择**：采用「新增独立 `lineStatsSummary` 全量合计状态 + 持久化 + 旧缓存降级」方案，而非「把截断移到展示层、全量持久化排行」。理由：

- 全量持久化排行会让 `authorLineRanking`（作者数量可能上百）显著增大缓存体积；
- `PROJECT_RANK_LIMIT`/`AUTHOR_RANK_LIMIT` 是 useCommitAnalysis 私有常量，下放到展示层需额外导出并改多处消费点（含 analysisStats 传给 CommitAnalysisPanel 的语义）；
- 独立 summary 字段改动局部、向后兼容明确、重新点「重新分析」即可得到准确值。

**数据流**：`buildLineRankings` 在 slice 前已用 `projectLines` Map 聚合全量 added/deleted → 累加得到 summary → 随 `lineStatsCache` 持久化 → LineStatsPanel 从新 prop `summary` 读取（移除本地 reduce）。

### 2. 共享函数签名

在 `utils.ts` 新增：

```ts
/** 净增行语义 class：正→pos / 负→neg / 零→zero（zeroSuffix 传空串时零值不追加 class） */
export function netClass(net: number, prefix: string, zeroSuffix = "--zero"): string

/** 行数排行条形/占比预计算：pct=相对最大新增行，share=新增行占总新增百分比（total=0 兜底防除零） */
export function withLineBarPct<T extends { added: number }>(rows: T[]): (T & { pct: string, share: string })[]
```

三组件以「本地薄委托」复用 netClass，保持模板调用点零改动：

- LineStatsPanel：`netClass(net, "gls-net")` → `gls-net--pos/neg/zero`（原行为不变）
- ProjectLineDetail：`netClass(net, "pld-net")` → `pld-net--pos/neg/zero`（原行为不变）
- AuthorContributionSection：`netClass(n, "gpr-cell", "")` → 零值返回 `""`（原行为不变）

### 3. 类型扩展

在 `types/meta.ts` 新增：

```ts
export interface LineStatsSummary {
  added: number
  deleted: number
  net: number
}
```

`LineStatsCache` 新增可选字段 `summary?: LineStatsSummary`（向后兼容旧缓存）。

## 实现要点

### useCommitAnalysis.ts

- 新增 `const lineStatsSummary = ref<LineStatsSummary>({ added: 0, deleted: 0, net: 0 })`。
- `buildLineRankings` 返回值扩展为 `{ projectRanking, authorRanking, summary }`，summary 在 slice 前由 `projectLines` 全量累加。
- `runCore(needNumstat)` 成功后：`lineStatsSummary.value = summary`，并在 `lineStatsCache.save` 时写入 `summary` 字段。
- 缓存恢复统一降级：新增内部纯函数 `deriveSummary(ranking)`（从截断排行累加），`loadLineStatsCache` 与 `loadCachedAnalysis` 均执行 `lineStatsSummary.value = cache.summary ?? deriveSummary(cache.projectLineRanking ?? [])`。
- return 对象新增 `lineStatsSummary`。

### LineStatsPanel.vue

- props 新增 `summary: LineStatsSummary`，删除本地 `summary` computed 与 `withLineBarPct` 函数，改从 `../../utils` import。
- `netClass` 改为薄委托共享函数。
- 第 15 行 relativeTime 兜底：`relativeTime(analyzedAt, i18n) || i18n.timeJustNow`（`timeJustNow` 键已存在于 i18n，见 utils.ts 414 行）。

### ProjectLineDetail.vue

- 删除本地 `netClass`，复用共享函数（前缀 `pld-net`）。
- `authorRows` 改为对排序过滤后的 `raw` 直接调用 `withLineBarPct(raw)`。
- `fileRows` 的 pct/share 兜底写法（`totalAdded > 0 ? ... : "0%"`）与共享函数略有差异且结构特殊，保持现状不强制统一，避免过度重构。

### index.vue

- 从 `useCommitAnalysis` 解构 `lineStatsSummary`，向 LineStatsPanel 绑定 `:summary="lineStatsSummary"`。

## 目录结构

```
src/features/gitPush/
├── utils.ts                                      # [MODIFY] 新增 netClass / withLineBarPct 共享纯函数
├── types/meta.ts                                 # [MODIFY] 新增 LineStatsSummary 接口 + LineStatsCache.summary 可选字段
├── composables/useCommitAnalysis.ts              # [MODIFY] 新增 lineStatsSummary 状态、buildLineRankings 返回 summary、持久化与降级恢复
├── index.vue                                     # [MODIFY] 解构并透传 lineStatsSummary
└── components/
    ├── analysis/LineStatsPanel.vue               # [MODIFY] summary 改 prop、复用共享函数、relativeTime 兜底
    ├── analysis/ProjectLineDetail.vue            # [MODIFY] 复用 netClass / withLineBarPct
    └── report/AuthorContributionSection.vue      # [MODIFY] 复用 netClass
```

## 实现注意

- **向后兼容**：`LineStatsCache.summary` 为可选字段；旧缓存无 summary 时用 `deriveSummary` 从截断排行降级累加，重新点「重新分析」后自动精确。
- **爆炸半径控制**：改动全部限制在 gitPush 模块内部，不触碰其他 feature；`commitAnalysisCache` 不新增字段（summary 仅随 lineStatsCache 持久化），避免两套缓存字段不一致。
- **性能**：summary 在分析聚合阶段一次性算好，LineStatsPanel 只读 prop，无额外运行时遍历；`withLineBarPct` 与 `deriveSummary` 均 O(n)，排行已 slice 到 20/10，无性能压力。
- **验证**：由用户自行执行 `npx tsc --noEmit`、`pnpm lint`、`pnpm dev`；AI 不执行 `pnpm vite build` / `pnpm lint`。