---
name: gitPush Markdown 组件审查与重构
overview: 审查 MarkdownPreviewDialog.vue 和 MarkdownFileBadge.vue，消除冗余代码（重复的 escapeHtml、死代码 try-catch）、修复性能问题（marked.setOptions 在 computed 中重复调用）、补充缺失的 onUnmounted 清理、统一 SCSS 字体 Token 使用。
todos:
  - id: refactor-markdown-preview-ts
    content: 重构 MarkdownPreviewDialog.vue：替换 escapeHtml、提升 marked.setOptions、添加 onUnmounted 清理、移除死代码 try-catch
    status: completed
  - id: fix-markdown-preview-scss
    content: 修复 MarkdownPreviewDialog.scss：font-weight 和 font-size 硬编码替换为设计 Token
    status: completed
  - id: fix-markdown-badge-scss
    content: "修复 MarkdownFileBadge.vue SCSS：font-weight: 600 替换为 $font-weight-semibold Token"
    status: completed
---

## 需求概述

审查 `MarkdownPreviewDialog.vue` 和 `MarkdownFileBadge.vue` 两个组件，识别冗余代码、评估性能优化可能性，在**不影响现有功能逻辑**的前提下进行重构，确保符合 CLAUDE.md 编码规范。

## 核心问题识别

### MarkdownPreviewDialog.vue

1. **冗余 escapeHtml 函数**（第 177-183 行）：本地定义的 `escapeHtml` 与 `@/utils/stringUtils.ts` 中的共享工具函数完全重复，违反 CLAUDE.md「模块内被多处使用的工具函数必须提取到 utils.ts，禁止复制粘贴」规则。共享版本还额外转义单引号（`'` → `&#039;`），更完整安全。
2. **marked.setOptions() 在 computed 中重复调用**（第 186 行）：`renderMarkdown` 函数在 `renderedHtml` computed 中被调用，每次重渲染都执行 `marked.setOptions()`，不必要。
3. **缺少 onUnmounted 清理**（第 270 行）：`handleCopy` 中的 setTimeout 未在组件卸载时清除，可能导致卸载后状态更新。
4. **loadFile 中死代码 try-catch**（第 253-255 行）：`readMarkdownFile` 内部已捕获所有异常并返回 null，外部的 try-catch 永远不会触发。

### MarkdownPreviewDialog.scss

5. **font-weight: 500 硬编码**（第 77 行）：应使用 `$font-weight-medium` Token。
6. **font-size: 14px 硬编码**（第 139 行）：应使用 `$font-size-sm` Token。

### MarkdownFileBadge.vue

7. **font-weight: 600 硬编码**（SCSS 第 42 行）：应使用 `$font-weight-semibold` Token。

## 技术方案

### 实现策略

基于审查发现的 7 个问题，分两个层面进行重构：**TypeScript 逻辑层**和 **SCSS 样式层**。所有修改均为局部优化，不涉及架构变更，不改变任何外部接口或用户可见行为。

### 关键决策

1. **escapeHtml 替换**：直接删除本地定义，改用 `import { escapeHtml } from "@/utils/stringUtils"`。参考 `docAnalysis/utils/mdRenderer.ts` 的相同做法（该项目中唯一正确的参考实现）。
2. **marked.setOptions 提升**：将 `marked.setOptions({ breaks: true, gfm: true })` 从 `renderMarkdown` 函数内部移到模块级别（只执行一次），`renderMarkdown` 仅保留 `marked.parse()` 调用。
3. **onUnmounted 清理**：添加 `const copiedTimer = ref<number>()`，在 `onUnmounted` 中 `clearTimeout`。
4. **loadFile 简化**：移除永远不会触发的 catch 分支，仅保留 null 判断。
5. **SCSS Token 替换**：`font-weight: 500` → `$font-weight-medium`，`font-weight: 600` → `$font-weight-semibold`，`font-size: 14px` → `$font-size-sm`。

### 性能影响

- `marked.setOptions` 从每次 computed 触发降为模块加载时执行一次 — 微优化，但符合最佳实践
- 其余为代码整洁度优化，无性能影响

### 兼容性

- 零破坏性变更：props/emit 接口不变、模板不变、外部行为不变
- `escapeHtml` 替换后行为更完整（额外转义单引号），不影响现有渲染结果

## Agent Extensions

无适用的扩展。本次任务为代码审查与重构，不涉及外部工具调用。