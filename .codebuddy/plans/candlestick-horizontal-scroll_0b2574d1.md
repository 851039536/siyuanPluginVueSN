---
name: candlestick-horizontal-scroll
overview: 为 K 线图容器添加水平滚动能力：计算 minChartWidth = stats.length * 30px，当超过容器宽度时 overflow-x:auto 出现横向滚动条，保持每根蜡烛至少 30px 宽度。
todos:
  - id: template-scroll
    content: CandlestickSection.vue 模板：.gpc-chart-wrap 外套 .gpc-chart-scroll 滚动容器，chart-wrap 绑定 :style 动态 min-width/width
    status: completed
  - id: script-minwidth
    content: CandlestickSection.vue 脚本：新增 MIN_WIDTH_PER_DAY=30 常量 + minChartWidth computed
    status: completed
  - id: scss-scroll
    content: CandlestickSection.scss：新增 .gpc-chart-scroll overflow-x:auto 样式，.gpc-chart-wrap 加 width/min-width 支持
    status: completed
---

## 用户需求

K 线图日期较多时（如分析 6 个月约 90 天），每根蜡烛被挤压到几乎不可见。超过一定宽度后，图表容器应出现水平滚动条，允许用户左右滑动查看完整 K 线图。

## 核心功能

- 每根蜡烛至少保持 30px 宽度（含间距），确保实体（maxBarThickness=16px）+ 间距不会拥挤
- 当日数较少时（≤25 条），图表正常填满容器，无滚动条
- 当日数超过阈值时，图表容器按 `日期数 × 30px` 扩宽，超出父容器部分通过横向滚动查看
- 切换项目/时间范围时，宽度响应式更新，图表自动跟随

## 技术栈

- Vue 3 Composition API + TypeScript
- chart.js + vue-chartjs（已有，无需升级）
- SCSS（Codex 设计 Token）

## 实现方案

### 核心思路

当前 `.gpc-chart-wrap` 固定高度 260px，宽度随父容器自适应。问题在于 chart.js 的 `responsive: true` 只能把蜡烛压缩，不能触发容器自身扩宽。

解决方式：在 `.gpc-chart-wrap` 外套一层滚动容器，让内部的图表容器可以超过父容器宽度，外层通过 `overflow-x: auto` 产生滚动条。chart.js 的 ResizeObserver 会自动检测容器扩宽并重绘，无需改动 chart 配置。

### 关键决策

- **每根蜡烛占地 30px**：实体 16px + 左右各 7px 间距，不会拥挤，100 天 = 3000px ≈ 可接受的水平滚动距离
- **不引入第三方虚拟滚动库**（如 chartjs-plugin-zoom）：滚动条是浏览器原生能力，零依赖，零学习成本，用户直觉操作
- **不改变 chart.js 配置**：`responsive: true` + `maintainAspectRatio: false` 保持不变，ResizeObserver 自动处理

### 边界情况

| 场景 | 行为 |
| --- | --- |
| 0 日期 | EmptyState 接管，不渲染图表区域 |
| 1~25 天 | minChartWidth ≤ 容器可用宽度，无滚动条，行为不变 |
| 26+ 天 | minChartWidth > 容器可用宽度，出现水平滚动条 |
| 切换项目/范围 | `stats.length` 变化 → `minChartWidth` 响应式更新 → chart.js ResizeObserver 重绘 |


## 目录结构

```
src/features/gitPush/
├── components/report/
│   └── CandlestickSection.vue  # [MODIFY] 模板加滚动容器 + 新增 minChartWidth computed
└── styles/
    └── CandlestickSection.scss # [MODIFY] 新增 .gpc-chart-scroll 滚动容器样式 + .gpc-chart-wrap 宽度调整
```