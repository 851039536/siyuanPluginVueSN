---
name: outputpanel-console-refactor
overview: 将 OutputPanel 从卡片式布局重构为控制台风格输出，移除复制按钮，改为固定高度可滚动 + 原生鼠标选中复制。
todos:
  - id: refactor-outputpanel-template
    content: 重构 OutputPanel.vue：移除复制按钮和 details/summary，改为等宽文本行布局；移除 copyText prop 和 copy emit
    status: completed
  - id: rewrite-output-scss
    content: 重写 styles/index.scss 中 gp-output 样式块：控制台主题（等宽字体、200px 固定高度、overflow-y scroll、行内流水布局）
    status: completed
    dependencies:
      - refactor-outputpanel-template
  - id: clean-projectcard-copy-chain
    content: 清理 ProjectCard.vue 复制链路：移除 entriesToText prop、copyOutput emit、outputPanels 中的 copyText
    status: completed
    dependencies:
      - refactor-outputpanel-template
  - id: clean-index-copy-chain
    content: 清理 index.vue 复制链路：移除 entriesToText 传递、@copy-output 事件、handleCopyOutput 函数
    status: completed
    dependencies:
      - refactor-outputpanel-template
  - id: verify-all
    content: 验证 ESLint + tsc 零新增错误
    status: completed
    dependencies:
      - rewrite-output-scss
      - clean-projectcard-copy-chain
      - clean-index-copy-chain
---

## 用户需求

将 OutputPanel.vue 重构为控制台/终端风格的日志输出面板。

## 核心功能

- 移除复制按钮，用户通过鼠标选中文本直接 Ctrl+C 复制
- 输出条目以等宽文本行格式展示，模拟终端控制台效果
- 固定高度容器（200px），超出内容可垂直滚动
- 保留原有状态图标（成功/失败/跳过）和关键信息（平台、耗时、摘要）
- stdout/stderr 不再折叠，直接在日志行下方缩进显示

## 视觉效果

等宽字体 + 深色/表面色背景 + 彩色状态前缀（绿色 ✓ / 红色 ✗ / 灰色 —）+ 行内流水格式，类似 VS Code 终端输出面板。

## 技术方案

### 实现策略

将 OutputPanel 从"结构化卡片列表+可折叠详情"模式改造为"控制台流水日志行"模式。模板层用纯 `<div>` 行代替 `<details>/<summary>` 折叠组件；样式层以等宽字体、行内排版、固定高度滚动区为核心；同时清理上下游不再需要的 copy 相关 prop/event 传递链。

### 关键决策

1. **不保留 expand/collapse 交互**：stdout/stderr 改为直接内联缩进显示，原因是控制台风格下信息应始终可见，依赖滚动而非折叠。`MAX_STDOUT_PREVIEW` 常量保留用于截断过长的输出。
2. **保留 Icon 组件**：状态图标（`mdi:check`/`mdi:close`/`mdi:minus`）仍使用 @iconify/vue 渲染，因为方案前置已从 Unicode 字符迁移过来，且图标是控制台风格中唯一保留的视觉锚点。
3. **不使用 `user-select: none`**：整个输出区允许原生文本选择，确保用户可鼠标拖选复制。
4. **entriesToText 函数保留在 useGitOps.ts**：该工具函数本身是纯函数，保留以备未来其他场景复用，只清理调用链。

### 变更范围

涉及 4 个文件，全部位于 `src/features/gitPush/` 下：

- **OutputPanel.vue**：模板 + 脚本重构
- **styles/index.scss**：gp-output 样式块替换
- **ProjectCard.vue**：清除 copy 相关 prop/emit
- **index.vue**：清除 copy 相关传递链和处理函数