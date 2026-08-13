---
name: gitpush-linestats-legend
overview: 在 gitPush 行数统计面板的项目/作者排行列表顶部补一个对齐表头行，明确 +新增 / −删除 / 净增 / 占比 四列含义，并强调"净增 = 实际行数"，解决"哪个是实际行数"的直觉困惑。
todos:
  - id: add-i18n-key
    content: 在 zh_CN/gitPush.json 与 en_US/gitPush.json 新增 lineStatsNetHint 文案
    status: completed
  - id: add-bar-head
    content: 在 LineStatsPanel.vue 两个排行列表顶部插入表头行，并在 LineStatsPanel.scss 新增 .gls-bar-head 与净增强调样式
    status: completed
    dependencies:
      - add-i18n-key
---

## 产品概述

优化 gitPush 行数统计面板（LineStatsPanel）的排行列表展示，在项目排行与作者排行两个列表顶部新增对齐表头行，让用户一眼分清三列数字的含义，并明确"净增"才是实际代码行数。

## 核心功能

- 在项目代码行数排行与作者代码行数排行列表顶部各新增一行表头（列头图例）
- 表头与数据行采用完全相同的 flex 列结构，保证 `+新增` / `−删除` / `净增` / `占比` 四列与下方数字右对齐
- 净增列表头加粗并以主题色强调，同时提供 tooltip 说明"净增 = 实际行数（新增 − 删除）"
- 数据行三列数字的字号、颜色、布局保持不变（改动最小）

## 技术栈

- Vue 3 + TypeScript（`<script setup>`）
- SCSS（样式独立文件，复用现有设计 Token）
- 复用项目内已有表头样式先例 `ProjectLineDetail.scss` 的 `.pld-table-head`

## 实现方案

### 核心思路

在两个排行列表 `.gls-bar-list` 的顶部、数据行之前各插入一个 `.gls-bar-head` 表头行。表头行复用与数据行 `.gls-bar-row` 完全一致的 flex 列结构（排名列 / 名称列 / 条形轨道 / 数字列 / 占比列），其中排名、名称、轨道三列留空占位，数字列与占比列放置文字标签。由于 flex 结构一致，表头文字会与数据行数字自动对齐。

### 关键决策

- **不改数据行**：用户明确选择"数字大小不变、仅加表头图例"，因此数据行 `.gls-bar-row` 及 `.gls-line-num` 等样式完全不动。
- **复用 i18n 现有 key**：表头文字直接复用 `analysisLineAdded`（新增）、`analysisLineDeleted`（删除）、`analysisLineNet`（净增）、`lineDetailShare`（占比），仅新增 1 个 `lineStatsNetHint` 作为净增 tooltip。
- **对齐方式**：`.gls-line-nums` 已有 `margin-left: auto`，表头复用该 class 即可保证与数据行数字列右对齐；占比列复用 `.gls-bar-share` 固定 42px 宽度，天然对齐。
- **净增强调**：表头整体用 `$font-weight-bold`，净增列表头额外加主题色 `var(--b3-theme-primary)`，形成"主角"视觉层级，呼应"净增 = 实际行数"。

## 实现细节

### 表头结构（两个排行列表各插入一处）

```
<div class="gls-bar-head">
  <span class="gls-bar-rank"></span>            <!-- 排名占位 -->
  <span class="gls-bar-label"></span>           <!-- 名称占位 -->
  <span class="gls-bar-track"></span>           <!-- 条形占位 -->
  <span class="gls-line-nums">                  <!-- 数字列表头，与数据列对齐 -->
    <span class="gls-line-num gls-line-num--add">+新增</span>
    <span class="gls-line-num gls-line-num--del">−删除</span>
    <span class="gls-line-num gls-line-num--net gls-bar-head-net" :title="i18n.lineStatsNetHint">净增</span>
  </span>
  <span class="gls-bar-share">占比</span>
</div>
```

### 样式要点（LineStatsPanel.scss）

- `.gls-bar-head`：`display:flex; align-items:center; gap:$spacing-2;`，字号 `$font-size-2xs`、字重 `$font-weight-bold`、`letter-spacing:0.06em`，颜色 `var(--b3-theme-on-surface-light)`，底部 `border-bottom:1px solid var(--b3-border-color)` 分隔，`padding-bottom:$spacing-1`
- 表头内 `.gls-line-num` 覆盖 `opacity` 为 1，避免继承数据行的 0.7 弱化透明度
- `.gls-bar-head-net`：额外加粗 + `color:var(--b3-theme-primary)`，突出"净增 = 实际行数"
- 表头内 `.gls-bar-track` 仅作占位（空轨道不显示填充，天然无视觉干扰）

### i18n 新增 key

- `src/i18n/zh_CN/gitPush.json`：`"lineStatsNetHint": "净增 = 实际行数（新增 − 删除）"`
- `src/i18n/en_US/gitPush.json`：`"lineStatsNetHint": "Net = actual lines (added − deleted)"`
- 顶层合并 JSON 由 `pnpm i18n:merge` 自动生成，不手动修改

## 目录结构

```
src/features/gitPush/
├── components/analysis/
│   └── LineStatsPanel.vue        # [MODIFY] 两个排行列表顶部插入 .gls-bar-head 表头行；净增表头加 tooltip
└── styles/
    └── LineStatsPanel.scss       # [MODIFY] 新增 .gls-bar-head 与 .gls-bar-head-net 样式

src/i18n/
├── zh_CN/gitPush.json            # [MODIFY] 新增 lineStatsNetHint 文案
└── en_US/gitPush.json            # [MODIFY] 新增 lineStatsNetHint 文案
```