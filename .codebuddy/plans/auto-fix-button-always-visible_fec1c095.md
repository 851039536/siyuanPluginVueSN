---
name: auto-fix-button-always-visible
overview: 移除 ReviewPanel 中「自动修复」按钮的 needsFix 评级限制，使其在任何评级下始终可见
todos:
  - id: remove-needsfix-wrapper
    content: 移除 ReviewPanel.vue 中自动修复按钮的 v-if="needsFix" 包裹层，使按钮始终可见
    status: completed
---

## 用户需求

审核面板底部操作栏中的「自动修复」按钮当前仅在 AI 评级为"需改进"时才显示。用户希望该按钮**始终可见**，无论评级是"优秀"、"良好"还是"需改进"，都可以随时点击触发修复。

## 核心改动

- 移除 ReviewPanel.vue 中包裹自动修复按钮的 `<template v-if="needsFix">` 条件
- 修复中徽标（`isAutoFixing` 时显示）与按钮本身的 `v-if`/`v-else` 切换逻辑保持不变
- 单条 issue 的「修复」按钮仍保持 `needsFix` 条件（仅在有问题时显示）

## 技术方案

### 改动范围

**仅 1 个文件**：`src/features/aiContentGenerator/components/ReviewPanel.vue`

### 具体改动

**1. 模板第 179-201 行**：移除 `<template v-if="needsFix">` 包裹层，将内部内容（修复中徽标 + 自动修复按钮）直接放在 `<div class="review-footer-actions">` 中。

```
- <template v-if="needsFix">
    <!-- 修复进行中徽标 -->
    <span v-if="isAutoFixing" class="auto-fixing-badge">...</span>
    <!-- 按钮："自动修复" -->
    <button v-else class="review-footer-btn auto-fix-btn" @click="$emit('autoFix')">...</button>
- </template>
```

**2. 注释第 264 行**：更新 `needsFix` 的注释，说明其现仅控制单条 issue 的定向修复按钮。

### 安全性分析

- **外层保护**：`<div v-if="reviewResult" class="review-body">`（第 30 行）已确保无审核结果时不渲染整个区域，按钮不会在无数据时显示
- **修复逻辑兼容**：`useReview.ts` 的 `handleAutoFix()` 在 `issues` 为空数组时 `issuesText` 为空字符串，仅凭 `suggestions` 也能构造有效修复指令，AI 仍可正常优化内容
- **单条修复按钮不变**：第 122 行的 `v-if="needsFix && !isAutoFixing"` 保持不变，单条 issue 的修复入口仍仅在有问题时显示
- **`needsFix` computed 保留**：该 computed 仍被第 122 行引用，不可删除