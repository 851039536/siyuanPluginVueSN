---
name: add-review-radar-chart
overview: 在 ReviewPanel 的"分项评分"区域增加一个纯 SVG 雷达图，直观展示 5 个维度的评分分布（准确性/结构/语言质量/格式规范/覆盖完整性），与现有条形图互补展示。
todos:
  - id: create-radar-chart-scss
    content: 新建 ReviewRadarChart.scss 雷达图样式，Codex 合规（Token 化颜色/字号/间距）
    status: completed
  - id: create-radar-chart-component
    content: 新建 ReviewRadarChart.vue 纯 SVG 五轴雷达图组件，含网格层、数据多边形、标签与分数标注
    status: completed
    dependencies:
      - create-radar-chart-scss
  - id: integrate-radar-into-review-panel
    content: 修改 ReviewPanel.vue，在分项评分条形图上方引入 ReviewRadarChart
    status: completed
    dependencies:
      - create-radar-chart-component
---

## 用户需求

在 AI 内容生成器的 ReviewPanel 审核面板"分项评分"折叠区内新增雷达图，以可视化方式展示 5 维评分（准确性/结构/语言质量/格式规范/覆盖完整），放在现有条形图上方，二者互补展示。

## 产品概述

审核面板已有条形图展示分项评分，新增雷达图提供全维度横向对比视角——用户一眼看清各维度是否均衡。

## 核心功能

- 五轴雷达图：accuracy、structure、quality、format、coverage 各一轴，等分 360°
- 颜色映射：复用现有 scoreLevel() 逻辑，>=8 分绿色、>=5 分琥珀色、<5 分红色
- 网格层：3 层同心多边形（5/8/10 分档位）作为评分基准
- 标签展示：轴端点标注中文维度的缩写标签，中心显示各维度值
- 与条形图并排展示（左右布局或上下布局），统一折叠逻辑

## 技术方案

### 实现策略

采用纯 SVG 自建雷达图组件，不引入 chart.js Radar 插件。5 个维度等分圆周（360°/5=72°），每个轴从圆心向外辐射，数据点多边形覆盖在网格上方。复用现有 `scoreLabelMap`、`scoreLevel()`、`detailedScore` 类型，零依赖新增。

### 关键技术决策

1. **纯 SVG 而非 chart.js Radar**：共享 Chart.vue 仅支持 4 种类型，扩展需同时修改组件 + 注册 RadarController + RadialLinearScale，侵入面大。纯 SVG 完全自控样式，可精准匹配 Codex 配色和 $font-size-2xs 字号。

2. **复用现有数据与映射**：

- `scoreLabelMap`：维度 key → 中文标签（准确性/结构/...）
- `scoreLevel(value)`：分数 → high/mid/low
- `detailedScore`：accuracy/structure/quality/format/coverage（1-10）

3. **SVG 渲染结构**：

- 3 层同心多边形（灰色网格线，分别对应 5/8/10 分档位）
- 5 条轴线（从圆心到顶点）
- 1 个数据填充多边形（半透明色块）+ 折线轮廓
- 5 个数据点圆标记 + 分数文字标注
- 5 个轴端点标签

4. **颜色方案**：数据多边形填充色与 `score-fill-high/mid/low` 一致（成功绿/警告琥珀/错误红），统一 Codex 语义色。

5. **布局策略**：雷达图放在条形图上方，垂直堆叠，保持"分项评分"折叠区单一信息层级。

### 架构影响

- 仅新增 `ReviewRadarChart.vue` + `ReviewRadarChart.scss`，修改 `ReviewPanel.vue` 模板引入
- 无 i18n 变更，无类型变更，无跨模块影响

## 实现要点

### 文件清单

```
src/features/aiContentGenerator/
├── components/
│   ├── ReviewRadarChart.vue   # [NEW] 纯 SVG 五轴雷达图组件
│   └── ReviewPanel.vue         # [MODIFY] 引入雷达图
└── styles/
    └── ReviewRadarChart.scss   # [NEW] 雷达图样式（Codex 合规）
```

### ReviewRadarChart.vue 设计

**Props**：

- `scores: Record<string, number>` — detailedScore 数据（accuracy/structure/quality/format/coverage，每项 1-10）
- `labels: Record<string, string>` — 维度中文标签映射
- `getLevel: (value: number) => string` — 分数→颜色等级函数

**SVG 坐标系**（viewBox="-80 -80 160 160"，中心原点）：

- 5 轴角度：-90° → -90°+72° → ... → 342°（y 轴负向为 0 度，顺时针）
- 各点坐标通过 `cos(θ)*R` / `sin(θ)*R` 计算，R 为分数归一化后的半径（maxRadius=60）
- 网格层：R=30（5分）、R=48（8分）、R=60（10分）
- 标签偏移：在轴端点外 14px 处放置文字，微调 dx/dy 避免与多边形重叠

**核心 computed**：

- `axes`：5 个轴的角度与基础矢量数组
- `gridPolygons`：3 层同心多边形 points 字符串
- `dataPolygon`：实际分数多边形 points 字符串
- `dataPoints`：5 个数据点坐标 + 标签文本 + 分数文字

### ReviewRadarChart.scss 设计

```
@use "../../../variables" as *;

.review-radar-chart {
  display: flex;
  justify-content: center;
  padding: $spacing-1 0 $spacing-2;
}

.review-radar-svg {
  overflow: visible;
}

// 网格多边形
.radar-grid-ring {
  fill: none;
  stroke: var(--b3-theme-surface-lighter);
  stroke-width: 0.5;
}

// 轴线
.radar-axis-line {
  stroke: var(--b3-theme-surface-lighter);
  stroke-width: 0.5;
}

// 数据填充区
.radar-data-area {
  fill-opacity: 0.15;
  stroke-width: 1.2;
  stroke-linejoin: round;

  &.level-high { fill: var(--b3-theme-success); stroke: var(--b3-theme-success); }
  &.level-mid  { fill: var(--b3-theme-warning); stroke: var(--b3-theme-warning); }
  &.level-low  { fill: var(--b3-theme-error); stroke: var(--b3-theme-error); }
}

// 数据点
.radar-data-dot {
  fill: var(--b3-theme-background);
  stroke-width: 1.2;

  &.level-high { fill: var(--b3-theme-success); stroke: var(--b3-theme-background); }
  &.level-mid  { fill: var(--b3-theme-warning); stroke: var(--b3-theme-background); }
  &.level-low  { fill: var(--b3-theme-error); stroke: var(--b3-theme-background); }
}

// 标签与分数文字
.radar-axis-label {
  font-size: $font-size-2xs;
  fill: var(--b3-theme-on-surface);
  text-anchor: middle;
}

.radar-score-label {
  font-size: $font-size-2xs;
  font-weight: $font-weight-semibold;
  font-family: $vp-mono;
  text-anchor: middle;
}
```

### ReviewPanel.vue 修改

在分项评分区域内，雷达图放在 `subsection-body` 中、条形图上方：

```
<div v-if="showScores" class="subsection-body">
  <!-- 雷达图 -->
  <ReviewRadarChart
    :scores="reviewResult.detailedScore"
    :labels="scoreLabelMap"
    :get-level="scoreLevel"
  />
  <!-- 条形图（保持不变） -->
  <div v-for="(value, key) in ..." ...></div>
</div>
```

Import：`import ReviewRadarChart from "./ReviewRadarChart.vue"`

### 验证

- 用户自行运行 `pnpm lint` + `npx tsc --noEmit` 确认编译通过
- 雷达图与条形图在视觉上互补，不冲突