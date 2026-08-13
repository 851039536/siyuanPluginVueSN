---
name: docAnalysis-AttrsPanel属性区表格化
overview: 将 AttrsPanel 发布状态区下方的文档属性区表格化：增加"属性/值"表头行、列分隔线与表格容器边框，对齐项目内 Codex 风格表格规范。
todos:
  - id: add-table-head
    content: AttrsPanel.vue 的 attrs-table 增加「属性/值」表头行并加中文注释
    status: completed
  - id: restyle-table
    content: AttrsPanel.scss 表格化：容器边框圆角、Codex 表头、列竖线、行 hover，用 [skill:codex-ui-style-guide] 校验 Token 合规
    status: completed
    dependencies:
      - add-table-head
---

## 需求概述

用户认可前两轮迭代（发布状态行式卡片、2 列网格）后，要求将「发布状态」下方的文档属性区域（`.attrs-table`）进行**表格化**改造。

当前该区域虽类名为 `attrs-table`，实际是"左标签 + 右值"的 flex 行堆叠，缺表头、缺列分隔、无表格容器视觉。改造目标：让它呈现标准两列表格观感，同时保持 YAML 折叠、复制按钮、空值占位等交互零改动。

## 核心功能

- 表格增加表头行（两列：「属性 / 值」），与数据行同列宽对齐
- 表格容器视觉：外边框 + `$vp-radius` 圆角，形成完整表格卡片
- key 列与 value 列之间加竖线分隔（Codex 风格细边框）
- 数据行 hover 高亮（表头行除外），过渡动画 0.12s
- 所有字号/间距/圆角使用设计 Token，符合两级字号制与 Codex 规范

## 技术栈

- Vue 3 + TypeScript + SCSS（沿用现有架构，不改依赖、不引入新库）
- 样式严格使用 `_variables.scss` 设计 Token：`$font-size-*` / `$font-weight-*` / `$spacing-*` / `$vp-radius` / `$radius-sm` / `$line-height-normal`，禁止硬编码与 box-shadow

## 实现方案

### 1. 模板（AttrsPanel.vue 第 124-171 行 `.attrs-table` 区域）

在 `v-for` 数据行之前插入表头行，**复用现有 `.attr-row` / `.attr-key` / `.attr-value` 类**以保证列宽与数据行完全对齐：

```html
<div class="attrs-table">
  <!-- 表格表头："属性 / 值" -->
  <div class="attr-row attr-head">
    <div class="attr-key">属性</div>
    <div class="attr-value">值</div>
  </div>
  <div v-for="item in displayItems" ...>...</div>
</div>
```

- `.attr-key` 已具备 uppercase + letter-spacing + bold + 2xs 样式，天然满足表头视觉，仅需补充表头背景/下边框
- 表头文案沿用模板既有硬编码中文模式（与「平台发布状态」等一致，本弹窗未使用 i18n 键），上方加中文注释
- YAML 折叠、复制按钮、空值占位、displayItems 计算逻辑零改动

### 2. 样式（AttrsPanel.scss 第 293-412 行 `.attrs-table` 块）

参考已核实的 Codex 表格先例（`statistics/styles/NotebookTable.scss`、`HistoryTable.scss`）：

- `.attrs-table`：容器加 `border: 1px solid var(--b3-border-color)` + `border-radius: $vp-radius` + `overflow: hidden`（圆角裁切行背景）
- `.attr-row`：加 `transition: background 0.12s`；hover 高亮 `background: var(--b3-list-hover)`（已核实该变量存在），表头行 `.attr-head` 排除 hover
- `.attr-key`：加 `border-right: 1px solid var(--b3-border-color-light, rgba(0,0,0,0.04))` 形成列竖线（两侧列保持 160px 固定宽 + 现有 padding，竖线随行自然连续）
- `.attr-head` 新增：`background: var(--b3-theme-surface)` + `border-bottom: 1px solid var(--b3-border-color)`，继承 `.attr-key` / `.attr-value` 的字号与对齐；表头 `.attr-value` 同样加表面背景（因两列背景一致才能连成整行表头底色）
- 数据行最后一条 `border-bottom: none` 保留；容器圆角 + 边框由外层提供

### 3. 性能与回归控制

- 纯样式 + 模板一行表头，无任何 TS 逻辑改动，零运行时开销、零回归风险
- 表格不单独设滚动容器，继续由 `.attrs-content` 整体滚动，避免嵌套滚动条
- 不改动发布状态区、footer、header 任何既有样式

## 验证

- 用户自行执行 `pnpm dev` 查看表格化视觉效果
- AI 不运行 `pnpm lint` / `vite build`；SCSS 通过 IDE lint 检查

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：指导 `.attrs-table` 表格化 SCSS 改造，确保表头/竖线/hover 使用设计 Token（$font-size-*/$spacing-*/$vp-radius/$radius-sm）、禁止硬编码与 box-shadow、符合 Codex 表格组件模式
- 预期产出：表格容器、表头行、列竖线、行 hover 样式全部通过 Codex 规范审查