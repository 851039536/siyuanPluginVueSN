---
name: git-commit-candlestick-chart
overview: 在 CodeReportPanel.vue 中新增第 4 个 Tab "提交K线图"，用 chart.js financial 蜡烛图展示 Git 提交的时间趋势分布（每日/每周维度），需要新增数据聚合工具函数、Vue 组件、SCSS 样式、i18n 翻译和 Tab 注册。
todos:
  - id: add-daily-stats
    content: 在 reportMetrics.ts 中新增 aggregateDailyStats() 数据聚合函数和 DailyCommitStat 类型
    status: completed
  - id: create-candlestick-component
    content: 创建 CandlestickSection.vue K 线图组件（chart.js Bar + 自定义 Plugin 渲染实体柱与影线）
    status: completed
    dependencies:
      - add-daily-stats
  - id: create-candlestick-scss
    content: 创建 CandlestickSection.scss 样式文件（图表容器、摘要卡片、Codex 风格）
    status: completed
    dependencies:
      - create-candlestick-component
  - id: add-i18n-keys
    content: 在 zh_CN/gitPush.json 和 en_US/gitPush.json 中新增 5 个 i18n 键
    status: completed
  - id: integrate-tab
    content: 修改 CodeReportPanel.vue：扩展 ReportTabId 类型、新增第 4 个 Tab 条目、引入 CandlestickSection 组件
    status: completed
    dependencies:
      - create-candlestick-component
      - add-i18n-keys
---

## 用户需求

在 `CodeReportPanel.vue`（代码统计报告面板）中新增第 4 个 Tab 页面，展示 Git Commit K 线图（蜡烛图），直观呈现项目在选定时间范围内的每日/每周提交趋势。

## 核心功能

- 新增「提交趋势」Tab 页，以 K 线图（蜡烛图）形式展示每日或每周的提交活动
- K 线图包含：实体柱（提交总数）、上影线（该时段最早/最晚提交时间范围）、颜色区分涨跌（当日提交数 vs 前日提交数）
- 数据来源于现有的 `NumstatCommit[]`（已由 `useCodeReport` 获取），无需额外 git 命令
- 图下方展示简要统计摘要（如总提交天数、日均提交数、最高单日提交数）

## 技术栈

- 前端框架：Vue 3 + TypeScript
- 图表渲染：chart.js 4.5 + vue-chartjs 5.3（已安装）
- 样式：SCSS（Codex 设计系统）
- 数据聚合：纯 TypeScript 工具函数（在 `reportMetrics.ts` 中新增）

## 实现方案

### 方案选择：chart.js Bar 类型实现 K 线图

使用 chart.js 内置的 `bar` 类型 + floating bar 技术（数据格式 `[low, high]`）模拟蜡烛图效果，配合自定义插件绘制影线。此方案无需安装任何新依赖（`chartjs-chart-financial` 和 `luxon` 都不需要），且与项目已有的 `Chart.vue` 通用组件风格一致。

### 实现策略

1. **数据聚合层**（`reportMetrics.ts` 新增函数）：从 `NumstatCommit[]` 聚合每日统计

- 按日期（`YYYY-MM-DD`）分组
- 每组的 OHLC 指标：`open`（当日最早提交的小时数）、`high`（最大提交数，这里用小时范围的高点）、`low`（最小提交数/小时范围低点）、`close`（当日最晚提交的小时数）、`count`（提交总数）
- 实际更适合 Git K 线图的语义：开盘=当日第一条提交时间（小时）、收盘=当日最后一条提交时间（小时）、最高=当日最多提交的小时数、最低=当日最少提交的小时数、实体=当日总提交数

2. **K 线图组件**（`CandlestickSection.vue`）：

- 使用 chart.js `Bar` 控制器，数据点为 `[low, high]` 格式实现浮动条形
- 通过自定义插件 `CandlestickPlugin` 在浮动条形上叠加影线（wicks）和颜色
- 红色实体 = 收盘 < 开盘（提交减少），绿色实体 = 收盘 > 开盘（提交增加）
- 下方展示摘要统计卡片

3. **集成到 CodeReportPanel.vue**：

- `ReportTabId` 类型扩展为 `"overview" | "debt" | "hotspot" | "candlestick"`
- `reportTabs` computed 新增第 4 个条目
- 模板中新增 `<CandlestickSection v-show="activeTab === 'candlestick'" />`

### 数据流

```
NumstatCommit[] (已有)
  → aggregateDailyStats() [新增聚合函数]
  → DailyCommitStat[] (日期/开盘时/收盘时/最高时/最低时/总数)
  → CandlestickSection.vue (chart.js Bar + 自定义插件渲染)
```

### 性能考量

- 数据聚合为 O(n) 单次遍历，提交数通常不超过数千条，性能无压力
- chart.js 渲染使用 Canvas，数据点按天聚合后最多 365 个数据点（1年），渲染流畅

## 架构设计

### 组件关系

```
CodeReportPanel.vue (父)
  ├── TeamOverviewSection.vue     [Tab 1: overview]
  ├── AuthorContributionSection.vue [Tab 1: overview]
  ├── TechDebtSection.vue          [Tab 2: debt]
  ├── HotspotSection.vue           [Tab 3: hotspot]
  └── CandlestickSection.vue       [Tab 4: candlestick] ← NEW
```

### 目录结构

```
src/features/gitPush/
├── reportMetrics.ts                        # [MODIFY] 新增 aggregateDailyStats() 导出
├── components/report/
│   ├── CodeReportPanel.vue                 # [MODIFY] Tab 类型扩展 + 新增第 4 个 Tab
│   └── CandlestickSection.vue              # [NEW] K 线图组件
├── styles/
│   ├── CodeReportPanel.scss                # [MODIFY] 无需修改（Tab 样式复用现有）
│   └── CandlestickSection.scss             # [NEW] K 线图专属样式
├── i18n/
│   ├── zh_CN/gitPush.json                  # [MODIFY] 新增 5 个 i18n 键
│   └── en_US/gitPush.json                  # [MODIFY] 新增 5 个 i18n 键
```

## 实现细节

### 数据聚合函数（reportMetrics.ts 新增）

```typescript
/** 每日提交统计（K 线图数据源） */
export interface DailyCommitStat {
  /** 日期 YYYY-MM-DD */
  date: string
  /** 开盘：当日第一条提交的小时数（0~23） */
  open: number
  /** 收盘：当日最后一条提交的小时数（0~23） */
  close: number
  /** 最高：当日最晚提交小时 */
  high: number
  /** 最低：当日最早提交小时 */
  low: number
  /** 当日提交总数（实体大小） */
  count: number
}

/** 从 NumstatCommit[] 按日期聚合每日提交统计 */
export function aggregateDailyStats(commits: NumstatCommit[]): DailyCommitStat[]
```

### K 线图渲染策略

- 使用 chart.js `Bar` 类型，每个数据点的 y 值为 `[low, high]`（floating bar）
- 通过 `Chart.register()` 注册自定义 plugin，在 `afterDraw` 钩子中用 Canvas 2D API 绘制：
- 实体柱颜色：红色（`#ef4444`，count 下降）/ 绿色（`#10b981`，count 上升）
- 影线（wicks）：从 low 到 high 的细线，颜色同实体柱
- x 轴为日期，y 轴为小时（0~24），柱宽自适应

### i18n 键（中英文各新增）

| 键 | 中文 | 英文 |
| --- | --- | --- |
| `reportTabCandlestick` | 提交趋势 | Commit Trend |
| `reportCandlestickTitle` | 提交趋势 | Commit Trend |
| `reportCandlestickTotalDays` | 提交天数 | Active Days |
| `reportCandlestickAvgDaily` | 日均提交 | Avg Daily |
| `reportCandlestickMaxDaily` | 最高单日 | Peak Day |


### 样式规范

- 遵循 Codex 设计 Token（`$spacing-*`、`$radius-*`、`$font-size-xs` / `$font-size-2xs`）
- 图表容器使用 `border: 1px solid var(--b3-border-color)` + `border-radius: $radius-base`
- 摘要卡片复用 `.gpr-cards` / `.gpr-card` 样式（与 TeamOverviewSection 一致）
- 禁止 box-shadow，禁止硬编码尺寸