---
name: DocChangeSection SCSS 合规修复
overview: 将 DocChangeSection.vue 中 370 行内联 SCSS 提取到独立文件，修复 font-size/font-weight/letter-spacing 硬编码，使用 codex-label mixin 和 codex-focus-glow mixin，添加文件头注释。
todos:
  - id: create-scss-file
    content: 新建 styles/DocChangeSection.scss，提取全部 SCSS 并完成 Token 替换
    status: completed
  - id: replace-style-block
    content: 修改 Vue 文件：添加文件头注释 + 替换 style 块为 @use 导入
    status: completed
    dependencies:
      - create-scss-file
  - id: verify-mixin-usage
    content: 验证 codex-label/codex-focus-glow mixin 正确复用
    status: completed
    dependencies:
      - create-scss-file
---

## 审查目标

对 `src/features/statistics/components/DocChangeSection.vue` 进行 AGENTS.md CSS/SCSS 合规性审查并修复。

## 发现的违规项

### 1. 文件头注释缺失（硬规则）

文件顶部缺少功能说明注释，违反「每个 .ts/.vue 文件顶部必须包含简要功能说明注释」规则。

### 2. SCSS 未分离到独立文件（强制规则）

`<style>` 块内含 370 行 SCSS 代码，违反 AGENTS.md § 强制规则：SCSS 必须分离到 styles/ 目录。应提取为 `styles/DocChangeSection.scss`，Vue 文件仅保留 `@use` 导入。

### 3. font-size 硬编码（Codex 违规）

12 处硬编码 font-size：`9px`(1处)、`11px`(4处)、`10px`(4处)、`12px`(3处)，应使用 `$font-size-2xs`/`$font-size-xs`/`$font-size-sm` Token。

### 4. font-weight 硬编码（Codex 违规）

11 处硬编码 font-weight：`700`(9处)、`600`(1处)、`500`(1处)，应使用 `$font-weight-bold`/`$font-weight-semibold`/`$font-weight-medium` Token。

### 5. letter-spacing 不规范

4 处 `letter-spacing: 0.04em`，Codex 规范要求大写标签统一 `0.06em`。

### 6. box-shadow 未用 mixin

`changed-date-input:focus` 使用 `box-shadow`，应改用 `stats.codex-focus-glow` mixin（来自 `styles/index.scss`）。

### 7. 未复用 codex-label mixin

`.collapse-title`、`.recent-group-header`、`.changed-docs-group-title` 等选择器手动声明了与 `codex-label` mixin 相同的字体样式，应改用 `@include stats.codex-label`。

### 8. 硬编码间距值

多处 `gap`/`padding`/`margin` 使用 `4px`/`6px`/`8px`/`10px`/`12px` 硬编码，应使用 `$spacing-1`~`$spacing-3` Token。

## 修复策略

### 核心方案：SCSS 分离 + Token 替换

**参考实现**：同模块 `HeatmapCard.vue`、`PeriodPicker.vue` 等组件已采用「`@use "../styles/index.scss" as stats;` + 极少量内联」模式。但 DocChangeSection 是唯一含 370 行内联 SCSS 的组件，必须完整提取。

### 实施步骤

1. **新建 `styles/DocChangeSection.scss`**：将 370 行 SCSS 代码从 Vue 文件提取到独立文件，同时进行 Token 替换。

2. **修改 Vue 文件的 `<style>` 块**：替换为双行导入：

```
@use '../styles/DocChangeSection.scss';
@use '../styles/index.scss' as stats;
```

3. **添加文件头注释**：在 `<template>` 上方添加 `<!-- 文档变化统计区块：展示新增/修改文档列表、柱状图、最近更新 -->`

### Token 映射表

| 硬编码值 | 替换 Token | 备注 |
| --- | --- | --- |
| `font-size: 9px` | 保留 `9px` | 折叠图标尺寸，无对应 Token |
| `font-size: 10px` | `$font-size-2xs` | 0.625rem = 10px |
| `font-size: 11px` | 保留 `11px` | `codex-label` mixin 本身用 11px，属历史遗留 |
| `font-size: 12px` | `$font-size-xs` | 0.75rem = 12px |
| `font-weight: 700` | `$font-weight-bold` |  |
| `font-weight: 600` | `$font-weight-semibold` |  |
| `font-weight: 500` | `$font-weight-medium` |  |
| `letter-spacing: 0.04em` | `0.06em` | Codex 规范 |
| `gap: 4px` | `$spacing-1` |  |
| `gap: 6px` | 保留或 `$spacing-1` + `$spacing-px` | 6px 无直接 Token，保留 |
| `padding: 8px 12px` | `$spacing-2 $spacing-3` |  |
| `padding: 6px 12px` | `$spacing-1 $spacing-3` | 混合保留 |
| `border-radius: stats.$radius-sm` | 已使用 Token | 保持不变 |
| `box-shadow: 0 0 0 2px ...` | `@include stats.codex-focus-glow` | 使用 mixin |
| `transition: background 0.15s` | `transition: background 0.12s` | Codex 统一 0.12s |


### mixin 复用

- `.collapse-title` → 提取公共 `@include stats.codex-label` + 覆盖 `opacity`
- `.recent-group-header` → `@include stats.codex-label` + 覆盖 `opacity: 0.35`
- `.changed-docs-group-title` → 部分复用 + 保留 `margin-bottom`

### 文件变更清单

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `src/features/statistics/components/DocChangeSection.vue` | [MODIFY] | 添加文件头注释；`<style>` 块替换为两行 `@use` 导入 |
| `src/features/statistics/styles/DocChangeSection.scss` | [NEW] | 提取 370 行 SCSS + Token 替换 + mixin 复用 |


## Agent Extensions

### Skill

- **codex-ui-style-guide**
- Purpose: 确保修复后的 SCSS 完全符合 Codex UI 设计规范，验证 font-size/font-weight/line-height Token 替换正确性
- 预期产出：所有硬编码值替换为设计 Token，box-shadow 消除，mixin 正确复用