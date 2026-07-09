---
name: statusbar-code-review-refactor
overview: 对 statusBar 模块进行代码重构，修复审查中发现的 16 个问题：5 个冗余/重复代码、3 个边界异常/逻辑缺陷、3 个性能优化、5 个规范合规项。优先聚焦冗余代码合并。
todos:
  - id: fix-unregister-leak
    content: 修复 E1：导出 unregisterStatusBar 并在 src/index.ts onunload 中调用。涉及 statusBar/index.ts、features/index.ts、src/index.ts 3 个文件
    status: completed
  - id: extract-drawer-item-component
    content: 消除 R1+R2：在 FeatureDrawer.vue 中新建 DrawerFeatureItem.vue 子组件消除重复模板，SVG 替换为 ph:x 图标。涉及 components/DrawerFeatureItem.vue（新建）、FeatureDrawer.vue
    status: completed
  - id: extract-toggle-helper
    content: 消除 R3：在 index.vue 中抽取 applyToggleByCategory 辅助函数，消除 handleToggleStatusBar 与 handleToggleRarelyUsed 中的重复分支逻辑
    status: completed
  - id: extract-finish-helper
    content: 消除 R4：在 useStatusBarTask.ts 中提取 finishTask 私有函数，简化 complete() 和 fail()
    status: completed
  - id: fix-edge-cases-and-perf
    content: 修复 E2+E3+性能优化：FeatureDrawer 关闭重置搜索状态、useStatusBar uptimeSeconds 阈值过滤、searchQuery lowercase 缓存、WORD_COUNT_THRESHOLDS 常量提取。涉及 FeatureDrawer.vue 和 useStatusBar.ts
    status: completed
    dependencies:
      - extract-drawer-item-component
  - id: add-file-headers
    content: "补全文件头注释：为 index.vue、FeatureDrawer.vue、MonitorItem.vue、useDataSnapshot.ts 添加，SCSS font-size: 11px 替换为 $font-size-xs"
    status: completed
---

## 用户需求

对 statusBar 模块及其 2 个关联文件执行深度审查与重构：

- 消除 5 处冗余/重复代码（优先）
- 修复 3 个边界异常与逻辑缺陷
- 实施 2 项性能优化
- 补齐 4 项编码规范合规性问题
- 所有修改必须保证现有业务逻辑与核心功能不受影响
- 输出代码必须符合 CODEBUDDY.md 中定义的编码规范

## 审查范围

9 个模块文件 + 2 个关联文件：

- `src/features/statusBar/index.ts` — 模块入口（需导出 unregisterStatusBar）
- `src/features/statusBar/index.vue` — 主面板（R3 重复分支逻辑）
- `src/features/statusBar/components/FeatureDrawer.vue` — 功能抽屉（R1 重复模板 + R2 SVG 重复 + E2 状态残留）
- `src/features/statusBar/components/MonitorItem.vue` — 监控项组件（仅文件头注释）
- `src/features/statusBar/composables/useStatusBar.ts` — 核心监控逻辑（R5 + E3）
- `src/features/statusBar/composables/useStatusBarTask.ts` — 后台任务（R4）
- `src/features/statusBar/styles/index.scss` — 样式（硬编码 font-size）
- `src/features/dataSnapshot/composables/useDataSnapshot.ts` — 外部消费者（仅文件头注释）
- `src/features/index.ts` — 重导出 unregisterStatusBar
- `src/index.ts` — onunload 中调用 unregisterStatusBar

## 技术栈

- 前端框架：Vue 3 + TypeScript
- 样式：SCSS（设计 token 体系 `_variables.scss`）
- 图示库：@iconify/vue

## 实现方案

### 1. R1：FeatureDrawer.vue 提取功能项渲染组件（最高优先级）

**问题**：`feature-drawer-item` 渲染块在"主列表"（L110-148）和"不常用列表"（L177-216）中完全重复（~40 行）。

**方案**：新建 `DrawerFeatureItem.vue` 子组件，封装图标、标题、固定角标、隐藏角标四个元素。组件接收 `item: FeatureDrawerItem`、`statusBarVisible: string[]` 两个 props，并通过 emits 向上传递 `toggleStatusBar`、`toggleRarelyUsed`、`select` 三个事件。两处 `v-for` 替换为 `<DrawerFeatureItem>` 单行调用。

**为什么不用 template fragment / v-for 复用**：Vue 3 SFC 不支持不带根的局部 template 定义（Vue 3.3+ 的 `<template v-for>` key 问题已解但可读性不如独立组件），且 CODEBUDDY.md 规定子组件放 `components/` 目录，这是项目既有的标准做法。

### 2. R2：FeatureDrawer.vue SVG 替换为 Iconify 图标

**问题**：关闭图标 SVG path 在关闭按钮（L53-56）和清除按钮（L84-87）中出现两次。

**方案**：两处手写 SVG 替换为 `<Icon icon="ph:x" :width="14" />`（Phosphor 图标集已预加载，`ph:x` 与原始路径语义等价）。减少约 10 行硬编码。

### 3. R3：index.vue 抽取 toggle 分支分发辅助函数

**问题**：`handleToggleStatusBar` 和 `handleToggleRarelyUsed` 共享相同的 `if (MONITOR_IDS.has(id)) { ... } else { ... }` 模式。

**方案**：新增私有函数 `applyToggleByCategory(id, onMonitor, onFeature)`，根据 `MONITOR_IDS.has(id)` 调用不同回调，并负责保存到正确的 storage key。两个 handler 简化为调用此函数 + 各自的具体操作。

### 4. R4：useStatusBarTask.ts 提取 finish() 私有函数

**问题**：`complete()` 和 `fail()` 共享相同的 4 步模式（cancelTimer → ensureTask → set info → setTimeout(remove)），仅 `level` 和延迟时间不同。

**方案**：新增模块级私有函数 `finishTask(taskId, label, level, delayMs, detail?)`，`complete()` 和 `fail()` 变为薄包装器。

### 5. R5 + P2：useStatusBar.ts 提取阈值常量 + 缓存搜索词

**问题**：`totalWordsDisplay` computed 每次执行都创建新数组 `[[100000000, "亿"], [10000, "万"], [1000, "k"]]`。

**方案**：提取为模块级常量 `WORD_COUNT_THRESHOLDS`。

### 6. E1：接入 unregisterStatusBar 到卸载流程

**问题**：`unregisterStatusBar()` 在 `index.ts` 中定义但从未被调用。插件卸载时 statusBar 的 Vue app 和 DOM 元素不会释放。

**方案**：

- `src/features/statusBar/index.ts`：`unregisterStatusBar` 改为 `export`
- `src/features/index.ts`：添加导出 `export { unregisterStatusBar } from "./statusBar"`
- `src/index.ts`：在 `onunload()` 中添加 `unregisterStatusBar()` 调用

### 7. E2：FeatureDrawer.vue 关闭抽屉时重置状态

**问题**：用户搜索后关闭抽屉，再次打开时搜索词和活跃分组仍保留，造成 UX 困惑。

**方案**：使用 `watch(() => props.visible, (val) => { if (!val) { searchQuery.value = ''; activeGroup.value = '__all__'; } })`，关闭时自动重置。

### 8. E3 + P1：useStatusBar.ts uptimeSeconds 阈值过滤 + FeatureDrawer searchQuery 缓存

**问题**：`state.uptimeSeconds` 每 3 秒无条件更新，即使显示值未变化；`matchSearch` 每次调用 `toLowerCase()`。

**方案**：

- `updateStats()` 中添加 `lastUptimeDisplay` 缓存，仅在小时/分钟显示值变化时写入 `state.uptimeSeconds`
- `matchSearch` 改为使用 `searchQueryLower` computed，避免每次过滤都 `toLowerCase()`

### 9. 规范合规：文件头注释 + SCSS 硬编码修复

**文件头注释**：为 `index.vue`、`FeatureDrawer.vue`、`MonitorItem.vue`（`<!-- 功能描述 -->` 格式）、`useStatusBar.ts`、`useDataSnapshot.ts`（`// 功能描述` 格式）添加。`index.ts` 已有、`useStatusBarTask.ts` 已有、`types/index.ts` 已有。

**SCSS 硬编码**：`index.scss` 中 3 处 `font-size: 11px`（L5, L139, L308）替换为 `$font-size-xs`（0.75rem = 12px 有微小视觉差异但符合 token 体系）。硬编码颜色值（L109-133）与 `index.vue` 中 `FEATURES` 数组的 `color` 字段保持一致，属于功能标识色，不在本次 SCSS 变量化范围内（业务逻辑关联，贸然提取会引入维护歧义）。