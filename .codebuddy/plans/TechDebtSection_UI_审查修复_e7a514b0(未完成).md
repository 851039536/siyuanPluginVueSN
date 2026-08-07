---
name: TechDebtSection UI 审查修复
overview: 审查 gitPush 代码统计报告「技术债务」分区，修复 3 处 UI 显示问题：多分组表格边框重复割裂、说明文案行背景与悬停高亮冲突、空分组仍显示标题。核心方案是将 3 个严重度分组的独立表格合并为单个连续表格（分组标题作为跨行分隔行），说明行改为透明背景 + 左边框强调。
todos:
  - id: restructure-template
    content: 重构 TechDebtSection.vue：合并 3 个分组表格为单表格，分组标题改为表内跨行，过滤空分组
    status: pending
  - id: fix-styles
    content: 更新 TechDebtSection.scss：新增分组行样式、修复说明行悬停背景冲突、移除死代码
    status: pending
    dependencies:
      - restructure-template
---

## 产品概述

修复 gitPush 代码统计报告中「技术债务」分区（TechDebtSection）的 UI 显示问题，使该分区视觉表现与其他分区（AuthorContributionSection / HotspotSection）一致、紧凑、无割裂感。

## 核心问题（审查发现）

1. **多分组表格各自独立边框，视觉割裂**：严重度分组（severe/high/medium）各自有独立的 `.gpr-table-wrap`（border + border-radius），3 个表格堆叠，边框重复、间距浪费，不如单连续表格紧凑。
2. **说明文案行背景与悬停高亮冲突**：`.gpr-row--desc` 有固定 `background: var(--b3-list-hover)`，悬停文件块时指标行变背景而说明行不变，两者割裂。
3. **空分组仍显示标题**：`groups` computed 总返回 3 项，空分组渲染出「色点 + 名称 + 计数 0」的无意义标题行。

## 修复目标

- 合并 3 个分组表格为单个连续表格，分组标题作为表内分隔行
- 空分组不渲染
- 说明文案行悬停时与指标行背景连续，改用左边框 + 缩进区分

## 技术栈

- Vue 3 + TypeScript（`<script setup>`）
- SCSS（独立样式文件，`@use` 导入，设计 Token 驱动）
- 项目现有 Codex UI 风格（禁止 box-shadow，字体三要素用 Token）

## 实现方案

### 策略：合并单表格 + 分组标题行 + 空分组过滤

将当前「外层 v-for 分组 → 每组独立 table-wrap → 表头+文件块」的三层结构，扁平化为「单 table-wrap → 表头 + v-for 分组(标题行+文件块)」的两层结构。分组标题从独立 div 变为表格内的跨行分隔行（`.gpr-row--group`），与 `AuthorContributionSection` 的单表格模式对齐。

### 关键技术决策

| 决策 | 理由 |
| --- | --- |
| 合并为单 `.gpr-table-wrap` | 消除 3 个表格的重复边框、间距；单表头对齐所有列；与 AuthorContributionSection 保持一致 |
| 分组标题改为 `.gpr-row--group`（跨整行 cell） | 保持严重度分组语义，同时融入单表格结构；色点+名称+计数复用现有 `.gpr-debt-dot` / `.gpr-debt-count` |
| `groups` 增加 `.filter(g => g.rows.length > 0)` | 空分组不渲染标题行，消除无意义的「计数 0」行 |
| 说明行移除固定背景，改用左边框 | 悬停时透明背景继承父块高亮，解决割裂；左边框 + padding-left 缩进替代背景色做视觉区分 |
| 不修改 `index.scss` 共享 `.gpr-cell--desc` | 避免影响其他分区；在 TechDebtSection.scss 内用 `.gpr-row--desc .gpr-cell--desc` 选择器叠加左边框 |


## 实现备注

- **性能**：`groups` computed 的 `.filter` 在数组规模极小（≤数十文件）时无性能影响；单次过滤替代模板中 3 次 v-for 渲染空分组，反而减少 DOM 节点。
- **向后兼容**：不改 props 接口、不改 i18n 键、不改数据结构；纯模板+样式重构，对 `CodeReportPanel.vue` 零影响（它只传 `i18n` + `report` props）。
- **Blast radius**：仅触及 2 个文件（TechDebtSection.vue + TechDebtSection.scss），不碰共享 `index.scss` 的 `.gpr-*` 基座定义，不影响其他 3 个分区组件。

## 目录结构

```
src/features/gitPush/
├── components/report/
│   └── TechDebtSection.vue   # [MODIFY] 模板重构（合并单表格+分组标题行）+ script 过滤空分组
└── styles/
    └── TechDebtSection.scss  # [MODIFY] 新增分组行样式、修复说明行悬停冲突、移除死代码
```

### 文件变更详情

**TechDebtSection.vue** [MODIFY]

- **模板**：移除外层 `v-for="g in groups"` 的 `.gpr-debt-group` 包装；将 `.gpr-table-wrap` + 表头提到外层；内层用 `<template v-for>` 遍历非空分组，每组先渲染 `.gpr-row--group`（跨整行标题：色点+名称+计数），再渲染该组 `.gpr-debt-file` 块（指标行+说明行不变）
- **Script**：`groups` computed 末尾增加 `.filter(g => g.rows.length > 0)`

**TechDebtSection.scss** [MODIFY]

- **移除** `.gpr-debt-group`（margin 间距，不再需要）和 `.gpr-debt-group-title`（独立标题样式，被 `.gpr-row--group` 替代）
- **新增** `.gpr-row--group`：表格内分组标题行（surface 浅底 + row-divider 分割 + 紧凑 padding）
- **新增** `.gpr-cell--group`：跨整行 flex:1 + flex 布局容纳色点/名称/计数
- **修改** `.gpr-row--desc`：移除 `background: var(--b3-list-hover)`
- **新增** `.gpr-row--desc .gpr-cell--desc`：`border-left: 2px solid var(--b3-border-color)` + `padding-left: $spacing-1`（替代背景色区分）
- **保留** `.gpr-debt-dot` / `.gpr-debt-count` / `.gpr-file-icon` / `.gpr-debt-file`（hover + row-divider + 内行无边框）