---
name: superPanel-2x2-grid-layout
overview: 将 superPanel 功能列表从单列纵向排列改为 2×2 网格布局，卡片从水平行式改为纵向卡片式。
todos:
  - id: grid-layout
    content: 将 `.feature-list-inner` 改为 CSS Grid 两列布局，并添加窄屏单列响应式回退
    status: completed
  - id: card-vertical
    content: 将 `.feature-card` 及子元素样式从水平行式重构为纵向卡片式布局
    status: completed
    dependencies:
      - grid-layout
  - id: verify-animation
    content: 验证并微调过渡动画、hover 效果、状态色在网格布局下的表现
    status: completed
    dependencies:
      - card-vertical
---

## 用户需求

将超级面板（superPanel）的功能列表页面排版从当前的**单列纵向列表**改为 **2x2 网格布局**（两列卡片）。

## 核心功能

- 功能卡片以 2 列网格排列，替代当前的单列竖向堆叠
- 卡片从横向行式布局改为纵向卡片式布局（图标上方、信息下方）
- 保持现有的搜索过滤、状态统计、版本徽章、操作按钮等功能不变
- 保持现有的过渡动画、hover 效果、状态色等视觉细节
- 响应式适配：窄屏时自动降级为单列

## 技术方案

### 实现策略

纯 CSS 重构，不修改任何 Vue 模板或 TypeScript 逻辑。通过将 `.feature-list-inner` 从 `flex` 列布局改为 CSS Grid 两列布局，同时将 `.feature-card` 从水平行式改为垂直卡片式，实现 2x2 网格效果。

### 修改范围

仅涉及两个 SCSS 文件的样式修改：

1. **`styles/index.scss`** — 修改 `.feature-list-inner`：

- `display: flex; flex-direction: column; gap: 2px;` → `display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;`
- 添加响应式规则：窄屏回退单列

2. **`styles/feature-card.scss`** — 修改 `.feature-card` 及子元素：

- `.feature-card`：从 `display: flex; align-items: center;` 改为 `display: flex; flex-direction: column;`，添加 `min-height` 和 `padding` 适配卡片式
- `.feature-icon`：居中，增大尺寸适配网格卡片
- `.feature-body`：堆叠排列，`.feature-info` 改为换行 flex-wrap
- `.feature-actions`：保持在卡片底部，hover 时显示（复用现有 opacity transition）
- `.feature-right`：移到卡片底部区域

### 关键决策

- **CSS Grid 优于 Flex Wrap**：Grid 天然适合 "每行固定 2 个" 的需求，间隙均匀，无需计算宽度
- **纵向卡片式布局**：网格中的每个单元格是独立卡片，图标在上、信息在下、操作在底部，视觉聚焦且易扫读
- **不改模板**：所有布局变化通过 CSS 实现，避免引入模板逻辑变更风险

### 性能考量

- CSS Grid 在现代浏览器中性能优异，2 列网格无渲染瓶颈
- 保留现有 `TransitionGroup` 动画，无需额外 JS 计算