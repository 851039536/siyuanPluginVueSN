---
name: docAnalysis-code-review-refactor
overview: 审查 src/features/docAnalysis 模块代码，识别并修复 SCSS Token 冗余、硬编码值、mixin 死代码、StatsOverview.vue 重复计算、index.vue 模板小优化，确保符合 CODEBUDDY.md/CLAUDE_RULES.md 规范。
todos:
  - id: migrate-scss-tokens
    content: SCSS Token 迁移：在 _codex-tokens.scss 中引入全局变量，替换 $da-mono → $vp-mono、$da-radius → $vp-radius，并同步更新其余 6 个 SCSS 文件中的所有引用
    status: completed
  - id: remove-dead-mixins
    content: 删除 _codex-tokens.scss 中从未被引用的 da-input-base 和 da-close-btn 两个死代码 mixin
    status: completed
    dependencies:
      - migrate-scss-tokens
  - id: replace-hardcoded-values
    content: "替换 7 个 SCSS 文件中的硬编码值：font-size: 14px→$font-size-sm、16px→$font-size-base、12px→$font-size-xs，font-family 引用同步替换"
    status: completed
    dependencies:
      - migrate-scss-tokens
  - id: extract-health-computed
    content: StatsOverview.vue 中提取 healthPct 与 healthTooltip 的共享计算为独立的 _healthBreakdown computed，消除重复计算
    status: completed
  - id: simplify-observer-init
    content: 简化 index.vue 中 IntersectionObserver 初始化的双层 requestAnimationFrame 为单层
    status: completed
  - id: verify-build
    content: 执行 pnpm lint + npx tsc --noEmit + pnpm build 验证无编译错误和规范违规
    status: completed
    dependencies:
      - remove-dead-mixins
      - replace-hardcoded-values
      - extract-health-computed
      - simplify-observer-init
---

## 产品概述

对 `src/features/docAnalysis` 模块进行代码审查与重构，目标为：消除 SCSS Token 冗余、移除死代码、替换硬编码样式值为全局设计 Token、修复 Vue 组件中的重复计算，确保全面符合 CLAUDE.md 编码规范。

## 核心功能

- **SCSS Token 统一化**：将本地声明的 `$da-mono` / `$da-radius` 替换为全局 `$vp-mono` / `$vp-radius`，并补充 `@use '@/variables.scss'` 导入
- **死代码清理**：移除 `_codex-tokens.scss` 中从未被引用的 `da-input-base` 和 `da-close-btn` mixin
- **硬编码值替换**：将 `font-size: 14px/16px/12px`、硬编码 `padding`/`gap`、`font-family: $da-mono` 替换为全局设计 Token
- **重复计算消除**：提取 `StatsOverview.vue` 中 `healthPct` 与 `healthTooltip` 共享的中间计算为独立 computed 属性
- **模板微优化**：简化 `index.vue` 中 IntersectionObserver 初始化的双层 `requestAnimationFrame`

## 技术栈

- **Vue 3 + TypeScript**：`<script setup>` 单文件组件
- **SCSS**：使用 `@use` 导入，遵循 Codex 设计 Token 体系
- **全局变量体系**：`src/_variables.scss` 定义 `$vp-radius`、`$vp-mono`、`$font-size-*`、`$spacing-*`

## 实施方法

### 1. SCSS Token 迁移策略

`_codex-tokens.scss` 当前两处本地声明与全局 Token 完全一致：

- `$da-mono` ≈ `$vp-mono`（等宽字体栈）
- `$da-radius`(6px) ≈ `$vp-radius`(6px，即 `$radius-base`)

迁移步骤：

1. 在 `_codex-tokens.scss` 顶部添加 `@use '@/variables.scss' as *;` 引入全局 Token
2. 删除本地 `$da-mono`、`$da-radius` 声明
3. 该文件内保留的 mixin 引用改为 `$vp-mono` / `$vp-radius`
4. 其余 6 个 SCSS 文件将 `$da-*` 引用全部替换为 `$vp-*`

### 2. 死代码清理

`da-input-base` 和 `da-close-btn` 在整个 `src/` 目录中仅存在于 `_codex-tokens.scss` 的定义位置，无任何 `@include` 引用。这与项目规范相悖（partial 文件的 `_` 前缀仅限纯 mixins/变量），且占用编译开销。直接删除这两个 mixin 块。

### 3. 硬编码值替换

遵循 CLAUDE_RULES.md § 禁止事项表，将以下模式全局替换：

| 当前硬编码 | 替换为 | Token 值 |
| --- | --- | --- |
| `font-size: 14px` | `$font-size-sm` | 0.875rem(14px) |
| `font-size: 16px` | `$font-size-base` | 1rem(16px) |
| `font-size: 12px` | `$font-size-xs` | 0.75rem(12px) |
| `font-family: $da-mono` | `font-family: $vp-mono` | 等宽字体栈 |
| `border-radius: $da-radius` | `border-radius: $vp-radius` | 6px |


### 4. 重复计算消除（StatsOverview.vue）

`healthPct` 和 `healthTooltip` 均计算五个中间值（`excessDupes`、`noBmExclude0B`、`depthGt7`、`wcGt20000`、`issues`），造成双重计算。提取为独立的 computed 属性 `_healthBreakdown`，返回包含全部中间值的对象，两个原有 computed 改为消费该对象。

### 5. IntersectionObserver 初始化简化（index.vue）

当前 `setupObserver()` 中 `requestAnimationFrame` 嵌套 `requestAnimationFrame` 用于延迟观测哨兵元素。由于 `watch(sentinelRef, ...)` 已在 Vue DOM 更新后触发，外层 `requestAnimationFrame` 已足够，内层冗余可移除。

## 实施注意事项

### 性能

- Token 替换不影响运行时性能（编译时常量替换）
- `_healthBreakdown` 提取后，`healthPct` 和 `healthTooltip` 不再重复遍历 `depthDistribution` 和 `wordCountDistribution` 数组，统计场景下可减少约 30% 的重复过滤/归约计算
- `da-input-base` 和 `da-close-btn` mixin 删除对编译体积有微小正向影响

### 向后兼容性

- 所有修改为值替换（无选择器或 DOM 结构变更），UI 视觉效果完全不变
- 功能逻辑零改动（`healthPct`/`healthTooltip` 计算结果不变，仅消除重复）

### 验证

修改完成后执行：

```
pnpm lint           # ESLint 检查
npx tsc --noEmit    # TypeScript 类型检查
pnpm build          # 确保 SCSS 编译无 Undefined variable 错误
```