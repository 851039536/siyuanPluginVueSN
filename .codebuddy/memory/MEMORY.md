# 项目记忆

## 编码规范偏好
- 严格遵守 CLAUDE.md 中的统一入口原则：存储用 PluginStorage/TypedStorage、Node 模块用 getNodeModules、事件用 emitCustomEvent 等
- UI 风格使用 Codex 设计语言（等宽字体、大写标签、边框卡片、focus 发光）
- Vue emit 事件必须 camelCase，禁止 kebab-case
- 新功能必须在 8 处注册（index.ts + types + features/index.ts + src/index.ts + settings + i18n + config + icons）
- 优先思源内置图标或 @iconify/vue

## 最近重构记录
- 2026-06-17：代码块样式模块化迁移 — 将 `src/index.scss` 第13-222行代码块美化样式移至新文件 `src/features/generalSettings/styles/codeblockThemes.scss`，index.scss 改为 `@use` 引入。审查了静态 SCSS 与动态 JS 注入样式（`styles.ts` → `applyCodeBlockEnhancedStyles()`）的冲突，产出 `docs/codeblock-styles-conflict-review.md`。发现 3 个严重问题：动态 `!important` 覆盖 hover 边框变色、静态/动态两套行号机制共存（CSS counter vs `.ln`）、动态层滥用 20+ 处 `!important` 破坏 CSS 级联。架构校验通过 6 大原则。
- 2026-06-16：紧凑模式功能抽取并增强 — 将 index.scss 中紧凑模式 CSS 抽取为独立模块 `src/features/compactMode/`。**细调增强**：3 档间距密度（适中/紧凑/极简）+ 5 档字号缩放（80%/85%/90%/95%/100%）独立控制、5 个区域独立开关。全部通过 Sass @each 编译期乘法计算固定值，零 calc()/var()，CSS 类体系：siyuan-compact-mode + compact-density-* + compact-font-* + compact-area-*。
- 2026-06-16：index.scss 审查修复 — 移除 6 处 box-shadow（Codex 违规→替换为 border），紧凑模式块硬编码值替换为 $spacing-*/$font-size-* Token，移除废弃的 $codeblock-shadow 变量，修复格式问题。唯一保留的 box-shadow：Mac 代码块 ::before 伪元素的红黄绿按钮（纯 CSS 渲染技术，非页面阴影效果）
- 2026-06-13：dataBackup 模块全面审查重构（见当天日报）
- 2026-06-11：flashcardReading 模块审查重构（见当天日报）
