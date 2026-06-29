---
name: statistics-review-fix
overview: 修复 statistics 模块的 2 处 SQL 注入漏洞、2 处重复定义、1 处手动构建冗余、1 处并发竞态缺陷、1 处不必要的响应式变量。
todos:
  - id: fix-sql-injection-heatmap
    content: 修复 heatmapStats.ts 两处 SQL 注入风险：getHeatmapDailyDetail 添加 isValidDateStr 校验，getHeatmapActivityData 添加 notebookId 单引号转义
    status: completed
  - id: dedup-format-time
    content: 提取 formatTime 到 utils/index.ts，docChangeStats.ts 和 heatmapStats.ts 改为导入
    status: completed
  - id: dedup-heatmap-metric
    content: 删除 heatmapStats.ts 中重复的 HeatmapMetric 类型定义，改为从 types 导入
    status: completed
  - id: simplify-milestone-fields
    content: index.vue 中 milestonesAchievedCount 用 MILESTONE_TYPES + 字段映射常量替代手写 fields 数组
    status: completed
  - id: fix-race-condition
    content: index.vue 中 refreshData 添加竞态保护，防止并发查询覆盖结果
    status: completed
  - id: fix-reactive-ref
    content: index.vue 中 notebookStatsLoaded 从 ref 改为普通 let 变量
    status: completed
  - id: verify-build
    content: 运行 pnpm lint 和 npx tsc --noEmit 验证无新增错误
    status: completed
    dependencies:
      - fix-sql-injection-heatmap
      - dedup-format-time
      - dedup-heatmap-metric
      - simplify-milestone-fields
      - fix-race-condition
      - fix-reactive-ref
---

## 修复范围

修复 statistics 模块审查中发现的 7 个"冗余问题"和"逻辑缺陷"类别问题：

### SQL 注入漏洞（2处）

1. `heatmapStats.ts` `getHeatmapDailyDetail(dateStr)` — 用户输入的日期字符串仅检查长度后直接 `replace(/-/g, "")` 拼入 SQL，应使用 `isValidDateStr()` 校验
2. `heatmapStats.ts` `getHeatmapActivityData(notebookId)` — notebook ID 直接拼入 SQL，应添加单引号转义

### 类型/函数重复定义（2处）

3. `HeatmapMetric` 类型在 `types/index.ts` 和 `queries/heatmapStats.ts` 各定义一次，heatmapStats 版本覆盖了 types 版本
4. `formatTime` 函数在 `docChangeStats.ts` 和 `heatmapStats.ts` 完全相同的实现

### 里程碑字段手动构建冗余

5. `index.vue` 中 `milestonesAchievedCount` 手工构造 45 行 fields 数组，可用 `MILESTONE_TYPES` 常量生成

### 并发竞态

6. `watch` 快速切换参数时可能触发多个并发异步 `refreshData()` 调用

### 不必要的响应式变量

7. `notebookStatsLoaded` 是 `ref(false)`，仅作缓存标记，用普通 `let` 即可

## 技术方案

所有修改仅涉及 statistics 模块内部，不改变外部 API 契约。

### 修改文件与改动说明

#### 1. `utils/index.ts` — 新增 `formatTime` 导出

将 `formatTime` 函数从 `docChangeStats.ts` 和 `heatmapStats.ts` 提取到此处作为共享工具函数导出。

#### 2. `queries/heatmapStats.ts` — 4处修改

- 删除本地 `formatTime` 函数定义（第10-13行），改为从 `../utils` 导入
- 删除本地 `export type HeatmapMetric`（第8行），改为从 `../types` 导入
- `getHeatmapDailyDetail(dateStr)` 开头添加 `isValidDateStr` 校验：`dateStr.replace(/-/g, "")` 生成 `yyyymmdd` 后调用 `isValidDateStr(yyyymmdd)` 校验，不通过则返回空数组
- `getHeatmapActivityData` 中 `notebookId` 拼接前添加转义：`notebookId.replace(/'/g, "''")`

#### 3. `queries/docChangeStats.ts` — 1处修改

- 删除本地 `formatTime` 函数定义（第12-15行），改为从 `../utils` 导入

#### 4. `index.vue` — 3处修改

- **里程碑冗余**：删除手工构建的 `fields` 数组（第532-577行），新增 `MILESTONE_FIELD_MAP`（MilestoneTypeKey → StatisticsData 字段名的映射常量），用 `MILESTONE_TYPES.map()` 生成 fields
- **并发竞态**：在 `refreshData()` 内添加 `refreshSeq` 计数器模式——每次调用递增序号，请求返回后检查是否仍为最新序号，否则丢弃结果
- **不必要响应式**：`const notebookStatsLoaded = ref(false)` 改为 `let notebookStatsLoaded = false`

### 并发竞态设计

```ts
// 竞态保护计数器
let refreshSeq = 0

async function refreshData(): Promise<void> {
  const seq = ++refreshSeq
  loading.value = true
  try {
    await refreshCore()
    if (seq !== refreshSeq) return  // 已被新请求取代
    await loadHistoricalData()
    if (seq !== refreshSeq) return
    if (activeTab.value === 'notebookDistribution' && !notebookStatsLoaded) {
      await loadNotebookStats()
    }
  } catch (error) {
    console.error("刷新统计数据失败:", error)
  } finally {
    if (seq === refreshSeq) {  // 仅最新请求可关闭 loading
      loading.value = false
    }
  }
}
```

### 里程碑字段映射

```ts
const MILESTONE_FIELD_MAP: Record<string, keyof StatisticsData> = {
  notes: 'totalNotes', words: 'totalWords', blocks: 'totalBlocks',
  tags: 'totalTags', backlinks: 'totalBacklinks', assets: 'totalAssets',
  images: 'totalImages', notebooks: 'notebookCount', code: 'codeBlocks',
  streak: 'writingStreak', activeDays: 'activeDays',
}
```