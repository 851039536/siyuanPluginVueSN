---
name: merge-codeImageGenerator-into-articleCover
overview: 将 codeImageGenerator（代码图片生成器）迁移到 articleCover 并整体重命名为 imageCreation（图片生成），通过 Tab 页面切换统一两个子功能，UI 规范以原 articleCover 的 Teleport 模态弹窗为主。迁移完成后移除 codeImageGenerator 目录。
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
    background:
      - var(--b3-theme-background)
      - var(--b3-theme-surface)
      - rgba(0,0,0,0.3)
    text:
      - var(--b3-theme-on-background)
      - var(--b3-theme-on-surface)
    functional:
      - "#ef4444"
      - "#22c55e"
todos:
  - id: prepare-code-image-types-and-composable
    content: 在 articleCover 目录内新增代码图片类型定义（types/index.ts）和 useCodeImageGenerator.ts composable（从 codeImageGenerator/index.vue 提取状态管理、代码高亮、html2canvas 截图、复制/下载逻辑）
    status: completed
  - id: create-code-image-tab-and-styles
    content: 新建 CodeImageTab.vue 组件（双栏布局骨架：配置面板 + 预览面板 + 操作按钮）和 _code-image-styles.scss（从 codeImageGenerator/styles/index.scss 提取 14 种风格样式）
    status: completed
    dependencies:
      - prepare-code-image-types-and-composable
  - id: add-tab-state-and-modify-cover-generator
    content: 在 useArticleCoverState.ts 中新增 activeTab ref + switchTab 函数；改造 CoverGenerator.vue（dialog-header 下方增加 Tab 栏，dialog-body 内根据 activeTab 切换封面面板和代码图片面板）
    status: completed
    dependencies:
      - create-code-image-tab-and-styles
  - id: rename-module-and-update-all-refs
    content: 将 articleCover 目录重命名为 imageCreation，并更新所有全局引用：features/index.ts（导出+_Registered类型）、src/index.ts（注册）、App.vue（导入+挂载）、statusBar/index.vue（状态栏入口）、settings.ts、config.ts、icons.ts
    status: completed
    dependencies:
      - add-tab-state-and-modify-cover-generator
  - id: merge-i18n-entries
    content: 更新 zh_CN.json 和 en_US.json：合并 codeImageGeneratorPanel.* 文案到 imageCreation 命名空间，重命名 enableArticleCover 为 enableImageCreation，移除所有 codeImageGenerator 相关条目
    status: completed
    dependencies:
      - rename-module-and-update-all-refs
  - id: delete-code-image-generator
    content: 删除 src/features/codeImageGenerator 整个目录，验证编译无报错且功能正常
    status: completed
    dependencies:
      - merge-i18n-entries
---

## 用户需求

将 `src/features/codeImageGenerator`（代码图片生成器）功能完整迁移合并到原 `articleCover` 模块中，通过 Tab 页面切换统一两个功能。UI 规范以原 articleCover 的 Teleport 模态弹窗为准。合并后模块统一重命名为 **imageCreation**（图片生成）。迁移完成后移除 codeImageGenerator 目录及其所有引用。

## 产品概述

合并后的 imageCreation 模块是一个统一的"图片生成"工具，通过单一 Teleport 模态弹窗提供两个子功能：文章封面生成（原 articleCover 功能）和代码/文字图片生成（原 codeImageGenerator 功能）。弹窗顶部通过 Tab 栏切换模式。

## 核心功能

- **Tab 切换**：弹窗顶部增加"文章封面"和"代码图片"两个 Tab，默认显示文章封面
- **文章封面生成**：标题/摘要/关键字输入、5 种封面风格、6 种尺寸预设、AI 关键字提取、iframe 缩放预览、复制/下载/全屏
- **代码图片生成**：代码/文字输入、20 种语言高亮、7 种代码风格 + 7 种文字风格、浅深双主题、装饰选项、实时预览、复制/下载
- **统一 UI**：Teleport 模态弹窗 + 双栏布局（340px 配置面板 + flex 预览面板）+ 思源主题变量体系
- **去除 Dock 注册**：原 codeImageGenerator 的 `createVueDockApp` 侧边栏注册逻辑移除

## 技术栈

- 前端框架：Vue 3 + TypeScript + `<script setup>`
- 样式：SCSS，使用思源主题 CSS 变量（`--b3-theme-*`）
- 核心依赖：`highlight.js`（代码高亮）、`html2canvas`（DOM 截图）
- 全局组件：Button、Input、Select、IconWrapper（项目已有）

## 实现方案

### 整体策略

将 codeImageGenerator 的 489 行 `index.vue` 拆解为 **composable** + **视图组件** 两层：

1. **Composable 层**（`useCodeImageGenerator.ts`）：提取状态管理、代码高亮、html2canvas 截图、复制/下载逻辑
2. **视图层**（`CodeImageTab.vue`）：复用 articleCover 的双栏布局骨架，左侧配置面板 + 右侧预览面板 + 底部操作按钮
3. **样式层**（`_code-image-styles.scss`）：将 14 种代码/文字风格 CSS 作为 SCSS partial 引入

### 目录结构变更

```
src/features/imageCreation/                       # [RENAME] 从 articleCover 改名
├── index.ts                                       # [MODIFY] 重命名导出符号
├── README.md                                      # [MODIFY] 更新功能说明
├── components/
│   ├── CoverGenerator.vue                         # [MODIFY] 添加 Tab 栏 + Tab 切换逻辑
│   └── CodeImageTab.vue                           # [NEW] 代码图片 Tab 内容组件
├── composables/
│   ├── useImageCreationState.ts                   # [RENAME] useArticleCoverState.ts
│   ├── useCoverGenerator.ts                       # [UNCHANGED]
│   └── useCodeImageGenerator.ts                   # [NEW] 从 codeImageGenerator/index.vue 提取
├── styles/
│   ├── cover-generator.scss                       # [MODIFY] 添加 Tab 栏样式
│   └── _code-image-styles.scss                    # [NEW] 14 种代码/文字风格 CSS
└── types/
    └── index.ts                                    # [MODIFY] 新增代码图片类型定义
```

### 关键设计决策

1. **Tab 状态管理**：在 `useImageCreationState.ts` 中新增 `activeTab` ref（`"cover" | "codeImage"`），`showImageCreation` 支持可选参数指定默认 Tab
2. **弹窗标题动态化**：dialog-header 标题根据 activeTab 显示"文章封面"或"代码图片"
3. **Dock 注册移除**：原 `createVueDockApp` 注册逻辑直接删除，不再需要
4. **样式迁移策略**：codeImageGenerator 的 743 行 SCSS 中，仅提取 14 种风格样式（`.style-github`、`.style-mac`、`.text-style-quote` 等），丢弃 panel-header/settings-section/preview-container 等布局样式（因为复用 articleCover 的布局骨架）

## 设计风格

沿用 articleCover 现有的思源主题样式体系。Tab 栏采用胶囊指示器风格，弹窗遮罩层保持 `backdrop-filter: blur(2px)` 半透明模糊效果。

## Tab 栏设计

- 位置：dialog-header 下方
- 两个 Tab："文章封面"（图标 mdi:image-text）和"代码图片"（图标 mdi:code-tags）
- 激活态：底部 2px 下划线，颜色使用 accent 色 `#f59e0b`（琥珀色）
- 非激活态：文字颜色使用 `--b3-theme-on-surface` 60% 透明度
- 切换过渡：200ms ease

## 代码图片 Tab 布局

沿用双栏风格：左侧 340px 配置面板 + 右侧 flex 预览面板 + 底部操作按钮（复制图片、下载图片）。

## 底部操作栏

沿用 articleCover 现有 `.panel-footer` 样式，两个按钮：复制图片（outline）+ 下载图片（primary）。