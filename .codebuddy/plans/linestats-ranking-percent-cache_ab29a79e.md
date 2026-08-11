---
name: linestats-ranking-percent-cache
overview: 为行数统计面板添加排名序号（1/2/3）、百分比占比显示、以及独立的行数统计缓存持久化（从 commitAnalysisCache 中解耦）。
todos:
  - id: add-line-stats-cache-type
    content: 新增 LineStatsCache 接口（meta.ts）、存储槽位（storage.ts）、类型重导出（types/index.ts）
    status: completed
  - id: add-cache-load-and-save
    content: useCommitAnalysis 新增 loadLineStatsCache()（专用槽优先+旧缓存回退）；ensureLineStats 改用新方法；runCore 追加 lineStatsCache 写入
    status: completed
    dependencies:
      - add-line-stats-cache-type
  - id: add-ranking-and-share
    content: LineStatsPanel.vue 模板加排名列和百分比列；computed 扩展 idx/share；LineStatsPanel.scss 新增 .gls-bar-rank/.gls-bar-share + 调整 bar-label 宽度
    status: completed
---

## 产品概述

为 gitPush 行数统计面板（LineStatsPanel）的排行榜增加三项功能：每行左侧显示排名序号（1/2/3...）、行尾显示该行新增行数占总新增的百分比（如 35.2%）、新增独立的持久化缓存槽位（与提交分析缓存解耦）。

## 核心功能

- **排名序号**：排行行左侧显示等宽序号 1、2、3...，弱化颜色不可点击
- **百分占比**：行尾显示该条目新增行数占总新增行数的百分比，保留 1 位小数
- **独立缓存持久化**：新增 LineStatsCache 存储槽位（键 git-push-line-stats-cache），行数统计分析后独立写入、切换视图优先从专用缓存恢复，旧用户首次使用时自动从 commitAnalysisCache 迁移已有行数数据

## 技术栈

- 语言：TypeScript + Vue 3（Composition API）
- 样式：SCSS（沿用 LineStatsPanel.scss 现有模式）
- 持久化：TypedStorage（已有基础设施，新增槽位）

## 实现方案

### 1. 新增 LineStatsCache 类型（解耦设计）

在 meta.ts 中新增独立于 CommitAnalysisCache 的类型：

```ts
/** 行数统计独立缓存（与提交分析缓存解耦，独立持久化） */
export interface LineStatsCache {
  commitCount: number
  analyzedAt: string
  failedCount: number
  projectLineRanking: ProjectLineRankItem[]
  authorLineRanking: AuthorLineRankItem[]
}
```

commitAnalysisCache 中的 projectLineRanking/authorLineRanking 字段**保留不变**（向后兼容），但不再作为行数视图的主要数据来源。

### 2. 持久化写入（useCommitAnalysis.ts）

`runLineStatsAnalysis()` 在 runCore(true) 内部**同步追加**写入新槽位：

```ts
// 写入独立行数统计缓存（与提交分析缓存解耦）
await manager.storage.lineStatsCache.save({
  commitCount: commitCount.value,
  analyzedAt: analyzedAt.value,
  failedCount: fail,
  projectLineRanking: projectLineRanking.value,
  authorLineRanking: authorLineRanking.value,
})
```

写入发生在已有 commitAnalysisCache 保存之后，不影响现有流程。

### 3. 持久化读取（useCommitAnalysis.ts）

新增 `loadLineStatsCache()` 方法，采用**专用槽位优先 + commitAnalysisCache 回退**策略，实现数据的平滑迁移：

1. 先尝试从 `lineStatsCache` 加载，有数据直接恢复
2. 无数据时回退到 `loadCachedAnalysis()` 读取 commitAnalysisCache 中的旧排行数据（兼容老版本升级用户）
3. 恢复时过滤已删除项目

`ensureLineStats()` 改为调用 `loadLineStatsCache()` 替代原有 `loadCachedAnalysis()`。

### 4. 排名序号 + 百分占比（LineStatsPanel.vue）

**模板改动**：

- `v-for` 加入 `idx` 变量：`v-for="(row, idx) in projectRows"`
- 标签列前插入排名列：`<span class="gls-bar-rank">{{ idx + 1 }}</span>`
- 数字列后插入百分比列：`<span class="gls-bar-share">{{ row.share }}</span>`

**computed 改动**：
当前 `withLineBarPct()` 只计算 bar 宽度，扩展 `projectRows` 和 `authorRows` computed 增加 `idx` 和 `share` 字段：

```ts
const projectRows = computed(() => {
  const rows = withLineBarPct(props.projectRanking)
  const total = rows.reduce((s, r) => s + r.added, 0) || 1
  return rows.map((r, i) => ({
    ...r,
    idx: i + 1,
    share: `${((r.added / total) * 100).toFixed(1)}%`,
  }))
})
```

### 5. 样式（LineStatsPanel.scss）

新增两列，调整标签宽度让位：

- `.gls-bar-rank`：`flex: 0 0 20px` 固定排名列宽，等宽字体，右对齐，弱化透明度 0.5
- `.gls-bar-share`：`flex: 0 0 42px` 固定百分比列宽，等宽字体，右对齐，弱化透明度 0.5
- `.gls-bar-label`：从 `88px` 缩减为 `72px`，为排名列让出 20px（总计 92px 仍接近原 88px，视觉平衡）

### 6. 导出更新（types/index.ts）

在 type 重导出行中追加 `LineStatsCache`。

## 目录结构

```
src/features/gitPush/
├── types/
│   ├── meta.ts        # [MODIFY] 新增 LineStatsCache 接口
│   ├── storage.ts     # [MODIFY] 新增 lineStatsCache 槽位 + DEFAULT_LINE_STATS_CACHE
│   └── index.ts       # [MODIFY] 重导出 LineStatsCache 类型
├── composables/
│   └── useCommitAnalysis.ts  # [MODIFY] 新增 loadLineStatsCache()；ensureLineStats 改用新方法；runCore 追加新槽位写入
├── components/analysis/
│   └── LineStatsPanel.vue    # [MODIFY] 模板加排名列+百分比列；computed 增加 idx/share
└── styles/
    └── LineStatsPanel.scss   # [MODIFY] 新增 .gls-bar-rank / .gls-bar-share；bar-label 缩宽
```

## 实现注意事项

- **向后兼容**：老用户无 lineStatsCache 槽位数据时，`loadLineStatsCache()` 自动回退读取 commitAnalysisCache 中的旧排行，实现零感知迁移
- **性能**：百分比在 computed 中计算（O(n)），排行上限仅 20（项目）+ 10（作者），无性能瓶颈
- **排名从 1 开始**：使用 `idx + 1`，符合用户直觉
- **无新增 i18n 键**：序号是纯数字、百分比是格式化字符串，无需翻译
- **% 符号**：格式化为 `"35.2%"` 字符串，CSS 层不额外处理