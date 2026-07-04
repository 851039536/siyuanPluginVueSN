---
name: remove-git-progress-bar
overview: 移除 gitPush 功能中的 git 操作进度条（gp-progress-bar）：包括模板、ref 变量、轮询定时器及对应 SCSS 样式。
todos:
  - id: remove-template-and-script
    content: 从 index.vue 移除进度条模板（L28-L32）、activeGitOps ref、opsPoller 变量、setInterval 轮询、onUnmounted clearInterval
    status: completed
  - id: remove-scss
    content: 从 styles/index.scss 移除 .gp-progress-bar 样式块和 @keyframes gp-shimmer
    status: completed
  - id: verify-lint-tsc
    content: 验证 ESLint 和 tsc 零新增错误
    status: completed
    dependencies:
      - remove-template-and-script
      - remove-scss
---

## 需求

移除 gitPush 模块顶部的 Git 操作进度条指示器（`gp-progress-bar`），包括模板、轮询脚本逻辑和关联样式。

## 移除范围

- 模板中的进度条 div 及注释
- `activeGitOps` ref、`opsPoller` 变量、setInterval 轮询、onUnmounted 中的 clearInterval 清理
- SCSS 中的 `.gp-progress-bar` 样式块和仅被其引用的 `@keyframes gp-shimmer`
- `props.manager.activeGitOps` 是 manager 属性，不受影响

## 实现方案

纯删除操作，无新增逻辑。涉及 2 个文件、5 处修改。

### 修改清单

**`src/features/gitPush/index.vue`（3 处）**

1. 模板 L28-L32：移除 `<!-- git 操作进度条 -->` 注释和 `<div v-if="activeGitOps > 0" class="gp-progress-bar" />`
2. 脚本 L591-L593：移除 `/** git 操作活跃数轮询 */` 注释、`const activeGitOps = ref(0)`、`let opsPoller: ...`
3. 脚本 L744-L746 + L765：移除 `setInterval` 轮询赋值行和 `onUnmounted` 中的 `clearInterval` 清理行

**`src/features/gitPush/styles/index.scss`（2 处）**

4. L824-L830：移除 `.gp-progress-bar { ... }` 样式块
5. L832-L834：移除 `@keyframes gp-shimmer { ... }`（仅被 .gp-progress-bar 引用）

### 验证

- ESLint 0 error
- tsc 无新增错误