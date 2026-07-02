---
name: fix-statistics-performance-and-redundancy
overview: 修复 statistics 模块两个问题：(1) milestonesAchievedCount 用二分查找替代线性 while 循环；(2) useHistoryData 移除重复的 getStatistics 导入，改用已有 stats ref。
todos:
  - id: add-binary-search
    content: 在 milestones.ts 中新增 countMilestonesReached 二分查找工具函数，添加文件头注释
    status: completed
  - id: update-computed
    content: 修改 index.vue 中 milestonesAchievedCount computed，用 countMilestonesReached 替代 while 线性扫描
    status: completed
    dependencies:
      - add-binary-search
  - id: remove-dup-import
    content: 修改 useHistoryData.ts：移除 getStatistics 导入，isToday 分支改用 stats.value 字段替代 SQL 查询，并添加 null-safe 降级
    status: completed
  - id: verify
    content: 运行 tsc --noEmit 和 pnpm lint 验证类型与代码规范通过
    status: completed
    dependencies:
      - add-binary-search
      - update-computed
      - remove-dup-import
---

## 修复目标

1. **milestonesAchievedCount computed 性能优化**：将 `index.vue` 中 `while` 循环线性扫描（最坏 2200 次迭代/每次渲染）替换为二分查找 O(log n)。
2. **消除 useHistoryData 重复导入 getStatistics**：`useHistoryData.ts` 中 `getHistoricalStatistics` 的 `isToday` 分支冗余调用了 `getStatistics` SQL 查询，改用已注入的 `stats` ref（父组件已保证其最新）。

## 技术方案

### 1. milestonesAchievedCount 性能优化

**策略**：在 `utils/milestones.ts` 中新增 `countMilestonesReached` 二分查找工具函数，在 `index.vue` 中调用替代原有 `while` 循环。

**二分查找原理**：`milestoneTargetOfWithRules(type, n, customRules)` 返回值随 n 单调递增（自定义规则数组有序递增/公式规则单调递增），满足二分查找前置条件。在 [1, 200] 范围内搜索最大满足 `target(n) <= value` 的 n。

**复杂度**：从 O(n) = 200 × 11 = 2200 次函数调用降至 O(log n) = ~8 × 11 = 88 次。

### 2. 消除重复导入

**策略**：`useHistoryData` 已通过构造函数参数接收 `stats: Ref<StatisticsData | null>`，父组件 `index.vue` 在 `refreshData()` 中先执行 `refreshCore()`（设置 `stats.value`），再执行 `loadHistoricalData()`（调用 `getHistoricalStatistics`）。因此 `isToday` 分支可直接读取 `stats.value` 字段替代 SQL 查询。

**降级处理**：若 `stats.value` 为 `null`（独立调用 `getHistoricalStatistics` 的边缘场景），回退到 `lastKnownStats` 或零值记录。

## 实现细节

### 修改文件清单

```
src/features/statistics/
├── utils/
│   └── milestones.ts          # [MODIFY] 新增 countMilestonesReached 二分查找函数
├── composables/
│   └── useHistoryData.ts      # [MODIFY] 移除 getStatistics 导入，isToday 分支改用 stats.value
└── index.vue                  # [MODIFY] milestonesAchievedCount 调用 countMilestonesReached
```

### 关键代码结构

**countMilestonesReached 函数签名**：

```typescript
// src/features/statistics/utils/milestones.ts
export function countMilestonesReached(
  type: string,
  value: number,
  customRules?: Record<string, number[]>,
  maxMilestones?: number,
): number
```

- 返回 `value` 已达到的里程碑级别数（0~maxMilestones）
- 边界处理：value≤0 返回 0；maxMilestones 超界返回 maxMilestones
- 二分查找内部使用 `Math.ceil((lo+hi)/2)` 取上中位数避免死循环

### 性能对比

| 指标 | 修改前 | 修改后 |
| --- | --- | --- |
| 每类型迭代次数 | ~200 (while) | ~8 (binary search) |
| 总计函数调用 | ~2200 | ~88 |
| 时间复杂度 | O(n) per type | O(log n) per type |