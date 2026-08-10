---
name: candlestick-scroll-buttons
overview: 在 K 线图左右两侧中间位置添加半透明滚动箭头图标，点击平滑滚动，悬停高亮，与 K 线图 Codex 风格一致。
design:
  styleKeywords:
    - Codex Minimalism
    - Semi-transparent
    - Circular
    - Subtle
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 12px
      weight: 400
    subheading:
      size: 10px
      weight: 400
    body:
      size: 10px
      weight: 400
  colorSystem:
    primary:
      - var(--b3-theme-primary)
    background:
      - var(--b3-theme-surface)
      - var(--b3-theme-primary-lightest)
    text:
      - var(--b3-theme-on-surface)
    functional:
      - var(--b3-border-color)
todos:
  - id: template-buttons
    content: CandlestickSection.vue 模板：新增 .gpc-chart-scroll-area 相对定位包裹层 + 左右两个滚动按钮（Icon+chevron图标），绑定 scrollRef、click 事件和 disabled 状态
    status: completed
  - id: script-scroll-logic
    content: CandlestickSection.vue 脚本：新增 ref/nextTick/onMounted/onUnmounted 导入 + Icon 导入 + SCROLL_AMOUNT=300 常量 + scrollRef/canScrollLeft/canScrollRight 响应式状态 + updateScrollState/handleScrollLeft/handleScrollRight 函数 + scroll 事件监听与清理
    status: completed
    dependencies:
      - template-buttons
  - id: scss-button-styles
    content: CandlestickSection.scss：新增 .gpc-chart-scroll-area(position:relative) + .gpc-scroll-btn(圆形半透明绝对定位、hover高亮、is-disabled极透明禁用) + .gpc-scroll-btn--left/--right 左右定位变体
    status: completed
    dependencies:
      - template-buttons
  - id: i18n-scroll-keys
    content: i18n：zh_CN 新增 reportScrollLeft(向左滚动)/reportScrollRight(向右滚动)，en_US 新增 reportScrollLeft(Scroll Left)/reportScrollRight(Scroll Right)，插入 reportWeekSat 之后
    status: completed
---

## 产品概述

为 K 线图（提交趋势蜡烛图）左右两侧中部添加半透明可点击的滑动箭头按钮，提升用户在日期较多时的横向滚动交互体验。

## 核心功能

- 左侧按钮：点击后平滑向左滚动 300px，查看更早日期的数据
- 右侧按钮：点击后平滑向右滚动 300px，查看最新日期的数据
- 半透明默认样式（opacity: 0.45），鼠标悬停时高亮为完全不透明 + 主题色描边
- 滚动到最左端时左侧按钮自动禁用（灰色不可点击），滚动到最右端时右侧按钮自动禁用
- 按钮外观为 28px 圆形边框，内置 `mdi:chevron-left` / `mdi:chevron-right` 图标，与 K 线图 Codex 风格一致
- 切换项目/时间范围后滚动状态自动重置

## 技术栈

- Vue 3 Composition API + TypeScript
- `@iconify/vue` 的 `Icon` 组件（项目中已有大量先例）
- SCSS（Codex 设计 Token）

## 实现方案

### 核心思路

在 `.gpc-chart-scroll` 外层增加一个 `position: relative` 的 `.gpc-chart-scroll-area` 容器，左右各放置一个 `position: absolute; top: 50%; transform: translateY(-50%)` 的圆形按钮。按钮默认半透明，hover 时高亮。通过监听滚动容器的 `scroll` 事件实时更新左/右按钮的禁用状态。

### 关键决策

- **滚动步长 300px**：约 10 根蜡烛的宽度（30px/根），单次点击滚动量适中
- **始终渲染按钮**（`stats.length > 0` 时）：日期少时按钮也在但点击无效果（`scrollBy` 在无溢出时无操作），避免 DOM 结构闪烁
- **边界自动禁用**：`scrollLeft <= 1` 禁用左按钮，`scrollLeft >= scrollWidth - clientWidth - 1` 禁用右按钮，使用 `passive: true` 的 scroll 事件零性能影响
- **定位策略**：绝对定位覆盖在图表区域边缘，不挤占图表空间
- **ViewChild 模式**：使用 `ref<HTMLElement | null>(null)` 获取滚动容器 DOM 引用，符合 Vue 3 标准做法

### 边界情况

| 场景 | 行为 |
| --- | --- |
| 0 日期 | EmptyState 接管，按钮不渲染 |
| 1~25 天（无溢出） | 按钮显示但均禁用（左右都不可滚动） |
| 26+ 天且滚动到最左 | 左按钮禁用，右按钮可用 |
| 26+ 天且滚动到最右 | 右按钮禁用，左按钮可用 |
| 切换项目/范围触发数据更新 | `watch(stats)` 调用 `nextTick` 后重新检测滚动状态 |


## 目录结构

```
src/features/gitPush/
├── components/report/
│   └── CandlestickSection.vue  # [MODIFY] 模板加 scroll-area 包裹层 + 左右按钮；脚本加 ref/onMounted/onUnmounted/nextTick + scroll 逻辑 + Icon import
├── styles/
│   └── CandlestickSection.scss # [MODIFY] 新增 .gpc-chart-scroll-area + .gpc-scroll-btn + 左/右变体 + disabled 状态
├── i18n/
│   ├── zh_CN/gitPush.json      # [MODIFY] 新增 reportScrollLeft/reportScrollRight
│   └── en_US/gitPush.json      # [MODIFY] 新增 reportScrollLeft/reportScrollRight
```

## 设计风格

沿用 Codex 极简风格，按钮采用半透明圆形边框样式，与图表容器边框一致。默认状态低调融入背景（opacity: 0.45），hover 时高亮为主题色描边，提供清晰的交互反馈。禁用状态极度透明（opacity: 0.18），视觉上退出焦点。

## 按钮规格

- 尺寸：28×28px 正圆形（`border-radius: $radius-full`）
- 定位：绝对定位，垂直居中于图表区域（`top: 50%; transform: translateY(-50%)`），左按钮 `left: 0`，右按钮 `right: 0`
- 边框：`1px solid var(--b3-border-color)`，悬停时变 `var(--b3-theme-primary)`
- 背景：`var(--b3-theme-surface)`，悬停时变 `var(--b3-theme-primary-lightest)`
- 图标：`mdi:chevron-left` / `mdi:chevron-right`，14px 高度，颜色继承 `var(--b3-theme-on-surface)`
- 过渡：opacity / background / border-color 统一 0.15s ease