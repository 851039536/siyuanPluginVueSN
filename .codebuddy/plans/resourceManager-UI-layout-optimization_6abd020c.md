---
name: resourceManager-UI-layout-optimization
overview: 对 src/features/resourceManager Dock 面板做 UI 排版审查与优化：聚焦资源列表行布局（操作按钮收纳/窄栏适配）、移动表单排版、面板纵向节奏与页签栏、空状态/状态区视觉重心；允许适度调整模板结构，功能与数据流不变。
design:
  styleKeywords:
    - Codex 设计语言
    - 窄栏 380px 自适应
    - 两段式列表行
    - 间距系统化
    - 主题变量明暗双态
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 12px
      weight: 600
    subheading:
      size: 10px
      weight: 500
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - "#0E0C0B"
      - "#ED9A2D"
    background:
      - "#F8F7F3"
      - "#F5F4F0"
    text:
      - "#FFFFFF"
      - "#E3E0DC"
    functional:
      - "#DC2828"
      - "#ED9A2D"
todos:
  - id: restructure-asset-row
    content: 重构资源列表行为两段式：信息行(缩略图+路径) + 操作行按钮按主次紧凑排布
    status: completed
  - id: polish-move-form
    content: 优化移动表单排版：标签对齐、快速分类两行结构、表单卡片化衔接
    status: completed
    dependencies:
      - restructure-asset-row
  - id: harmonize-rhythm-tabs
    content: 统一面板节奏与页签栏：筛选区间距去叠加、tab 收缩、统计行分区留白
    status: completed
  - id: empty-state-and-status
    content: 空状态图标化与加载/重建结果区排版优化，需要时注册新图标并补 i18n 键
    status: completed
  - id: align-doc-assets
    content: 同步 DocAssetsSection 行布局与主列表视觉对齐，控制 index.scss 行数不超硬阈值
    status: completed
    dependencies:
      - restructure-asset-row
  - id: wrap-up
    content: read_lints 自查、同步 README 结构说明并追加工作记忆
    status: completed
    dependencies:
      - restructure-asset-row
      - polish-move-form
      - harmonize-rhythm-tabs
      - empty-state-and-status
      - align-doc-assets
---

## 产品概述

对资源管理 Dock 面板（resourceManager）进行 UI 排版审查与优化。面板宽度 380px，含页签（图片/文件/文档/丢失/未使用/重建索引）、分类筛选、资源列表、移动表单等区块。本次只优化视觉与排版，功能逻辑与数据流保持不变。

## 核心优化范围（用户已确认四区全覆盖）

- 资源列表行布局：操作按钮区分主次并紧凑收纳、长路径与缩略图布局、窄栏 380px 下换行节奏可控
- 移动表单：行距与标签对齐、快速分类选择区换行节奏、表单与列表行衔接
- 面板节奏与页签：头部/页签栏/筛选区/统计行的间距系统化与纵向对齐统一
- 空状态与状态区：空态图标化与视觉重心、加载态、重建索引结果区排版

## 边界

- 允许适度结构调整（操作区收纳/分组、新增少量辅助区块），但功能与数据流零改动
- 视觉维持项目 Codex 风格：全设计 Token、禁 box-shadow、思源主题变量 + 0.12s 过渡

## 技术栈

- Vue 3 `<script setup>` SFC + TypeScript（项目既有）
- SCSS：全局 Token `@use "@/variables.scss" as *`（$spacing- *$font-size-* $font-weight- *$line-height-* $radius- *$vp-radius $color-danger 等），主题色走 `--b3-theme-*`，样式全部独立 .scss
- 无外部组件库：沿用模块内 rm-* 类体系与已注册 Iconify 图标（COMMON_ICONS：refresh/settings/close/delete/x/check 等）

## 实现方式

以「窄栏 380px 为第一约束」重构资源行的盒模型：把当前「缩略图/名称 + 5 个平铺文字按钮」单行挤压布局改为「信息行 + 操作行」的两段式；操作按钮按主次分组（主操作如「移动/定位」保留文字小按钮，高频复制类操作收纳为带 title 的图标按钮或统一压缩间距），配合 `flex-wrap` 的有序落点避免任意折行。全程不改事件绑定与 composable，仅动模板结构与 SCSS。

## 实施要点

- 样式改动集中收敛在 `styles/index.scss`（当前约 400 行），净增控制在 500 行硬阈值内：优先复用 rm-btn/rm-btn small/danger/primary 既有类，删除失效规则抵消新增，禁止引入新的 partial 文件（项目仅允许 `_mixins.scss` 前缀）
- `index.vue` 约 470 行接近 500 阈值：若模板增改明显，将「资源行 + 移动表单」抽为 `components/AssetListItem.vue` 独立组件承载，保持主文件行数安全；DocAssetsSection 行样式仅在 `DocAssetsSection.scss` 微调以保持各页签视觉一致
- 间距节奏系统化：筛选区相邻块间距去叠加（margin 合并方向唯一），统计行与列表间增加分区留白，均使用 $spacing token
- 空状态图标复用已注册图标；若需 image-off/inbox 等未注册图标，在 `src/config/icons.ts` 的 COMMON_ICONS 补映射后引用
- i18n 若有新增可见文案（如操作图标 title/空态辅助文案）只写分片 `src/i18n/{zh_CN,en_US}/resourceManager.json` + `types/index.ts` 同步，且模板每处 i18n 键上方加中文 HTML 注释
- 约束遵守：禁 box-shadow/emoji、过渡 0.12s ease、滚动容器 padding-right ≥ $spacing-2、Dock 内容区间距不紧贴侧边栏
- 完成改动后用 read_lints 收尾；README 若新增组件文件需同步目录结构

## 架构与目录（改动文件清单）

- [MODIFY] `src/features/resourceManager/index.vue`：资源行结构两段式/操作按钮分组；页签与统计行结构微调；必要时抽 AssetListItem
- [MODIFY] `src/features/resourceManager/styles/index.scss`：列表行/操作条/移动表单/空态/状态区/间距节奏全部样式落地
- [MODIFY] `src/features/resourceManager/components/DocAssetsSection.vue` + `styles/DocAssetsSection.scss`：行布局与主列表视觉对齐（仅排版）
- [NEW] 若 index.vue 行数超限：`components/AssetListItem.vue` + `styles/AssetListItem.scss`
- [MODIFY] `src/config/icons.ts`：仅当空态需新图标时补 COMMON_ICONS 映射
- [MODIFY] `src/i18n/{zh_CN,en_US}/resourceManager.json` + `types/index.ts`：仅当新增可见文案时补键
- [MODIFY] `src/features/resourceManager/README.md`：文件结构或行为描述变化时同步

## 设计目标

在维持模块既有 Codex 语言（rm-* 类、等宽/小号文字、主题色态）的前提下，以 380px 窄栏为基准重排信息层级与留白节奏，目标为「信息区稳定、操作区可预期、切换不跳动」。

## 区块设计

1. 头部与页签栏：头部标题与刷新按钮纵向居中对齐，页签栏取消横向滚动隐患（等分收缩或 flex 收缩 + 最小可读宽度），激活态保留 2px 主题色底条并在 hover 增加淡背景反馈，节奏与内容区统一间距。
2. 筛选区：加载数量行 + 分类筛选栏相邻间距收敛为单一来源（去掉 margin 叠加），筛选 chip 与「分类设置」按钮纵向重心一致；统计行与筛选区/列表之间各留固定分区间距。
3. 资源列表行（核心）：采用两段式——第一行：缩略图（图片页）+ 文件名（ellipsis + title 完整路径）；第二行：操作条，按主次排布（主要操作保留文字小按钮，次要复制类操作可用 title+图标或紧凑按钮组），操作条整体右对齐或左缩进与信息行缩略图对齐，悬停整行仍保持淡底色；长路径下按钮永不挤压换行（操作条独立一行 flex-shrink:0 或允许自身 wrap 且首尾对齐可控）。
4. 移动表单：当前路径区与标签垂直对齐改为标签固定宽度 + 内容自由折行；快速分类区拆为「chips 一排 + 自定义输入与应用」两行固定结构，避免任意孤行悬尾；表单作为独立卡片块，与列表行之间留明确间隔。
5. 空状态与状态区：空态加入已注册图标（居中弱化色）加说明文字，压缩过度留白；加载态与结果区采用统一小卡样式与间距；重建索引结果块沿用边框卡片呈现。

## 视觉基调

保持思源主题自适应的明暗双态；所有元素使用全局 Token，不引入任何新字体/色值硬编码；动效仅 0.12s 透明度/背景过渡；无阴影、无模糊遮罩。