---
name: BarChart.vue 审查与重构
overview: 对 statistics/components/BarChart.vue 进行全面审查，修复 3 类问题：(1) AGENTS.md 违规（缺少文件头注释、SCSS 硬编码、未使用 prop）；(2) 逻辑/视觉 bug（零值柱子仍显示 3px 高度、getBarHeight 冗余三元表达式）；(3) 性能优化（getBarHeight 重复计算、maxWords 潜在栈溢出）。
todos:
  - id: add-header-comment
    content: 添加文件头注释并移除冗余 title prop
    status: completed
  - id: fix-getBarHeight-logic
    content: 重构 getBarHeight：简化三元表达式 + 提取 barHeights computed + reduce 防栈溢出
    status: completed
    dependencies:
      - add-header-comment
  - id: fix-scss-violations
    content: 修复 SCSS 违规：font-weight/font-size/letter-spacing Token 替换 + box-shadow 消除 + 死代码移除
    status: completed
  - id: fix-zero-value-bar-bug
    content: "修复零值柱子可见性 bug：移除 min-height: 3px"
    status: completed
    dependencies:
      - fix-scss-violations
  - id: verify-consistency
    content: 最终一致性检查：模板引用与 computed 映射对齐
    status: completed
    dependencies:
      - fix-getBarHeight-logic
      - fix-scss-violations
      - fix-zero-value-bar-bug
---

## 需求概述

对 `src/features/statistics/components/BarChart.vue` 进行深度代码审查，排查逻辑漏洞与边界异常，识别冗余代码，评估性能瓶颈，并在确保业务逻辑不变的前提下完成重构优化，使代码完全符合 AGENTS.md 编码规范。

## 核心问题清单

### 规范违规

- 缺少文件头注释（AGENTS.md 硬规则）
- SCSS 中 `font-weight: 700` 硬编码（2处）→ 应使用 `$font-weight-bold`
- SCSS 中 `font-size: 10px` 硬编码（2处）→ 应使用 `$font-size-2xs`
- SCSS 中 `letter-spacing: 0.04em` → 应为 `0.06em`（Codex 标准）
- SCSS 中 `box-shadow` 用于 hover 高亮和今日标记 → Codex 禁止（应改用 border/outline）
- 响应式区块中 `.data-list` 是死代码（模板中无此 class）

### 逻辑缺陷

- CSS `min-height: 3px` 导致零值柱子仍可见（`getBarHeight(0)` 返回 0 但被 min-height 覆盖）
- `title` prop 声明后未在模板中使用（冗余 prop）

### 性能问题

- `getBarHeight()` 在每个 item 渲染时调用 2 次（bar-value 的 bottom + bar 的 height）
- `Math.max(...props.chartData.map(...))` 在极大数组时有栈溢出风险

### 可读性

- `getBarHeight` 中 `Math.max(height, words > 0 ? 5 : 0)` 三元表达式可读性不佳
- `formatChartLabel` 缺少注释说明

## 技术方案

### 修复策略

| 问题 | 修复方式 | 影响范围 |
| --- | --- | --- |
| 缺少文件头注释 | 添加 `<!-- 柱状图组件：每日写作字数可视化 -->` | 仅文件顶部 |
| 冗余 `title` prop | 从 Props 接口和 withDefaults 中移除 | script 块 |
| font-weight 硬编码 | `700` → `$font-weight-bold` | SCSS 2处 |
| font-size 硬编码 | `10px` → `$font-size-2xs` | SCSS 2处 |
| letter-spacing | `0.04em` → `0.06em` | SCSS 1处 |
| box-shadow 违规 | 改用 `outline` 或 `border-color` 替代 | SCSS 2处 |
| 死代码 `.data-list` | 删除整个规则块 | SCSS 响应式区 |
| min-height 覆盖 | 移除 `min-height: 3px`，零值返回 0 时自然不可见 | SCSS + 逻辑 |
| getBarHeight 重复调用 | 提取 `barHeights` computed 映射 | script 块 |
| 栈溢出风险 | `Math.max(...spread)` → `reduce` 写法 | computed |
| 三元表达式可读性 | 拆分为有意义的中间变量 | getBarHeight 函数 |


### 关键重构逻辑

**性能优化 — 提取 computed 映射：**

```typescript
// 替代模板中两次调用 getBarHeight
const barHeights = computed(() => {
  const max = maxWords.value
  if (max === 0) return new Map<string, number>()
  return new Map(
    props.chartData.map(item => [
      item.date,
      Math.max((item.words / max) * 150, item.words > 0 ? 5 : 0)
    ])
  )
})
```

**栈溢出防御：**

```typescript
// 替换 Math.max(...spread)
const maxWords = computed(() => {
  if (!props.chartData.length) return 0
  return props.chartData.reduce((max, item) => Math.max(max, item.words), 0)
})
```

**box-shadow 替代方案：**

- hover 高亮：`box-shadow: 0 0 8px rgba(...)` → `outline: 2px solid var(--b3-theme-primary-lightest); outline-offset: 1px`
- today 标记：`box-shadow: 0 0 10px rgba(...)` → `outline: 2px solid var(--b3-theme-secondary); outline-offset: 1px`

### 文件变更清单

```
src/features/statistics/components/BarChart.vue  # [MODIFY] 唯一修改文件
```

所有修改集中在一个文件内，不涉及其他文件。

## Agent Extensions

本任务不需要使用 Agent Extensions。审查与重构工作基于静态代码分析完成，无需调用外部工具。