---
name: 分布 Tab 改纵向堆叠布局并移除文档柱状图
overview: 删除与排行表格冗余的「各笔记本文档数」柱状图（DocBarChart），将 NotebookDistribution 布局从双列网格改为单列纵向堆叠：汇总栏 → 排行表格（第一位）→ 字数饼图（全宽卡片，图例改多列自适应网格填充横向空间）。
todos:
  - id: reorder-tab-template
    content: 重排 index.vue：移除 DocBarChart 引用，表格置顶、饼图移至底部，清理 docChartLoading 解构
    status: completed
  - id: clean-loading-deadcode
    content: 清理 useNotebookStats 中 docChartLoading 死代码
    status: completed
    dependencies:
      - reorder-tab-template
  - id: delete-docbarchart
    content: 删除 DocBarChart.vue 与 DocBarChart.scss 文件
    status: completed
    dependencies:
      - reorder-tab-template
  - id: reflow-grid-styles
    content: 重构 styles/index.scss 为单列纵向流，移除双列网格规则
    status: completed
    dependencies:
      - reorder-tab-template
  - id: legend-multicolumn
    content: NotebookWordPie.scss 图例改多列自适应网格填满卡片宽度
    status: completed
    dependencies:
      - reorder-tab-template
  - id: verify-cleanup
    content: read_lints 验证 + 残留引用搜索确认无悬空
    status: completed
    dependencies:
      - reorder-tab-template
      - clean-loading-deadcode
      - delete-docbarchart
      - reflow-grid-styles
      - legend-multicolumn
---

## Product Overview

优化统计模块「笔记分布」Tab 的布局：消除饼图卡片空位过多、双列高度失衡的问题，形成信息密度更高的纵向单列流。

## Core Features

- 移除「各笔记本文档数」柱状图（DocBarChart）——其信息（名称/数量/文档占比）已完全被笔记本排行表格覆盖，属冗余展示
- 布局重排为纵向单列流：汇总摘要栏（全宽）→ 笔记本排行表格（全宽，置顶第一位）→ 字数占比饼图（全宽卡片）
- 饼图卡片消除空位：左侧保留 160px 环形图，右侧图例由单列纵向列表改为多列自适应网格（auto-fill + minmax），填满横向空间
- 清理死代码：docChartLoading 状态、DocBarChart 组件及其样式文件
- 保留摘要栏对 docBarChartTitle 键的复用、barPct/formatShortNumber 工具函数（trend/overview 仍在用）、表格与饼图间的 hover 联动

## Tech Stack

- Vue 3 + TypeScript + SCSS（沿用现有统计模块架构与 Codex 设计 Token，无新增依赖）

## Implementation Approach

1. **模板重排**（`NotebookDistribution/index.vue`）：删除 DocBarChart 的 import、section 与 `:loading` 绑定；将「笔记本排行」section 移到饼图 section 之前；从 `useNotebookStats()` 解构中移除 `docChartLoading`；删除模板中已无对应的柱状图注释；文件头注释同步微调
2. **死代码清理**（`composables/useNotebookStats.ts`）：移除 `docChartLoading` ref、其赋值语句、返回签名与返回对象中的对应项（`loadNotebookDocStats` 保留，表格仍需 notebookDocStats 数据）
3. **文件删除**：`DocBarChart.vue`、`DocBarChart.scss`（均仅本 Tab 使用）
4. **网格重构**（`styles/index.scss`）：`.notebook-distribution-tab` 由「2 列 3 行 grid」改为单列纵向流（`grid-template-columns: 1fr` 或直接 flex column），删除 `.dist-left`/`.dist-right-pie` 双列定位规则，`.dist-summary-bar`/`.dist-table`/`.dist-right-pie`（重命名为 `.dist-pie` 更贴切）改为自然纵向排列；`.dist-table` 保留 `min-height: 200px`
5. **饼图图例多列化**（`styles/NotebookWordPie.scss`）：`.pie-legend` 由 `flex-direction: column; max-height: 160px` 改为 `display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 2px 12px; align-content: center;`，图例项填满卡片横向空间；饼图区固定 160px 不变，整体垂直居中

## Implementation Notes

- 顺序：先改 index.vue 移除引用，再删组件文件，避免 import 悬空
- `barPct`/`formatShortNumber` 留在 utils/index.ts 不动（多处共用）；i18n 无需改动（docBarChartTitle 仍被摘要栏使用，emptyText 仍被饼图使用）
- NotebookTable 无 loading/空状态，加载瞬间仅渲染表头，可接受，不加新逻辑
- hover 联动为 provide/inject，少一个消费者不影响其余两个组件
- 性能：纯展示层增删，无数据流变化；图例改 grid 不引入额外计算
- 验证：完成后 read_lints 检查 + 全局搜索残留引用；pnpm lint / tsc 由用户执行