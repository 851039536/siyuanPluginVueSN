---
name: statistics-scss-optimization
overview: 对 src/features/statistics/styles/index.scss 进行全面 SCSS 审查与性能优化：合并冗余选择器、消除重复属性、优化嵌套深度、替换硬编码为设计 Token、提升渲染性能。
todos:
  - id: replace-hardcoded-values
    content: 替换 progress-bar、tab-item、subsection-title 中的硬编码为设计 Token
    status: completed
  - id: extract-hover-mixin
    content: 提取 card-hover-border mixin 消除 stats-card-base 和 summary-cards-base 中的重复 hover 代码
    status: completed
  - id: optimize-color-variables
    content: 将 $color-success/$color-danger/$color-warning 改为引用全局变量
    status: completed
  - id: fix-box-shadow-codex
    content: 修复 codex-focus-glow mixin 中的 box-shadow 为 Codex 规范的 outline 方式
    status: completed
  - id: add-performance-comments
    content: 为 backdrop-filter 和滚动条添加性能注释
    status: completed
  - id: verify-visual-consistency
    content: 验证所有修改不改变视觉表现，确认子组件引用兼容性
    status: completed
    dependencies:
      - replace-hardcoded-values
      - extract-hover-mixin
      - optimize-color-variables
      - fix-box-shadow-codex
---

## 需求概述

审查 `src/features/statistics/styles/index.scss`（432行）的 CSS/SCSS 代码，识别并合并冗余选择器与重复样式属性，分析渲染性能并优化影响性能的代码。修改必须严格保证不改变现有视觉表现与业务逻辑，仅进行安全重构。

## 核心优化目标

1. **消除硬编码值**：将 `border-radius: 4px`、`transition: color 0.2s`、`letter-spacing: 0.04em` 等替换为全局设计 Token
2. **合并重复模式**：`&:hover { border-color: var(--b3-theme-primary); }` 在 `stats-card-base` 和 `summary-cards-base` 中重复
3. **性能优化**：减少 `box-shadow` 使用、优化 `backdrop-filter` 注释、统一过渡时间
4. **代码精简**：移除未使用的颜色变量、合并重复属性声明

## 技术方案

### 优化项 1：硬编码值替换为设计 Token

| 位置 | 优化前 | 优化后 | 理由 |
| --- | --- | --- | --- |
| progress-bar mixin L51,57 | `border-radius: 4px` | `border-radius: $radius-sm` | `$radius-sm = 0.25rem = 4px`，值等价 |
| .tab-item L300 | `transition: color 0.2s` | `transition: color 0.12s` | Codex 标准过渡时间 |
| .subsection-title L208 | `letter-spacing: 0.04em` | `letter-spacing: 0.06em` | Codex 大写标签标准 |
| .dist-section-title L419 | `letter-spacing: 0.04em` | `letter-spacing: 0.06em` | 同上 |
| .subsection-title L204 | `margin: 0 0 8px 0` | `margin: 0 0 $spacing-2 0` | 使用间距 Token |
| .dist-section L411 | `padding: $spacing-3` | 不变 | 已使用 Token |


### 优化项 2：合并重复的 hover 边框模式

**优化前**（两处重复）：

```
// stats-card-base mixin
&:hover {
  border-color: var(--b3-theme-primary);
}

// summary-cards-base mixin
&:hover {
  border-color: var(--b3-theme-primary);
}
```

**优化后**：提取为共享 mixin `card-hover-border`，两处 `@include` 引用。

### 优化项 3：移除冗余颜色变量

以下变量与全局 `_variables.scss` 重复，直接使用全局变量：

- `$color-success: #2da44e` → 直接使用或引用全局 `$brand-success`
- `$color-danger: #cf222e` → 直接使用或引用全局 `$brand-destructive`
- `$color-warning: #d97706` → 直接使用或引用全局 `$brand-warning`

**注意**：由于 `@use '../../../variables' as *` 已导入全局变量，可直接替换。但需确认子组件中 `stats.$color-success` 等引用是否广泛使用（搜索确认有 20+ 处引用），因此保留变量名但改为引用全局变量。

### 优化项 4：性能注释与优化

1. **`backdrop-filter` 注释**：在 `stats-glass-effect` mixin 中添加性能提示注释
2. **`box-shadow` 替换**：`codex-focus-glow` mixin 中的 `box-shadow` 改为 `outline` + `border-color`（Codex 规范要求）
3. **滚动条样式**：`.statistics-content` 的自定义滚动条与 `scrollbar-thin` mixin 视觉差异较大（6px vs 5px，不同颜色），保持原样但添加注释说明

### 优化项 5：未使用代码确认

- `.section-title` 和 `.subsection-title` 在 index.scss 中定义，但子组件通过 scoped 样式重新定义了各自的版本。index.vue 模板中使用了 `.section-title`，但由于 `@use` 不输出 CSS 规则，这些样式实际未生效。**建议**：将 index.vue 使用的类样式移至 index.vue 的 scoped 样式块中，或改为 `@import` 方式。

**本次优化范围**：仅确认问题，不改变功能（避免影响范围过大）。

## 目录结构

```
src/features/statistics/
└── styles/
    └── index.scss  # [MODIFY] 主优化目标文件
```

## 关键代码结构

### 优化后的 mixin 结构

```
// 共享 hover 边框效果（替代重复的 &:hover { border-color }）
@mixin card-hover-border {
  &:hover {
    border-color: var(--b3-theme-primary);
  }
}

// stats-card-base 使用 @include card-hover-border
@mixin stats-card-base {
  background: var(--b3-theme-surface);
  border-radius: $stats-card-radius;
  border: 1px solid var(--b3-border-color);
  overflow: hidden;
  @include card-hover-border;
}
```

## Agent Extensions

无适用的扩展。本任务为纯 SCSS 代码审查与重构，不需要额外的 Skill、MCP 或 SubAgent。