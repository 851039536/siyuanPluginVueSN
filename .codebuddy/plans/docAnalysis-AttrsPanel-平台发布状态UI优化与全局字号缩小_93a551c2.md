---
name: docAnalysis-AttrsPanel-平台发布状态UI优化与全局字号缩小
overview: 将 AttrsPanel 文档属性弹窗的「平台发布状态」区域从紧凑胶囊改为行式列表卡片布局，同时将整个弹窗（标题/平台状态/属性表格/底部按钮）字号统一缩小一档，使其符合项目两级字号制规范。
design:
  architecture:
    framework: vue
  styleKeywords:
    - 行式卡片
    - Codex风格
    - 细边框
    - 状态徽章
    - 紧凑字号
    - hover反馈
    - 过渡动画
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 12px
      weight: 600
    subheading:
      size: 10px
      weight: 700
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - var(--b3-theme-primary)
    background:
      - var(--b3-theme-background)
      - var(--b3-theme-surface-light)
      - rgba(34, 197, 94, 0.1)
      - rgba(239, 68, 68, 0.08)
    text:
      - var(--b3-theme-on-background)
      - var(--b3-theme-on-surface-variant)
      - "var(--b3-theme-success, #16a34a)"
    functional:
      - "var(--b3-theme-success, #22c55e)"
      - "var(--b3-theme-error, #dc2626)"
      - var(--b3-theme-primary)
todos:
  - id: refactor-platform-list
    content: 重构 AttrsPanel.vue 平台发布状态模板为行式卡片（状态徽章+操作按钮组+marking 态）
    status: completed
  - id: restyle-attrs-panel
    content: 重写 AttrsPanel.scss：行式卡片样式与全弹窗字号降档，用 [skill:codex-ui-style-guide] 确保 Token 合规
    status: completed
    dependencies:
      - refactor-platform-list
---

## 需求概述

对 docAnalysis 功能「文档属性」弹窗（AttrsPanel）进行 UI 优化：

1. **平台发布状态区改版**（已确认方向：行式列表卡片）——每个平台占一行，左侧为状态图标 + 平台名，中间为状态徽章（"已发布/未发布"小标签），右侧为操作按钮组（排版发布、前往发布）；整行点击仍用于切换发布状态。
2. **整个弹窗字体统一缩小**（已确认范围）——标题、平台状态区、属性表格、底部按钮等全部字号降一档，同时使字号分布符合项目「两级字号制」规范（标题与正文内容 `$font-size-xs`(12px)、辅助文字 `$font-size-2xs`(10px)，`$font-size-sm` 及以上仅限阅读区正文与数据突出展示）。

## 核心功能

- 平台发布状态区：胶囊横排布局 → 行式卡片列表（最多约 11 行，需限制高度可滚动，避免挤压属性表格）
- 每行视觉层次：状态图标（含 marking 旋转加载态）→ 平台名 → 状态徽章 → 操作按钮组（hover 提示）
- 已发布行浅绿底/绿徽章，未发布行中性底/灰徽章；hover 时未发布行变浅绿（提示可标记）、已发布行变浅红（提示可取消）
- 全弹窗字号降档：header 标题、属性值、YAML 折叠、底部按钮、loading/error 文案、状态图标等统一缩小，符合两级字号制与 Codex 设计 Token 规范

## 技术栈

- Vue 3 + TypeScript + SCSS（沿用现有项目技术栈，不改架构）
- 样式严格使用设计 Token：`$font-size-*` / `$font-weight-*` / `$line-height-*` / `$spacing-*` / `$vp-radius`，禁止硬编码 px 与 box-shadow

## 实现方案

### 1. 模板改造（AttrsPanel.vue 第 55-111 行）

将 `.platform-status-list` 由 flex-wrap 横排改为纵向列；每行 `.platform-status-item` 重构为行式卡片：

- 左侧：`.status-icon`（mdi:check-circle / mdi:minus-circle-outline / mdi:loading 旋转） + `.platform-name`
- 中间：`.status-badge`（新增，替代原 `.status-text` 内联文字，改为小圆角状态标签，辅助文字字号）
- 右侧：`.platform-actions` 按钮组（原 `.publish-go-btn.publish-format-btn` 排版发布 + `.publish-go-btn` 前往发布，逻辑、disabled、loading 态保持不变）
- 保留整行 `@click` 切换、`title` 提示、`.marking` 加载态 class 绑定

### 2. 样式重写（AttrsPanel.scss 第 111-232 行）

- `.platform-status-list`：`flex-direction: column` + `$spacing` gap，设 `max-height` + `overflow-y: auto`（复用 `@include da-scrollbar`）
- `.platform-status-item`：横向 flex 行卡片，边框分隔（Codex 风格）、`$vp-radius` 圆角、transition 过渡；已发布浅绿底、未发布中性底；hover 态区分绿/红
- `.status-badge`：`$font-size-2xs` 辅助文字 + 小圆角底色标签
- `.publish-go-btn`：缩小为 20px 圆钮、图标 `$font-size-xs`，hover 显隐过渡
- 删除 `.status-text` 样式，由 `.status-badge` 取代

### 3. 全弹窗字号降档（AttrsPanel.scss 全局）

| 选择器 | 原字号 | 改后 |
| --- | --- | --- |
| `.header-title` | $font-size-base(16px) | $font-size-sm(14px) |
| `.header-doc-title` | $font-size-sm | $font-size-xs |
| `.header-icon` / `.close-btn` | $font-size-lg(18px) | $font-size-base(16px) |
| `.status-icon` | $font-size-sm | $font-size-xs |
| `.attr-value` | $font-size-sm | $font-size-xs |
| `.yaml-toggle .toggle-icon` | $font-size-base | $font-size-sm |
| `.footer-btn` | $font-size-sm | $font-size-xs |
| `.attrs-loading` / `.attrs-error` | $font-size-sm | $font-size-xs |
| 已为 $font-size-2xs 的（section-title / attr-key） | — | 保持不变 |


## 实现注意

- 不改任何 TS 逻辑（点击、marking、loading、copy 行为零改动），仅改模板结构与样式，回归风险低
- 该弹窗为自建 fixed overlay，注意保持内部字号不依赖思源全局默认字号
- 文件头注释、i18n 无需改动（无新增文案，仅结构重组）
- 验证由用户自行执行：`pnpm lint`（不执行构建）

## 目录结构

```
src/features/docAnalysis/
├── components/
│   └── AttrsPanel.vue      # [MODIFY] 发布状态区模板改为行式卡片结构（55-111 行区域），其余不动
└── styles/
    └── AttrsPanel.scss     # [MODIFY] 重写发布状态区样式（111-232 行）+ 全局字号降档（header/表格/footer/loading）
```

## 设计风格

采用 Codex 风格的行式列表卡片：每个平台独立成行，以细边框分隔、轻量圆角，视觉层次清晰。

### 发布状态行式卡片

- 每行结构：左（状态图标 + 平台名）→ 中（状态徽章）→ 右（操作按钮组），左右两端对齐，中间徽章紧贴平台名
- 已发布行：浅绿色背景 + 绿色对勾图标 + 绿色「已发布」徽章；未发布行：中性表面背景 + 灰色「未发布」徽章
- 交互：整行 hover 时未发布行泛起浅绿提示「可标记」，已发布行泛起浅红提示「可取消」；marking 时图标切换为旋转 loading 并降透明度；操作按钮（排版发布/前往发布）hover 显示、平时低调
- 列表纵向排列，行间距紧凑，超出可视高度时内部滚动（复用 da-scrollbar）
- 过渡动画：行背景色 0.12s~0.15s 平滑过渡

### 整体字号

- 整个弹窗字号降一档：标题与正文内容统一 12px（$font-size-xs），辅助文字/徽章/标签统一 10px（$font-size-2xs），阅读与数据突出场景才用 14px（$font-size-sm），与项目两级字号制对齐，观感更紧凑精炼

## Agent 扩展

### Skill

- **codex-ui-style-guide**
- 用途：指导 AttrsPanel.scss 的样式改造，确保使用设计 Token（$font-size-*/$spacing-*/$vp-radius 等）、禁止硬编码与 box-shadow、符合两级字号制与 Codex 组件模式
- 预期产出：行式卡片与全弹窗字号降档的 SCSS 全部通过 Codex 规范审查