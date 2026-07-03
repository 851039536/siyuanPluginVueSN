---
name: gitPush-scss-merge-redundancy
overview: 审查 gitPush 模块 SCSS 冗余代码并合并：新增 3 个 mixin（popover-base/popover-item/row-divider），统一 6 处未使用已有 mixin 的地方（focus-ring/text-ellipsis/gp-label-base）。
todos:
  - id: add-mixins
    content: 在 _mixins.scss 新增 popover-base / popover-item / row-divider 三个 mixin
    status: completed
  - id: refactor-index
    content: 重构 index.scss：gp-ide-popover 改用 popover-base、gp-ide-item 改用 popover-item、gp-search-input:focus 改用 focus-ring、gp-tag-input:focus 改用 focus-ring、6 处 row-divider 替换
    status: completed
    dependencies:
      - add-mixins
  - id: refactor-panel-header
    content: 重构 PanelHeader.scss：gp-platform-popover/gp-add-popover 改用 popover-base、gp-platform-item/gp-add-item 改用 popover-item
    status: completed
    dependencies:
      - add-mixins
  - id: refactor-others
    content: 重构 StatsPanel.scss / WorkingTreePanel.scss / BranchCommitList.scss：统一 row-divider、focus-ring、text-ellipsis、gp-label-base
    status: completed
    dependencies:
      - add-mixins
  - id: verify
    content: 验证：pnpm lint + npx tsc --noEmit，确保零错误零视觉回归
    status: completed
    dependencies:
      - refactor-index
      - refactor-panel-header
      - refactor-others
---

## 需求概述

审查 gitPush 模块全部 12 个 SCSS 文件中的冗余样式代码，将重复模式提取为 mixin，统一分散的 mixin 调用。

## 核心功能

- 新增 3 个共享 mixin：`popover-base`（弹出层容器）、`popover-item`（弹出菜单项按钮）、`row-divider`（列表行底部边框分割线）
- 重构 3 处 popover 弹出层，改为 `@include popover-base` + 差异化属性覆盖
- 重构 3 处 popover 菜单项，改为 `@include popover-item`（`.gp-ide-item` 保留子修饰符）
- 重构 7 处列表行 border-bottom 模式，统一用 `@include row-divider`
- 统一 3 处 focus 样式为 `@include focus-ring`（替换仅设 border-color 的写法）
- 统一 3 处手动 text-overflow 为 `@include text-ellipsis`
- 统一 3 处 section 标题为 `@include gp-label-base` + 额外样式覆盖
- 修改后 lint + tsc 通过，零视觉回归

## 技术方案

### 实现策略

采用 **mixin 提取 + 渐进替换** 策略：先在 `_mixins.scss` 中新增 3 个 mixin，然后逐文件替换重复代码为 `@include` 调用，保留各调用点的差异化属性作为覆盖。

### 关键设计决策

**1. `popover-base` mixin 设计**

- 包含 3 个弹出层共有的 11 行样式（position/background/border/radius/flex/z-index/padding/white-space）
- **不包含** `top`/`left`/`right`/`margin-top`/`min-width`/`transform` — 这些是差异化属性，由各调用点自行设置
- `.gp-ide-popover` 需要 `left:50%; transform:translateX(-50%)` 居中定位，与另外两个 `right:0` 右对齐不同，因此定位属性必须留在外层

**2. `popover-item` mixin 设计**

- 包含 3 个菜单项共有的 11 行基础样式 + hover 效果
- `.gp-ide-item` 有额外的 `&--none` / `&--add` / `&--custom` 子修饰符，这些保留在 mixin 调用之后

**3. `row-divider` mixin 设计**

- 包含 `border-bottom: 1px solid var(--b3-border-color)` + `&:last-child { border-bottom: none; }`
- `.gp-cat-row` 使用 `&:last-of-type`（特殊场景：类别行可能混入非同类元素），需保留原写法，不替换

**4. `focus-ring` 替换注意事项**

- `gp-search-input:focus` 父级已有 `outline: none`，只需替换 `border-color` 为 `@include focus-ring`
- 其他两处 `:focus { border-color: ..., outline: none; }` 可直接用 `@include focus-ring` 完全替换
- 需注意 `@include focus-ring` 会同时设置 `border-color` 和 `box-shadow`，视觉效果有轻微变化（增加 2px 发光外框），这是 Codex 风格规范的标准行为

### 涉及文件（共 6 个修改文件 + 编译时无新增文件）

| 文件 | 修改类型 | 行数变化 |
| --- | --- | --- |
| `_mixins.scss` | 新增 3 个 mixin | +35 行 |
| `index.scss` | 重构 popover / row-divider / focus-ring（6 处） | -30 行 |
| `PanelHeader.scss` | 重构 popover + item（4 处） | -35 行 |
| `StatsPanel.scss` | 重构 row-divider + gp-label-base（2 处） | -8 行 |
| `WorkingTreePanel.scss` | 重构 row-divider + focus-ring + gp-label-base（3 处） | -8 行 |
| `BranchCommitList.scss` | 重构 text-ellipsis x2 + gp-label-base（3 处） | -7 行 |


### 验证标准

- ESLint：0 error
- `tsc --noEmit`：无新增类型错误
- 零视觉回归（所有 mixin 语义等价替换，不对原有样式产生差异）