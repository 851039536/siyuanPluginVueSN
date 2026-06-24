# 项目记忆

## 编码规范偏好
- 严格遵守 CLAUDE.md 中的统一入口原则：存储用 PluginStorage/TypedStorage、Node 模块用 getNodeModules、事件用 emitCustomEvent 等
- UI 风格使用 Codex 设计语言（等宽字体、大写标签、边框卡片、focus 发光）
- Vue emit 事件必须 camelCase，禁止 kebab-case
- 新功能必须在 8 处注册（index.ts + types + features/index.ts + src/index.ts + settings + i18n + config + icons）
- 优先思源内置图标或 @iconify/vue

## 最近重构记录
- 2026-06-24：gitPush 模块全面审查重构 — **巨型文件拆分**：`types/index.ts`（1453行）→ 提取 GitPushManager 至独立文件（`GitPushManager.ts`）+ types/index.ts 重出口；`useGitPush.ts`（1025行）→ 按领域拆为 4 个 composable（`useProjectCrud`/`useGitOps`/`useGitTagsConflicts`/`useGitStats`）+ `utils.ts` 共享工具函数。**冗余合并**：pushToAll/pullToAll/pushSingle/pullSingle 提取通用 `tryRemoteOp`/`remoteOpAll`/`remoteOpSingle` 函数消除 ~100 行重复。**组件提取**：新增 `ConflictSection.vue`、`StashSection.vue`（减少 index.vue ~150 行）。**规范修复**：SCSS 文件去 `_` 前缀（`_buttons/_shared/_variables` → 无前缀）；`useProjectFilters.ts` 改用 TypedStorage；硬编码 `line-height: 1.4` → `$line-height-normal`。**性能优化**：pushOutputs/pullOutputs/commitOutputs 缓存添加 30 条上限自动裁剪。**验证**：tsc 零新增错误、lint 通过。
- 2026-06-17：MarkdownExportSettings 代码审查重构 — **CLAUDE.md 违规**：手动 `a.click()` 下载 → `triggerBlobDownload`（domUtils 统一入口）；4 处 emoji（📁📦💡📓）→ Iconify 图标（Button `icon` prop + `<Icon>` 组件）；SCSS 硬编码 → 设计 Token。**冗余消除**：`callExportApi`/`startExportProgress`/`todayString` 提取公共函数（3 处 API 调用合并，净减 ~45 行）；`exportAll`/`exportNotebookMd`/`exportAllNotebooks` 复用公共函数。**死代码**：移除未使用的 `emit`/`i18n`/`plugin` props、内联单用的 `selectedNotebookIds` computed。**修复**：`deselectAll` 的 `.clear()`→`new Set()`（Set ref 响应式）；`<div>`→`<label>` 语义化（消除冗余 click+change 双处理）。构建验证通过。
- 2026-06-17：CodeBlockSettings 全面审查重构 — **Vue 组件**：emoji 图标替换为 Iconify 图标（12 处，CLAUDE.md 硬规则）；`getStyleName/getStyleDesc` 改为 `computed` 预计算映射（消除 v-for 内每次渲染重建 Record）；watch 存储保存添加 300ms 防抖；颜色字段改用 `colorFields` 数据驱动 `v-for` 渲染（原 6 个重复块的 54 行→17 行）；字体选项列表提取为 `presetFonts` 常量 + `v-for`。**SCSS**：移除 ~500 行死代码（预览区/语法高亮类无对应模板元素）；硬编码值替换为设计 Token（`$spacing-*/$radius-*/$font-size-*/$font-weight-*`）；响应式媒体查询合并为单一位置；`.toggle-slider::before` box-shadow→border。**icons.ts**：新增 12 个代码块图标注册。构建验证通过。
- 2026-06-17：代码块样式模块化迁移 — 将 `src/index.scss` 第13-222行代码块美化样式移至新文件 `src/features/generalSettings/styles/codeblockThemes.scss`，index.scss 改为 `@use` 引入。审查了静态 SCSS 与动态 JS 注入样式（`styles.ts` → `applyCodeBlockEnhancedStyles()`）的冲突，产出 `docs/codeblock-styles-conflict-review.md`。发现 3 个严重问题：动态 `!important` 覆盖 hover 边框变色、静态/动态两套行号机制共存（CSS counter vs `.ln`）、动态层滥用 20+ 处 `!important` 破坏 CSS 级联。架构校验通过 6 大原则。
- 2026-06-16：紧凑模式功能抽取并增强 — 将 index.scss 中紧凑模式 CSS 抽取为独立模块 `src/features/compactMode/`。**细调增强**：3 档间距密度（适中/紧凑/极简）+ 5 档字号缩放（80%/85%/90%/95%/100%）独立控制、5 个区域独立开关。全部通过 Sass @each 编译期乘法计算固定值，零 calc()/var()，CSS 类体系：siyuan-compact-mode + compact-density-* + compact-font-* + compact-area-*。
- 2026-06-16：index.scss 审查修复 — 移除 6 处 box-shadow（Codex 违规→替换为 border），紧凑模式块硬编码值替换为 $spacing-*/$font-size-* Token，移除废弃的 $codeblock-shadow 变量，修复格式问题。唯一保留的 box-shadow：Mac 代码块 ::before 伪元素的红黄绿按钮（纯 CSS 渲染技术，非页面阴影效果）
- 2026-06-13：dataBackup 模块全面审查重构（见当天日报）
- 2026-06-11：flashcardReading 模块审查重构（见当天日报）
- 2026-06-22：新增 skillLearning（技能学习）功能 — 代码片段练习库+闪卡记忆，Dock 右侧栏面板，C#/JS/TS/Vue 技术栈，支持自建/预设/Markdown导入三种内容来源，复用 useTypingQueue 加权复习算法
- 2026-06-23：toolCollection 新增快捷键 Ctrl+Alt+T（⌃⌥T），面板尺寸增加（宽 860→1060，高 60vh→calc(60vh+200px) min-height），移除背景遮罩改为 transparent。CODEBUDDY.md 新增"底部面板模式""快捷键注册""新增功能完整流程"三个规范章节。
