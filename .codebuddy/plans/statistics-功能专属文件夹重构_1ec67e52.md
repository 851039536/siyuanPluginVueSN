---
name: statistics-功能专属文件夹重构
overview: 按 AGENTS_ARCH.md「功能专属文件夹」规则重构 statistics 模块：为 components/ 下每个功能文件夹补充 index.vue 入口（单组件文件夹重命名入口、多组件文件夹新建聚合容器），将主面板 index.vue 的 Tab 编排逻辑下放到各文件夹入口，使其符合"每个功能文件夹入口统一为 index.vue"的强制规则，同时把主面板从 509 行精简到合理规模。
todos:
  - id: create-overview-distribution
    content: 新建 overview/index.vue 与 distribution/index.vue 入口容器，迁移 chartTitle、懒加载、distSummary 与 hover 联动
    status: completed
  - id: create-heatmap-activity-trend
    content: 新建 heatmap/activity/trend 三个 Tab 入口容器，heatmap 内部自加载 notebook 列表
    status: completed
  - id: create-report-milestones
    content: 新建 report/milestones 两个 Tab 入口容器，milestones 接收 plugin 与 stats props
    status: completed
  - id: refactor-main-panel
    content: 精简 statistics/index.vue 为编排中心，v-show 接入 7 个入口并 props 下放数据
    status: completed
    dependencies:
      - create-overview-distribution
      - create-heatmap-activity-trend
      - create-report-milestones
  - id: docs-and-verify
    content: 更新 statistics/README.md 目录说明，自查文件头注释与 SCSS 导入，供用户跑 lint/tsc 验证
    status: completed
    dependencies:
      - refactor-main-panel
---

## 需求概述

依据 AGENTS_ARCH.md「四、组件文件夹组织标准」中的**功能专属文件夹（强制）**规则，对 `src/features/statistics/` 模块进行组件组织重构：该规则要求每个功能单元文件夹的**入口组件统一命名为 `index.vue`**（文件夹名已表达功能，入口即直达），参考 gitPush 重构后的 `ListView/index.vue` 入口容器模式。

## 现状与差距

- `components/` 已按功能单元划分 7 个语义化文件夹（overview/distribution/heatmap/activity/trend/report/milestones）+ common/，共 31 个 .vue —— 符合「按功能单元建文件夹」；
- **但各文件夹均无 `index.vue` 入口**，主面板 `index.vue`（509 行，超 300 行警戒线）以 `<div v-show>` 直接编排 16 个组件、import 直达子组件 —— 违反「入口统一为 index.vue」强制规则。

## 核心目标

1. 为 7 个功能文件夹各建 `index.vue` 入口容器（编排层），主面板只保留 Tab 栏、数据持有与刷新编排；
2. 主面板从 509 行精简至约 250 行以内；
3. 行为零变化：Tab 切换、懒加载、刷新逻辑、hover 联动全部保持原有时序。

## 技术方案

### 总体策略

保持「主面板持有核心数据 + 子入口 props 下放 + 少量自包含」的架构，参照 gitPush `ListView/index.vue`（入口容器纯渲染）与 docAnalysis `StatsView/index.vue`（重构后入口编排层）的正面案例。

关键事实（已核实）：`useStatistics()` / `useNotebookStats()` 均为**非单例** composable（每次调用创建独立 ref），因此核心数据（stats/历史数据）必须由主面板持有单一实例并通过 props 下放，避免多实例导致刷新不同步。

### 数据流设计

| 入口 | 数据来源 | 要点 |
| --- | --- | --- |
| overview/index.vue | 主面板 props：`stats`、`changes`（4 个 change 聚合对象）、v-model 四件套（viewMode/dayRange/monthYearRange/selectedYear）、`periodAvgWords`、`i18n`、`queries`（5 个查询函数聚合对象） | 纯渲染编排：StatsCardsCompact + DocChangeSection + ViewModeSection + BarChart + WordRanking；`chartTitle` computed 迁移至此 |
| distribution/index.vue | props：`active`（activeTab==='notebookDistribution'）、`i18n` | **自包含**：内部调用 `useNotebookStats()` + `watch(active)` 首次 true 时懒加载（notebookStatsLoaded 标志迁移至此）+ `distSummary` computed + `provideNotebookHover()` |
| heatmap/index.vue | props：`stats`（writingStreak/activeDays）、`i18n`、`queries` | **自包含**：内部 `onMounted` 加载 `getHeatmapNotebooks()`（与现状主面板 onMounted 加载时机等价，因 v-show 组件始终挂载） |
| activity/index.vue | props：`i18n`、`getNotebookActivityTrend` | 纯渲染 |
| trend/index.vue | props：`historicalData`、`i18n`、`getTrendPrediction` | 纯渲染 |
| report/index.vue | props：`i18n`、`getReportData`、`getComparisonData` | 纯渲染 |
| milestones/index.vue | props：`plugin`、`stats`、`i18n` | 纯渲染；主面板保留 `milestonesAchievedCount` computed（Tab badge 依赖 stats + customRules） |


### 主面板精简后职责（约 250 行）

Header（StatisticsHeader）+ Tab 栏（TAB_CONFIGS + activeTab + milestones badge）+ loading 态 + `useStatistics()`/`useHistoryData()`/`useMilestoneStorage()` 数据持有 + `watch([viewMode,...])→refreshPeriodOnly` + `refreshData()` 编排（seq 防竞态）保留 + `storagePaths` + `onMounted`（refreshData/onRegisterRefresh/initMilestoneStorage）；模板改为 v-show 渲染 7 个入口。

### 样式与规范

- `styles/index.scss` 共享基座**不动**（.statistics-panel/.chart-section/.notebook-distribution-tab/.dist-*/.loading-wrapper 等为全局输出类，子入口复用即可）；各子入口按 SCSS 规范导入共享基座（`@use "../../styles/index.scss"`）；
- 全部新建 .vue 顶部加文件头注释；纯渲染入口若无专属样式只导入共享基座；
- 不改动任何功能逻辑、i18n、queries、types；不改动其他 feature。

### 目录结构（变更清单）

```
src/features/statistics/
├── index.vue                     # [MODIFY] 精简为编排中心，v-show 渲染 7 个入口
├── README.md                     # [MODIFY] 更新目录结构说明（如有）
└── components/
    ├── overview/index.vue        # [NEW] 概览 Tab 入口容器（编排 5 个区块组件 + chartTitle）
    ├── distribution/index.vue    # [NEW] 分布 Tab 入口容器（自包含 useNotebookStats/懒加载/distSummary/hover）
    ├── heatmap/index.vue         # [NEW] 热力图 Tab 入口容器（自包含 heatmapNotebooks 加载）
    ├── activity/index.vue        # [NEW] 活跃度 Tab 入口容器
    ├── trend/index.vue           # [NEW] 趋势 Tab 入口容器
    ├── report/index.vue          # [NEW] 报告 Tab 入口容器
    └── milestones/index.vue      # [NEW] 里程碑 Tab 入口容器
```

### 风险控制

- **行为等价性**：distribution 懒加载由"主面板 watch(activeTab)+loaded 标志"迁移为"入口内部 watch(active)+loaded 标志"，首次切 Tab 触发、刷新不重载的时序一致；heatmap 加载时机与现状等价；
- **爆炸半径**：仅改 statistics 模块内部 7 个新文件 + 1 个主文件 + README；styles/composables/queries/types 零改动；
- **数据一致性**：核心数据单一持有（主面板），杜绝多实例 composable 不同步；
- **验证**：用户自行执行 `pnpm lint`、`npx tsc --noEmit`、`pnpm i18n:verify`（本任务无 i18n 变更，可不跑）。