---
name: merge-codeImageGenerator-into-articleCover
overview: 将 codeImageGenerator（代码图片生成器）功能完整迁移到 articleCover（文章封面生成器）中，通过 Tab 页面切换统一两个功能，UI 规范以 articleCover 的 Teleport 模态弹窗为主。迁移完成后移除 codeImageGenerator 整个目录及所有引用。
design:
  architecture:
    framework: vue
  styleKeywords:
    - 思源主题
    - 胶囊 Tab
    - 双栏布局
    - 模糊遮罩
    - 琥珀色 accent
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 18px
      weight: 600
    subheading:
      size: 14px
      weight: 500
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#f59e0b"
      - "#22c55e"
      - "#3b82f6"
    background:
      - var(--b3-theme-background)
      - var(--b3-theme-surface)
      - rgba(0,0,0,0.3)
    text:
      - var(--b3-theme-on-background)
      - var(--b3-theme-on-surface)
      - "#ffffff"
    functional:
      - "#ef4444"
      - "#22c55e"
      - "#f59e0b"
todos:
  - id: add-tab-state
    content: 在 useArticleCoverState.ts 中新增 activeTab ref 和 switchTab 函数，新增 showCodeImage 函数支持直接打开代码图片 Tab
    status: pending
  - id: create-code-image-types
    content: 在 articleCover/types/index.ts 中新增代码图片相关类型定义（CodeStyle、TextStyle、Theme、DecorationConfig 等）
    status: pending
  - id: create-code-image-composable
    content: 新建 useCodeImageGenerator.ts composable，从 codeImageGenerator/index.vue 提取核心逻辑（语言/风格/主题/装饰/代码高亮/html2canvas 截图/复制下载）
    status: pending
    dependencies:
      - create-code-image-types
  - id: create-code-image-tab-component
    content: 新建 CodeImageTab.vue 组件，实现双栏布局的代码图片 Tab 内容（配置面板 + 预览面板 + 操作按钮）
    status: pending
    dependencies:
      - create-code-image-composable
  - id: add-tab-ui-to-cover-generator
    content: 改造 CoverGenerator.vue：dialog-header 下方增加 Tab 栏，dialog-body 内根据 activeTab 切换 Cover 面板和 CodeImage 面板
    status: pending
    dependencies:
      - add-tab-state
      - create-code-image-tab-component
  - id: extract-code-image-styles
    content: 新建 _code-image-styles.scss，将 codeImageGenerator/styles/index.scss 中 14 种风格样式提取并适配 articleCover 主题变量体系
    status: pending
    dependencies:
      - create-code-image-tab-component
  - id: update-exports-and-references
    content: 更新全局引用：移除 features/index.ts 中 codeImageGenerator 导出、更新 index.ts 注册逻辑、清理 settings/config/icons 中的 codeImageGenerator 条目
    status: pending
    dependencies:
      - add-tab-ui-to-cover-generator
  - id: update-i18n-and-docs
    content: 迁移 i18n 文案（合并 codeImageGeneratorPanel.* 到 articleCover 命名空间，移除 enableCodeImageGenerator 条目），更新 README.md 和 IconWrapper.README.md
    status: pending
    dependencies:
      - update-exports-and-references
  - id: remove-code-image-generator
    content: 删除 src/features/codeImageGenerator 整个目录，验证编译无报错
    status: pending
    dependencies:
      - update-exports-and-references
      - extract-code-image-styles
---

## 用户需求

将 `src/features/codeImageGenerator`（代码图片生成器）功能内容迁移到 `src/features/articleCover`（文章封面生成器），在 articleCover 的模态弹窗中增加 Tab 页面切换，UI 规范以 articleCover 为主。迁移完成后移除整个 codeImageGenerator 目录及其所有引用。

## 产品概述

合并后 articleCover 成为一个统一的"封面与图片生成"工具，通过 Teleport 模态弹窗统一提供两个功能：文章封面生成（原有）和代码/文字图片生成（从 codeImageGenerator 迁移）。用户通过 Tab 栏切换功能模式。

## 核心功能

- **Tab 切换**：弹窗顶部增加"文章封面"和"代码图片"两个 Tab，默认显示文章封面
- **代码图片生成（新增 Tab）**：代码/文字输入、20 种语言高亮、7 种代码风格 + 7 种文字风格、浅色/深色主题、装饰选项（水印/作者/时间戳/边框/圆角/内边距/透明度/阴影）、实时预览、复制/下载图片
- **文章封面生成（保持原有）**：标题/摘要/关键字输入、5 种封面风格、6 种尺寸预设、AI 关键字提取、iframe 缩放预览、复制/下载/全屏
- **去除代码图片的 Dock 面板注册**：改为在 articleCover 弹窗内以 Tab 形式呈现

## 技术栈

- 前端框架：Vue 3 + TypeScript（沿用项目现有技术栈）
- 样式：SCSS，使用思源主题 CSS 变量（`--b3-theme-*`）
- 核心依赖：`highlight.js`（代码高亮）、`html2canvas`（DOM 截图）
- 全局组件：Button、Input、Select、IconWrapper（项目已有）

## 实现方案

### 整体策略

将 codeImageGenerator 的 489 行 `index.vue` 拆解为两部分：

1. **Composable 层**：提取代码图片生成的核心逻辑到 `useCodeImageGenerator.ts`，参照 `useCoverGenerator.ts` 的模式
2. **视图层**：新建 `CodeImageTab.vue` 组件作为 Tab 内容，嵌入 `CoverGenerator.vue` 的双栏布局骨架中

### 关键设计决策

1. **Tab 状态管理**：在 `useArticleCoverState.ts` 中新增 `activeTab` ref（`"cover" | "codeImage"`），由 CoverGenerator 的 Tab 栏控制
2. **CodemirrorTab 布局适配**：将原 codeImageGenerator 的单列滚动布局改造为适配 articleCover 的双栏布局（340px 配置面板 + flex 预览面板），与 CoverGenerator 的布局骨架保持一致
3. **弹窗尺寸适配**：代码图片 Tab 激活时，弹窗可能需要更大的宽度以容纳代码预览，通过动态 CSS class 控制
4. **代码风格 CSS 迁移**：将原 `codeImageGenerator/styles/index.scss` 中 7 种代码风格 + 7 种文字风格的定义抽取到 `articleCover/styles/_code-image-styles.scss`，作为 SCSS partial 引入
5. **关闭 Dock 注册**：原 `codeImageGenerator/index.ts` 的 `createVueDockApp` 注册逻辑不再需要，改为通过 articleCover 的 `showArticleCover` + Tab 方式触发

### 性能与可靠性

- **html2canvas 复用**：两个 Tab 共用同一个 html2canvas 实例，无额外依赖开销
- **highlight.js 按需加载**：仅在切换到"代码图片"Tab 时初始化代码高亮
- **ResizeObserver**：代码图片预览区沿用 articleCover 的 iframe 缩放方案或直接 DOM 预览方案

## 实现细节

### 目录结构变更

```
src/features/articleCover/
├── index.ts                              # [MODIFY] 移除旧 exports
├── README.md                             # [MODIFY] 更新功能说明
├── components/
│   ├── CoverGenerator.vue                # [MODIFY] 添加 Tab 结构 + 双栏骨架
│   └── CodeImageTab.vue                  # [NEW] 代码图片 Tab 内容组件
├── composables/
│   ├── useArticleCoverState.ts           # [MODIFY] 新增 activeTab 和 tab 切换函数
│   ├── useCoverGenerator.ts              # [UNCHANGED]
│   └── useCodeImageGenerator.ts          # [NEW] 代码图片生成核心逻辑
├── styles/
│   ├── cover-generator.scss              # [MODIFY] 添加 Tab 栏样式
│   └── _code-image-styles.scss           # [NEW] 代码/文字风格 CSS（从 codeImageGenerator 提取）
└── types/
    └── index.ts                          # [MODIFY] 新增代码图片相关类型
```

### 需要移除的目录

```
src/features/codeImageGenerator/          # [DELETE] 整个目录
```

### 全局文件修改清单

| 文件 | 操作 |
| --- | --- |
| `src/features/index.ts` | 移除 codeImageGenerator 导出和联合类型 |
| `src/index.ts` | 移除 registerCodeImageGenerator 导入和调用 |
| `src/config/settings.ts` | 移除 enableCodeImageGenerator 设置项 |
| `src/features/config.ts` | 移除 codeImageGenerator 功能条目 |
| `src/config/icons.ts` | 移除 codeImageGenerator 图标配置 |
| `src/i18n/zh_CN.json` | 移除 enableCodeImageGenerator/enableCodeImageGeneratorDesc；保留 codeImageGeneratorPanel.* 面板文案 |
| `src/i18n/en_US.json` | 同上 |
| `src/App.vue` | 无需修改（组件名不变，props 兼容） |
| `src/features/statusBar/index.vue` | 更新入口（若需要直接打开代码图片 Tab） |
| `docs/IconWrapper.README.md` | 移除 codeImageGenerator 行 |


## 设计风格

沿用 articleCover 现有的思源主题样式体系，Tab 栏采用现代胶囊指示器风格。弹窗遮罩层保持 `backdrop-filter: blur(2px)` 半透明模糊效果。

## Tab 栏设计

- 位置：dialog-header 下方，与 header 底部间距 4px
- 两个 Tab 按钮："文章封面"（图标 `mdi:image-text`）和"代码图片"（图标 `mdi:code-tags`）
- 激活态：底部 2px 下划线，颜色使用 articleCover 的 accent 色（`#f59e0b` 琥珀色系）
- 非激活态：文字颜色使用 `--b3-theme-on-surface` 的 60% 透明度
- 切换过渡：200ms ease，仅颜色和指示器位置变化
- 整体宽度：与 dialog-header 标题区域对齐

## 代码图片 Tab 布局

保持 articleCover 的双栏风格：

- **左侧配置面板**（340px 固定宽）：内容模式切换（代码/文字）、语言选择（代码模式时显示）、风格选择（7 种代码风格/7 种文字风格）、主题切换（浅色/深色）、字体大小滑块、装饰选项可折叠面板
- **右侧预览面板**（flex:1）：实时渲染代码高亮 + 窗口装饰（红黄绿按钮）+ 装饰元素（水印/作者/时间），背景根据风格和主题动态变化

## 底部操作栏

沿用 articleCover 现有 `.panel-footer` 样式，两个按钮："复制图片"（outline 样式）和"下载图片"（primary 样式）。

## 响应式

弹窗宽度保持 92vw（max 1200px），代码图片 Tab 下预览区域支持横向滚动以展示长代码行。高度固定 85vh（max 800px），配置面板内垂直滚动。
