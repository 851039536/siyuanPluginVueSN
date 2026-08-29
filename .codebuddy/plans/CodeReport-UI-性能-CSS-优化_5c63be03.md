---
name: CodeReport-UI-性能-CSS-优化
overview: 对 gitPush 的 CodeReport 报告分区做 UI 布局审查 + 性能与 CSS 优化：修复 3 处布局缺陷（sticky 表头失效、热点分区类名/注释与实现不符、日期列宽不足），解决 3 个高风险性能隐患（蜡烛图 canvas 宽度无上限、diff 全文渲染无上限、模板内返回新对象导致每次重渲染 patch style），并收敛硬编码色值、提取重复卡片样式、把 width 过渡改为 transform。
todos:
  - id: verify-boundaries
    content: 用 [subagent:code-explorer] 全量定位 gpr-/gpc- 类名引用点与硬编码色值，确认改动边界
    status: completed
  - id: fix-layout
    content: 修复布局：sticky 表头加高度上限、热点分区类名与间距、日期列宽、热点 Tab 徽章口径
    status: completed
    dependencies:
      - verify-boundaries
  - id: candlestick-perf
    content: 蜡烛图性能优化：reportMetrics 新增分桶聚合、rAF 节流、Bar 卸载、颜色常量上移 types
    status: completed
    dependencies:
      - verify-boundaries
  - id: render-hotspots
    content: 消除渲染热点：技术债务表行数据全预计算、diff 行数上限、debtInsights 单遍历与 memo
    status: completed
    dependencies:
      - verify-boundaries
  - id: css-cleanup
    content: CSS 收敛：提取 stat-card mixin、width 过渡改 transform、硬编码色改用 Token 与已有变量、补 contain
    status: completed
    dependencies:
      - fix-layout
  - id: i18n-verify
    content: 同步 i18n 分片中英文键与模板中文注释，用 [skill:universal-arch-skill] 做架构规范审查
    status: completed
    dependencies:
      - fix-layout
      - candlestick-perf
      - render-hotspots
      - css-cleanup
---

## 用户要求

对 `src/features/gitPush/components/CodeReport` 目录（代码统计报告分区，9 个组件）做三件事：

1. **审查 UI 布局**：找出布局缺陷、类名/注释与实现不符、可读性与响应式问题。
2. **优化性能**：消除渲染热点、内存与绘制量隐患。
3. **优化 CSS**：收敛硬编码、消除重复样式、把触发布局回流的动画改为合成层动画。

## 问题清单（已逐文件只读验证）

### 布局问题

- **sticky 表头失效**：`.gpr-table-wrap` 只有 `overflow-y: auto` 无高度上限，容器高度恒等于内容高度，`position: sticky; top: 0` 的表头（`.gpr-row--head` / `.gpr-author-th`）永不吸附，随面板滚走。三处使用点（技术债务表、热点汇总表、作者排行表）全中招。
- **热点分区类名/注释与实现矛盾**：模板注释写「两栏布局：左侧表格 + 右侧汇总面板」，SCSS 实为 `flex-direction: column`（纵向两行），类名 `gpr-hot-left/right` 语义错误；`gap: $spacing-4`(16px) 与同面板其它分区（`spacing-2/3`）不一致。
- **债务表日期列宽不足**：`.gpr-cell--date` 限宽 72px 且 `nowrap + ellipsis`，「3 months ago」/「3 个月前」被截断。
- **Tab 徽章口径不一致**：热点 Tab 徽章用全量 `analyzedFiles`（可达数百），但榜单只渲染 `HOTSPOT_LIMIT = 12` 条。
- **窄 Dock 下热点表路径列被压扁**：`table-layout: fixed` 下 5 列定宽合计 280px，路径列仅剩约 60px。

### 性能问题（按风险）

- **【高危】蜡烛图 canvas 宽度无上限**：`minChartWidth = dailyStats.length * 30`，「全部」范围 5 年仓库约 1800 天 → 54000px 宽容器，canvas 触顶（Chrome 单维上限 65535 / 面积上限约 2.68 亿 px），分配失败即白屏。
- **【高危】diff 全文渲染无上限**：`diffLines` 全量解析，每行 4 个 span，热门文件「全部」范围补丁可达成万行 → 数万 DOM 节点弹窗卡死（容器 `max-height` 只解决可视高度，不减 DOM）。
- **【中】模板内函数返回新对象**：`trendChipStyle()` 在 v-for 内逐行返回新 style 对象，父组件任何重渲染都触发 N 次 inline style patch（债务文件可达数百行）。
- **【中】模板内逐行调用 `relativeTime()`**：每次渲染对每行做 `Date.parse` + 字符串拼接。
- **【中】chart.js 实例常驻**：Tab 用 `v-if(visited) + v-show`，访问过的分区永久挂载，canvas 内存常驻且 `display:none` 下 ResizeObserver 尺寸归零可能触发 resize 抖动。
- **【中低】scroll 事件无节流**：`updateScrollState` 每事件同步读三个几何属性（强制 layout）并更新 2 个 ref。
- **【低】**`buildSeverityDist` 4 次 filter（O(4n)）、`createCoupledIndex.get()` 未缓存、`Math.max(...arr.map())` 扩展运算符爆栈风险、`FileDetailModal` keydown 监听常驻。

### CSS 问题

- **重复样式**：`.gpr-card*` 与 `.gpc-card*` 几乎逐行同构，未走 `index.scss` 已建立的共享基座约定。
- **width 过渡触发回流**：`.gpr-net-bar-fill { transition: width }` 是布局属性，N 行同时变化连续回流。
- **硬编码色值**：`CandlestickSection.scss` 4 处涨跌/均线色（与 `.vue` 内 7 个 JS 常量双源重复）、`AuthorContributionSection.scss` 3 个奖牌色 + 3 个 TOP3 底色、`FileDetailModal.scss` `#28a745/#dc3545`（已有 `--gp-diff-*` 变量却未用）。
- **缺少 `contain` / `content-visibility`**。
- **弱化文字混用** `opacity` 与 `--b3-theme-on-surface-light`，暗/亮主题对比度不稳定。

## 预期效果

修复后：长表格表头吸顶、热点分区类名与布局语义一致、日期列不截断、Tab 徽章与可见条目一致；长范围报告不再因 canvas/diff 规模卡死或白屏；样式去重、无硬编码色、动画走合成层。

## 技术栈

沿用项目既有栈，不引入新依赖：

- Vue 3 `<script setup lang="ts">` + `computed` / `ref` / `watch`
- chart.js 4 + vue-chartjs（`Bar`）
- SCSS（`styles/` 目录分离，组件双行 `@use`），Codex 设计 Token（`src/_variables.scss`）
- 数据层纯函数：`reportMetrics.ts` / `debtInsights.ts` / `utils.ts`
- i18n 分片：`src/i18n/{zh_CN,en_US}/gitPush.json`

## 实施策略

按「先修正确性问题 → 再消性能隐患 → 最后收敛样式」三层推进，每层内部按文件批量改动，避免上下文切换。**所有纯函数新增一律落在 `reportMetrics.ts` / `debtInsights.ts`，不塞进 `.vue`**（`CandlestickSection.vue` 已 538 行，超 500 行硬阈值）。

### 关键决策与取舍

**1. 蜡烛图超长序列 → 分桶聚合（而非单纯限宽）**

单纯给 `minChartWidth` 设上限会让 1800 根蜡烛挤进 3000px（每根 1.6px，且 `maxBarThickness: 16` 导致重叠不可读），绘制量也不降。改为在 `reportMetrics.ts` 新增纯函数按连续天数分桶：

- 阈值 `MAX_CANDLES = 180`，桶大小 `ceil(n / MAX_CANDLES)` 天
- 每桶合成一根 K：`count` 求和、`open` 取桶首日 open、`close` 取桶末日 close、`high = max(high)`、`low = min(low)`、`date` 取桶首日
- 效果：`minChartWidth` 上限恒为 `180 × 30 = 5400px`，绘制元素从 1800 降到 180（降 90%），可读性反而提升
- 代价：「全部」范围展示语义从「每日」变为「每 N 日」，需在图例区标注已聚合（新增 i18n 键）
- 组件内 `stats` computed 改为消费聚合结果，`calcMovingAverage7` / `weekdayBars` / `summaryCards` 仍用原始 `dailyStats`（节奏与摘要不受聚合影响，语义更准）

**2. diff 超长 → 行数上限 + content-visibility 组合**

仅用 `content-visibility: auto` 仍需创建全量 DOM 节点（省的是渲染/布局，不省内存与解析）。故：

- 组件侧 `diffLines` computed 截断到 `MAX_DIFF_LINES = 1500`，超出追加「还有 N 行未显示」提示行（新增 i18n 键）
- `parseDiffLines` 仍全量解析（纯 JS，成本远低于 DOM），但只对前 1500 行建虚拟 DOM
- SCSS 侧 `.gpr-fm-dl` 加 `content-visibility: auto` + `contain-intrinsic-size`，进一步跳过屏外行渲染

**3. chart.js 常驻 → 对 `<Bar>` 单独 `v-if`**

不给整个 `CandlestickSection` 加 `v-if`（会丢失 `scrollLeft` 与 `visited` 状态），只在组件内对 `<Bar>` 加 `v-if="active"`，由父组件下传 `active` prop。切走时 canvas 与 chart 实例销毁（vue-chartjs 在 unmount 时调 `chart.destroy()`），切回时重建，滚动位置由组件本地 ref 保存并在重建后恢复。

**4. sticky 表头 → 给 `.gpr-table-wrap` 加高度上限**

`max-height: 50vh` + `min-height` 兜底，配合 `contain: paint`。三处使用点自动生效，无需改组件。技术债务表含展开行，内部滚动可接受。

**5. 渲染热点 → 预计算到 computed**

`trendChipStyle` / `trendChipText` / `relativeTime` 全部下沉进 `groups` computed，模板只读 `row.trendStyle` / `row.trendText` / `row.lastModifiedText`。对象引用稳定后，父组件重渲染不再触发逐行 style patch。

## 执行要点（防回归）

- **类名重命名**：`gpr-hot-left/right` → `gpr-hot-main/gpr-hot-summary`。改动前须确认这两个类名只出现在 `HotspotSection.vue` + `HotspotSection.scss`（初步 grep 已确认无第三方引用，实施时再验一次）。
- **CSS 变更的连带影响**：`.gpr-table-wrap` 加 `max-height` 会影响全部 3 个使用点；`.gpr-card*` / `.gpc-card*` 提取 mixin 后需确认 `CandlestickSection` 的 `text-align: center` 差异被 mixin 参数覆盖，视觉零变化。
- **transform 替代 width**：`.gpr-net-bar-fill` 改 `transform: scaleX(var(--gpr-net-fill))` + `transform-origin: right` + 父级 `overflow: hidden`。内联 style 从 `{ width: '37%' }` 改为 `{ '--gpr-net-fill': 0.37 }`。净增为 0 时保持 `scaleX(0)`，视觉与现一致。
- **颜色单一数据源**：canvas 无法用 CSS var，`CandlestickSection.vue` 的 7 个颜色常量上移到 `types/report.ts` 导出（`REPORT_CHART_COLORS`），SCSS 侧仍用字面量但加注释指向该常量（SCSS 无法 import TS，属已知限制，靠注释+命名一致防漂移）。`FileDetailModal.scss` 的 `#28a745 / #dc3545` 改为 `var(--gp-diff-add-color) / var(--gp-diff-del-color)`（该文件已 `@include gp-diff-color-vars`）。
- **i18n**：只改分片 `src/i18n/{zh_CN,en_US}/gitPush.json`，中英同步新增，提交前跑 `pnpm i18n:verify`。顶层合并 JSON 禁止手改。
- **模板注释**：每处 i18n 渲染位上方补中文注释标明实际显示文案，主要结构区块补中文区块注释（项目硬规则）。
- **验证由用户执行**：AI 不运行 `pnpm vite build` / `pnpm lint`（项目硬规则）。需执行的验证：`pnpm lint`、`pnpm i18n:verify`、`pnpm validate:icons`、`npx tsc --noEmit`。

## 架构设计

改动严格落在既有三层内，不新增架构模式：

```
数据/工具层（纯函数，无 Vue 响应式）
  reportMetrics.ts    ← 新增 collapseDailyStats（蜡烛分桶聚合）
  debtInsights.ts     ← buildSeverityDist 单遍历 + createCoupledIndex memo
  types/report.ts     ← 新增 REPORT_CHART_COLORS 常量
        ↓ 只读消费
视图层（.vue）
  index.vue                ← Tab 徽章口径、下传 active
  CandlestickSection.vue   ← 聚合接入 / rAF 节流 / Bar v-if
  TechDebtSection.vue      ← 行数据全预计算
  HotspotSection.vue       ← 类名语义化
  FileDetailModal.vue      ← diff 行数上限
  AuthorContributionSection.vue ← net bar 改 transform
        ↓ @use
样式层（styles/）
  index.scss          ← .gpr-table-wrap 高度上限 + contain + 共享卡片类
  _mixins.scss        ← 新增 stat-card mixin
  各组件专属 .scss    ← 硬编码收敛、contain、content-visibility
```

## 目录结构

```
src/features/gitPush/
├── reportMetrics.ts                       # [MODIFY] 新增 collapseDailyStats(list, maxCandles)：按连续天数分桶合成 K 线（count 求和 / open 取桶首 / close 取桶末 / high-low 取极值 / date 取桶首日）。纯函数、无 Vue 依赖，供 CandlestickSection 消费。
├── debtInsights.ts                        # [MODIFY] ①buildSeverityDist 改单次遍历计数（消除 4 次 filter 与后置 .filter）②createCoupledIndex 内部加 Map memo，同 path 重复 get 直接命中缓存。
├── types/
│   └── report.ts                          # [MODIFY] 新增 REPORT_CHART_COLORS 常量（UP/DOWN/FLAT/MA/GRID/AXIS/WORK_BG），作为 canvas 与 SCSS 的单一语义源。
├── styles/
│   ├── index.scss                         # [MODIFY] ①.gpr-table-wrap 加 max-height: 50vh + contain: paint，让 sticky 表头真正吸附 ②新增 .gpr-card 共享基座（卡片/数值/标签）供团队总览与提交趋势复用。
│   ├── _mixins.scss                       # [MODIFY] 新增 stat-card / stat-card-value / stat-card-label 三个 mixin，消除 TeamOverview 与 Candlestick 的逐行重复。
│   ├── CandlestickSection.scss            # [MODIFY] 复用 stat-card mixin 替换 .gpc-card*；4 处硬编码色加注释指向 REPORT_CHART_COLORS；图例/摘要区加 contain。
│   ├── TeamOverviewSection.scss           # [MODIFY] .gpr-card* 改为复用 stat-card mixin（保留 .gpr-card--accent）。
│   ├── TechDebtSection.scss               # [MODIFY] .gpr-cell--date 宽度 72px → 96px（容纳中英文相对时间文案）。
│   ├── HotspotSection.scss                # [MODIFY] .gpr-hot-left/right → .gpr-hot-main/gpr-hot-summary；gap: $spacing-4 → $spacing-3；新增窄屏媒体查询（<420px 隐藏低优先级列）。
│   ├── AuthorContributionSection.scss     # [MODIFY] .gpr-net-bar-fill 的 width 过渡改 transform: scaleX() + transform-origin: right + 父级 overflow: hidden；3 个奖牌色与 3 个 TOP3 底色加语义注释并规整。
│   └── FileDetailModal.scss               # [MODIFY] #28a745/#dc3545 → var(--gp-diff-add-color)/var(--gp-diff-del-color)；.gpr-fm-dl 加 content-visibility: auto + contain-intrinsic-size。
├── components/CodeReport/
│   ├── index.vue                          # [MODIFY] ①热点 Tab 徽章 count 改 report.hotspots.length（与 HOTSPOT_LIMIT 一致）②向 CandlestickSection 下传 active prop ③补模板中文注释。
│   ├── CandlestickSection.vue             # [MODIFY] ①stats 接入 collapseDailyStats（保留原始 dailyStats 供节奏/摘要用）②minChartWidth 加硬上限 ③scroll 监听改 rAF 节流 + 卸载时取消 ④<Bar> 加 v-if="active"，保存/恢复 scrollLeft ⑤颜色常量改从 types/report 导入 ⑥Math.max 扩展运算符改 reduce。
│   ├── TechDebtSection.vue                # [MODIFY] ①groups computed 内预计算 trendStyle / trendText / lastModifiedText，模板不再调函数 ②删除 trendChipStyle / trendChipText 两个模板函数。
│   ├── HotspotSection.vue                 # [MODIFY] 类名 gpr-hot-left/right → gpr-hot-main/gpr-hot-summary；修正「两栏布局」错误注释为「纵向两行」；补中文区块注释。
│   ├── FileDetailModal.vue                # [MODIFY] diffLines computed 截断到 MAX_DIFF_LINES(1500)，超出渲染「还有 N 行未显示」提示（新增 i18n 键）；keydown 监听改为按 fileStat 开关注册。
│   └── AuthorContributionSection.vue      # [MODIFY] net bar 内联 style 从 width 百分比改为 --gpr-net-fill 变量（配合 SCSS 的 scaleX）；Math.max 改 reduce。
└── ...

src/i18n/
├── zh_CN/gitPush.json                     # [MODIFY] 新增 reportChartAggregated（图表已按 {0} 天聚合）、reportDiffTruncated（还有 {0} 行未显示）等键。
└── en_US/gitPush.json                     # [MODIFY] 与 zh_CN 同步新增同名键英文文案。
```

## 关键代码结构

```ts
// src/features/gitPush/reportMetrics.ts —— 蜡烛图分桶聚合（纯函数，供 CandlestickSection 消费）
export const MAX_CANDLES = 180

/**
 * 将每日提交统计按连续天数分桶压缩为不超过 maxCandles 根 K 线。
 * count 求和；open 取桶首日 open、close 取桶末日 close；high/low 取桶内极值；date 取桶首日。
 * 超过阈值时返回 { list, bucketDays }，未超过时返回 { list: 原数组, bucketDays: 1 }。
 */
export function collapseDailyStats(
  daily: DailyCommitStat[],
  maxCandles?: number,
): { list: DailyCommitStat[], bucketDays: number }
```

```ts
// src/features/gitPush/types/report.ts —— 图表配色单一数据源（canvas 不支持 CSS var）
export const REPORT_CHART_COLORS = {
  up: "#10b981",
  down: "#ef4444",
  flat: "#64748b",
  ma: "#f59e0b",
  grid: "rgba(128, 128, 128, 0.12)",
  axis: "rgba(128, 128, 128, 0.8)",
  workBg: "rgba(148, 163, 184, 0.08)",
} as const
```

## Agent Extensions

### Skill

- **universal-arch-skill**
- Purpose：对改动后的 CodeReport 分区做架构规范审查，校验「模块内三层分层（共享常量→types / 纯函数→utils / 视图→.vue）」「SCSS 必须分离到 styles/」「禁用硬编码 font-size/font-weight/line-height/颜色，必须用设计 Token」「单文件行数上限」等 AGENTS.md 硬规则。
- Expected outcome：产出合规/违规清单，确认新增的 `collapseDailyStats` 归属正确、CandlestickSection.vue 不超 500 行、所有新增样式均使用 Token 而非硬编码值。

### SubAgent

- **code-explorer**
- Purpose：全量定位 `gpr-` / `gpc-` 类名的全部引用点、硬编码色值与硬编码尺寸的分布，确认类名重命名与共享基座提取不会漏改或误伤其它面板。
- Expected outcome：给出受影响文件清单与调用点行号，作为批量改动的边界依据，避免遗漏与越界修改。