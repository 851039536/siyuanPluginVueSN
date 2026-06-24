---
name: ui-style-merge-html-test
overview: 在 CLAUDE_RULES.md 的「UI 风格：Codex」章节中吸收参考代码的 hero-card、connector-card、tabs、sidebar、header、user-profile、badge 等布局/组件模式，映射到现有 Codex SCSS Token（边框优先、琥珀强调色），并生成一个独立 HTML 测试页验证颜值。
design:
  architecture:
    framework: html
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 18px
      weight: 600
    subheading:
      size: 15px
      weight: 600
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#1A1A18"
      - "#D97706"
    background:
      - "#F7F7F5"
      - "#FFFFFF"
      - "#1C1C1E"
    text:
      - "#1A1A18"
      - "#3D3D3A"
      - "#8A8A85"
      - "#FFFFFF"
    functional:
      - "#16A34A"
      - "#DC2626"
      - "#D97706"
todos:
  - id: merge-codex-patterns
    content: 更新 CLAUDE_RULES.md 的 Codex 章节，新增 hero-card、connector-card、tabs、sidebar、header、user-profile、badge 变体模式
    status: completed
  - id: update-html-demos
    content: 更新 docs/codex-ui-reference.html，添加对应组件的可视化区块与导航锚点
    status: completed
    dependencies:
      - merge-codex-patterns
  - id: dark-responsive
    content: 为 HTML 参考页添加暗色模式切换、响应式断点和局部布局变量
    status: completed
    dependencies:
      - update-html-demos
  - id: review-qa
    content: 使用 [skill:web-design-guidelines] 审核 HTML 测试页，并清理 emoji 等规范冲突
    status: completed
    dependencies:
      - dark-responsive
---

## 产品概述

更新项目 UI 风格指南与 HTML 参考页，将用户提供的参考代码中的布局/组件模式（hero-card、connector-card、tabs、sidebar、header、user-profile、badge 变体、section-header）吸收进现有 Codex 规范，同时保留当前「边框优先、琥珀色强调、无阴影」的思源插件风格。

## 核心功能

- 在 `CLAUDE_RULES.md` 的「UI 风格：Codex」章节新增参考组件的 SCSS 模式库条目，包括结构、尺寸、Token 使用与禁止事项映射。
- 更新 `docs/codex-ui-reference.html`，新增 hero-card、connector-card、tabs、sidebar、header、user-profile、badge 变体等可视区块，并补充暗色/响应式示例。
- 确保所有新增示例沿用现有 `$spacing-*`、`$radius-*`、`$font-size-*`、`$vp-radius`、`$vp-mono` 及 `--b3-theme-*` 主题色，不引入绿色强调色、阴影层级和 CSS 自定义属性体系。
- 清理现有 HTML 测试页中与规范冲突的细节（如 emoji 图标）。

## 技术栈

- 文档：Markdown
- 样式语言：SCSS（沿用项目已有的 `src/_variables.scss` 设计 Token）
- 视觉测试页：独立 HTML + CSS，通过 CSS 变量模拟项目 SCSS Token

## 实现策略

- 仅做文档和演示页面更新，不引入新的运行时依赖、不修改 `src/_variables.scss` 结构。
- 参考组件中的 CSS 自定义属性（如 `--color-accent`、`--shadow-md`）映射到现有 SCSS 变量：
- 强调色 → 现有琥珀色/主色 Token（`$brand-accent`、`var(--b3-theme-primary)`）
- 阴影 → 用边框 + hover 边框变色替代
- 间距/圆角/字号 → 现有 `$spacing-*`、`$radius-*`、`$font-size-*`
- 布局常量（`--header-height`、`--sidebar-width`）作为局部变量在演示页或文档中给出，不加入全局 Token。
- HTML 测试页使用 CSS 变量（`--b3-theme-*`、`--radius-*`、`--spacing-*`、`--font-*`）模拟思源主题与项目 SCSS 变量，支持 `prefers-color-scheme: dark` 和手动切换。

## 架构说明

- 目标文件：
- `CLAUDE_RULES.md`（第 389 行起 `UI 风格：Codex` 章节）
- `docs/codex-ui-reference.html`
- 不涉及运行时源码、功能模块或构建配置变更。
- 文档中的代码片段仅提供 SCSS 结构模式，不包含具体业务逻辑。

## 执行注意事项

- 保持向后兼容：现有禁止事项（禁用 `box-shadow`、硬编码 `border-radius`、emoji 图标等）继续生效，新增组件模式必须满足这些规则。
- HTML 测试页中新增组件应与现有组件（card、dialog、button、input、badge）共用同一套 CSS 变量，避免两套视觉体系。
- 暗色模式复用项目已有的暖色暗色主题（`--b3-theme-background` `#1c1c1e`、surface `#2c2c2e` 等），不引入参考 CSS 中的冷灰色暗色方案。
- 检查 `docs/codex-ui-reference.html` 中的 emoji 图标，替换为符合规范的图标按钮或文字示例。
- 更新后验证 HTML 文件在亮色/暗色主题及移动端 768px 断点下的渲染效果。

## 设计方向

采用「Codex 质感 + Apple 布局」的混合方案：保留 Codex 的边框、暖琥珀强调色与克制动效，吸收参考代码的清晰信息层级、sidebar 导航、hero-card 首焦区、connector-card 列表项、tabs 分段控制器、user-profile 底部账号区等布局模式。

## 布局与组件

- **Sidebar 侧边栏**：固定宽度 220px，浅灰背景，高亮项使用主色边框/背景，底部用户区。
- **Header 顶部栏**：56px 高度，左侧标题/搜索，右侧操作按钮，胶囊形主按钮。
- **Hero Card**：左右分栏，浅灰渐变背景（仅用于文档说明，实际实现避免阴影），左侧标题+描述，右侧插图/数据。
- **Section Header**：标题 + 计数徽章/辅助文案，12px 大写标签。
- **Tabs 分段控制**：浅灰底、圆角 8px 容器，激活项白底 + 主色文本。
- **Connector Card**：icon + 标题/描述 + 右侧图标按钮，两行文字截断，hover 边框变主色。
- **Card Grid**：双列响应式网格，小屏单列。
- **Badge 变体**：主色/灰色/成功色三种胶囊标签。

## 交互

- 所有可交互元素统一 0.12s 过渡。
- Hover 以边框变色为主，不叠加阴影。
- 暗色模式自动跟随系统，同时提供手动切换按钮。

## 响应式

- 768px 以下 sidebar 隐藏，content 单列，hero card 纵向堆叠。

## Agent Extensions

### Skill

- **web-design-guidelines**
- Purpose: 在 HTML 测试页完成后，依据 Web Interface Guidelines 检查暗色模式、可访问性、对比度和组件一致性。
- Expected outcome: 输出一份简短的审核清单，确认新增组件是否符合 Web 界面最佳实践。