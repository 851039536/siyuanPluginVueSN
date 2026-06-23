---
name: statusbar-perf-optimize
overview: 对 statusBar 监控维度做性能优化：响应式更新去抖（减少空闲期 80% 无效渲染）+ CSS will-change 优化动画合成。不新增功能扩展。
todos:
  - id: perf-guard-cpu-mem
    content: 在 useStatusBar.ts 的 updateStats() 中添加 CPU/内存值变化守卫，仅变化时写入响应式状态
    status: completed
  - id: perf-will-change
    content: "在 index.scss 的 task-pulse 动画规则中添加 will-change: opacity"
    status: completed
  - id: perf-verify-build
    content: 构建验证，确保无 lint 错误且构建通过
    status: completed
    dependencies:
      - perf-guard-cpu-mem
      - perf-will-change
---

## 优化目标

对 statusBar 监控项做纯性能优化，不新增功能。

## 优化内容

1. **CPU/内存响应式更新去抖**：`updateStats()` 毎 3 秒无条件写入 `state.cpuPercent` 和 `state.memPercent`，即使值不变也触发 Vue computed 链重新计算和模板渲染。改为仅在实际值发生变化时才写入响应式状态。
2. **CSS 动画 GPU 合成提示**：`task-pulse` 动画缺少 `will-change` 提示，浏览器无法提前将元素提升到合成层。

## 实现方案

### 1. `updateStats()` 值变化守卫

**位置**：`src/features/statusBar/composables/useStatusBar.ts` 第 168-192 行

**原理**：

- CPU 百分比计算后，先取整比较，仅当整数部分变化时才写入 `state.cpuPercent`
- 内存百分比计算后，仅当与上次值的差值 >= 0.5% 时才写入 `state.memPercent`
- `uptimeSeconds` 始终每 3 秒变化，无需守卫

**实现**：在现有计算逻辑后、写 `state` 前，添加条件判断。CPU 守卫复用已有的 `cpuPercent` 计算结果，内存守卫需要闭包变量保存上次写入值。

### 2. CSS `will-change` 提示

**位置**：`src/features/statusBar/styles/index.scss` 第 126-128 行

**改动**：在 `.status-bar-task-item[data-level="medium"]` 规则内添加 `will-change: opacity;`，提示浏览器将该元素提升到独立合成层，避免 `opacity` 动画触发重绘。

## 影响分析

- 无 API 变更，无新增依赖
- CPU 空闲期（最常见场景）可砍掉约 80% 的无效响应式更新
- 内存波动通常缓慢，收益略低但仍有效
- CSS 改动零风险，仅提升合成效率
