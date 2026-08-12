---
name: gitPush-行数统计单栏布局与UI优化
overview: 将 gitPush 行数统计面板从双栏并排改为单栏堆叠布局，并在顶部增加总新增/总删除/总净增汇总统计卡片，辅以轻微 UI 润色（间距、色块、行 hover 反馈）。
design:
  styleKeywords:
    - 单栏堆叠
    - 边框卡片
    - 等宽数字
    - 语义着色
    - 弱化层级
  fontSystem:
    fontFamily: Helvetica Neue
    heading:
      size: $font-size-lg
      weight: .nan
    subheading:
      size: $font-size-xs
      weight: .nan
    body:
      size: $font-size-2xs
      weight: .nan
  colorSystem:
    primary:
      - var(--b3-theme-primary)
    background:
      - var(--b3-theme-surface)
    text:
      - var(--b3-theme-on-surface)
    functional:
      - var(--b3-theme-success)
      - var(--b3-theme-error)
      - var(--b3-border-color)
todos:
  - id: line-stats-single-column
    content: LineStatsPanel.vue 双栏改单栏：新增 summary computed（总新增/总删除/总净增）与顶部 3 张汇总卡片模板
    status: completed
  - id: line-stats-scss
    content: LineStatsPanel.scss 用 [skill:codex-ui-style-guide] 实现单栏布局 + 卡片样式 + 轨道间距轻微润色
    status: completed
    dependencies:
      - line-stats-single-column
  - id: line-stats-i18n
    content: zh_CN/en_US gitPush.json 分片同步新增 lineStatsTotalAdded/Deleted/Net 三个键
    status: completed
---

## 产品概述

对 gitPush 功能的行数统计面板进行布局调整与轻度 UI 优化，提升信息可读性与视觉层次。

## 核心功能

- **双栏改单栏堆叠**：项目代码行数排行、作者代码行数排行从左右并排改为上下堆叠，各自占满一行宽度，每行信息展示更宽裕，缓解窄面板下的拥挤感
- **顶部汇总统计卡片**：在排行列表上方新增 3 张概要数字卡片——总新增（绿）、总删除（红）、总净增（按正负动态着色），提供一眼可见的整体规模
- **轻微润色**：微调间距、色块、条形轨道样式（高度/圆角），不做大的结构调整，不引入行卡片化、hover、前三名徽章等过度设计
- 汇总数据由组件内 computed 对 `projectRanking` 累加得出（总新增=Σadded、总删除=Σdeleted、总净增=Σadded−Σdeleted），无后端/composable 改动

## 视觉效果

- 排行区单栏纵向排列，两个区块各占整行
- 顶部一排 3 张等宽边框卡片（Codex 风格：border + surface 背景 + 等宽大号数值 + 大写小字标签），总新增绿色、总删除红色、总净增随正负变色
- 数字统一千位分隔符展示

## 技术栈

- 现有技术栈：Vue 3 + TypeScript + SCSS（无需新增依赖）
- 修改范围：`LineStatsPanel.vue`、`LineStatsPanel.scss`、i18n 分片 `gitPush.json`（zh_CN + en_US）

## 实现方案

### 布局调整（双栏 → 单栏堆叠）

- `.gls-pair` 容器由 `grid-template-columns: repeat(2, minmax(0, 1fr))` 改为单栏（`display: flex; flex-direction: column;` 或 `grid-template-columns: 1fr`），保留类名减少破坏面，注释说明语义
- 两个 `.gls-section` 上下堆叠，各占满一行宽度；`.gls-section-title`、`.gls-bar-row` 内部结构不变

### 汇总卡片

- 在 `v-else`（有数据分支）双栏容器内部最顶部插入 `.gls-cards` 卡片区（3 张卡片一行，`grid-template-columns: repeat(3, 1fr)`），保证无数据时不渲染全 0 卡片
- computed 新增 `summary`：对 `projectRanking` 累加 added/deleted，net = added − deleted
- 卡片结构复用 CommitAnalysisPanel 的 `.gpa-cards/.gpa-card` 模式（border + `$radius-base` + surface 背景 + `$vp-mono` 大号数值 + 大写标签），新增 `.gls-cards/.gls-card/.gls-card-value/.gls-card-label`，`--add` 绿 / `--del` 红 / `--net` 复用 `netClass()` 动态着色
- 数值用 `toLocaleString()` 千位分隔

### 轻微润色

- 条形轨道高度 4px → 5px、圆角 2px → 3px，增强色块存在感
- 卡片与排行区间距用 `$spacing-*` Token 微调

### i18n

- zh_CN 与 en_US 分片同步新增 3 个键：`lineStatsTotalAdded`（总新增 / Total Added）、`lineStatsTotalDeleted`（总删除 / Total Deleted）、`lineStatsTotalNet`（总净增 / Net Lines）
- 位置：紧随现有 `lineStatsNoData` 键之后，保证两语言键对齐

### 注意事项

- 所有样式放 `LineStatsPanel.scss`，禁止 .vue 内联样式；禁止硬编码 font-size/font-weight/line-height，使用设计 Token（大号数值用 `$font-size-lg` 需加"数据突出展示"注释）
- 模板中新增 i18n 键使用处上方必须加中文注释；组件文件头注释同步更新
- AI 不执行 `pnpm lint` / `vite build`，验证由用户执行

## 设计风格

遵循项目既有 Codex 设计语言，保持与 CommitAnalysisPanel 总览卡片视觉一致，仅做布局调整与轻度丰富。

## 页面布局（单栏堆叠）

- 顶部工具条不变（状态文案 + 条数选择 + 分析按钮）
- 分析完成后依次展示：3 张汇总卡片（总新增 / 总删除 / 总净增）→ 项目代码行数排行（占满整行）→ 作者代码行数排行（占满整行），纵向堆叠
- 每行排行结构不变：排名序号 + 标签 + 条形轨道 + 三列数字 + 占比

## 视觉细节

- 汇总卡片：单行 3 列等宽，1px 边框 + 圆角 + surface 背景，数值等宽大号字体居中，标签为弱化大写小字；总新增数值绿色（--b3-theme-success）、总删除数值红色（--b3-theme-error）、总净增数值随正负动态变色
- 条形轨道：高度与圆角轻微加大，色块更清晰；fill 仍按净增正负绿红着色
- 整体间距用 `$spacing-*` Token 保持节奏一致，数字/标签沿用等宽字体与弱化透明度层级

## 技能

- **codex-ui-style-guide**
- 用途：编写 LineStatsPanel.scss 时执行 Codex UI 样式规范（设计 Token、SCSS 分离、禁止硬编码/box-shadow），确保新卡片与单栏样式符合项目规范
- 预期结果：新增 `.gls-cards/.gls-card` 等样式全部使用 Token 与主题变量，无硬编码违规，与 CommitAnalysisPanel 视觉一致