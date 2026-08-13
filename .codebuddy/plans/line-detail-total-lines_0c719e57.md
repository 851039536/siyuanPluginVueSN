---
name: line-detail-total-lines
overview: 在项目行数详情弹窗中增加该项目当前总行数（存量 totalLines）的展示，口径与排行中"总行数"列一致。
todos:
  - id: line-detail-show-total-lines
    content: 透传 totalLines 至详情弹窗并在头部展示当前总行数 chip（LineStatsPanel.vue + ProjectLineDetail.vue + SCSS）
    status: completed
---

## 产品概述

点击「项目代码行数排行」中的项目行会打开详情弹窗（当前包含「文件明细」与「作者明细」两个 Tab），但弹窗未展示该项目的当前总行数（存量）。需求：在详情弹窗中同样显示该项目的总行数，与排行行中的「总行数」列口径一致。

## 核心功能

- 详情弹窗头部展示当前项目的「当前总行数」（存量，git ls-files 统计，已按扩展名过滤）
- 数据直接取自项目排行条目已有的 `totalLines` 字段，不重新抓取、不改变分析链路
- 旧缓存缺失 `totalLines` 时显示占位符「—」，tooltip 说明存量口径（非提交增删增量）
- 复用已有 i18n 键（`lineStatsTotalLines` 标签 + `lineStatsTotalHint` tooltip），不新增翻译

## 技术栈

沿用现有技术栈：Vue 3 + TypeScript + SCSS（Codex 设计 Token），无新增依赖。

## 实现思路

`projectLineRanking` 条目已携带 `totalLines`（在 `buildLineRankings` 中由 `countTrackedFilesLines` 按扩展名过滤统计），排行行也已渲染该列。只需将该项目 `totalLines` 从 `LineStatsPanel.vue` 透传给 `ProjectLineDetail.vue`，并在弹窗头部新增一个 chip 展示即可，数据链路零改动。

## 实现要点

### 1. `src/features/gitPush/components/analysis/LineStatsPanel.vue`

- 仿照现有 `lineDetailProjectName` computed 的模式，新增 `lineDetailTotalLines` computed：从 `props.projectRanking` 按 `props.lineDetailProjectId` 查找对应条目，返回 `totalLines`（项目已删除或旧缓存缺失时为 `undefined`）
- 弹窗调用处新增 `:total-lines="lineDetailTotalLines"` prop

### 2. `src/features/gitPush/components/analysis/ProjectLineDetail.vue`

- props 新增可选 `totalLines?: number`（注释说明：当前项目实际总行数，存量口径，旧缓存缺失时为 undefined）
- 在 header 的 `.pld-title-wrap` 内（`pld-title-sub` 之后）新增 chip：显示 `totalLines?.toLocaleString() ?? "—"`，等宽数字 + 中性色，`title` tooltip 复用 `i18n.lineStatsTotalHint`
- 遵循模板 i18n 中文注释规范（在 chip 上方添加 `<!-- 当前总行数：... -->` 注释）

### 3. `src/features/gitPush/styles/ProjectLineDetail.scss`

- 新增 `.pld-total` chip 样式：等宽字体（`$vp-mono`）、`$font-size-2xs` 辅助字号、`$font-weight-*` Token、`$spacing-*` 间距、`$radius-*` 圆角、边框或浅色底（禁止 box-shadow 与硬编码字号/行高），弹性收缩（`flex-shrink: 0`）

### 4. i18n

- 复用已有键：`lineStatsTotalLines`（"当前总行数" / "Current Lines"）与 `lineStatsTotalHint`（存量口径说明），不新增翻译键

## 架构与兼容性

- 纯展示层改动：不触碰 `useCommitAnalysis.ts` / `types/meta.ts` / 缓存结构，无迁移风险
- 排行行与弹窗 chip 共用同一 `totalLines` 数据源，口径天然一致；旧缓存条目缺失时两端均显示「—」，行为一致
- 弹窗头部基准字号 `$font-size-xs` 已设置，新增 chip 遵循两级字号制（辅助文字 `$font-size-2xs`）

## 目录结构

```
src/features/gitPush/
├── components/analysis/
│   ├── LineStatsPanel.vue      # [MODIFY] 新增 lineDetailTotalLines computed 并透传 :total-lines
│   └── ProjectLineDetail.vue   # [MODIFY] 新增 totalLines prop + header 总行数 chip
└── styles/
    └── ProjectLineDetail.scss  # [MODIFY] 新增 .pld-total chip 样式
```