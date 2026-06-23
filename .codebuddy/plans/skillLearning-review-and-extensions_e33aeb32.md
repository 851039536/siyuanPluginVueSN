---
name: skillLearning-review-and-extensions
overview: 对 skillLearning 功能进行代码审查，输出审查报告（问题清单 + 扩展建议方案），不修改任何代码。
todos:
  - id: fix-p0-critical
    content: 修复 4 个 P0 严重缺陷：删除功能暴露到 UI、练习计数递增、KeepAlive 键盘泄漏、页码不重置
    status: completed
  - id: fix-p1-medium
    content: 修复 4 个 P1 中等缺陷：AI 失败提示、watch 中断测验、i18n 三层冗余精简、硬编码+函数去重
    status: completed
    dependencies:
      - fix-p0-critical
  - id: fix-p2-scss
    content: 修复 P2 SCSS 硬编码：FlashcardView.scss 中 gap/padding 使用 $spacing-* token 替换硬编码 px 值
    status: completed
    dependencies:
      - fix-p1-medium
  - id: extend-spaced-repetition
    content: 扩展间隔重复复习系统：SM-2 算法 + ReviewView 组件 + useReviewQueue composable + 复习数据存储
    status: completed
    dependencies:
      - fix-p2-scss
  - id: extend-markdown-import
    content: 扩展 Markdown 批量导入 UI：useMarkdownParser + ImportDialog 组件 + 工具栏入口按钮
    status: completed
    dependencies:
      - fix-p2-scss
  - id: extend-stats-dashboard
    content: 扩展学习统计看板：StatsView 组件 + practiceHistory 存储 + Chart.js 可视化
    status: completed
    dependencies:
      - extend-spaced-repetition
---

## 审查目标

对 `src/features/skillLearning` 功能进行全量代码审查，修复已发现的 11 个缺陷，并规划 5 项功能扩展，生成含优先级排序的审查报告与实施路线图。

## 审查发现的核心缺陷（按严重程度排序）

### 严重（影响功能正确性）

1. **删除功能未暴露到 UI**：`useSkillStorage` 正确导出了 `deleteCard`，`index.vue` 也解构了它，但 `SkillListView.vue` 模板中无删除按钮，用户无法删除卡片
2. **练习计数从未递增**：`FlashcardView` 答题完成后不调用 `incrementPracticeCount`，导致 `practiceCount` 始终为 0，底部统计的"已练习"数据无意义
3. **KeepAlive 与键盘监听生命周期冲突**：`FlashcardView` 在 `onMounted/onUnmounted` 中注册/移除 `keydown` 事件，但父组件用 `<KeepAlive>` 包裹，切换 tab 时组件不卸载，键盘监听泄漏到列表视图
4. **搜索/筛选变更时页码未重置**：`SkillListView` 改变 `searchQuery`、筛选条件后 `page` 保持原值，可能停留在空白页

### 中等（影响用户体验）

5. **AI 生成失败无用户提示**：`SkillDialog` 中 `aiGenerate` 的 catch 仅 `console.warn`，用户不知道生成失败
6. **watch(props.cards) 中断测验**：`FlashcardView` 监听 `props.cards` 变化时重置整个 `quizItems`/`currentIndex`/`phase`，若用户正在答题中途外部卡片变化（如新建卡片）会丢失进度
7. **i18n 三层冗余**：`useI18n.ts` 的 `DEFAULT_I18N`(60+键)、JSON 翻译文件(71键)、`FlashcardView/SkillListView` 中各维护本地 fallback，修改一个翻译需要同步 3 处
8. **模板硬编码中文 + 函数重复**：`FlashcardView` 模板中 `'(空)'`、`SkillListView` 模板中 `'次'` 硬编码；`langLabel` 函数在 `CategoryFilter.vue`(第59行)和 `FlashcardView.vue`(第310行)中重复实现

### 轻微（代码质量）

9. **SCSS 硬编码数值**：`FlashcardView.scss` 第111行 `gap: 10px`、第21行 `gap: 10px`、第166行 `gap: 10px`、第275行 `gap: 10px` 等未使用 `$spacing-*` token
10. **Markdown 批量导入 UI 缺失**：i18n 已预留 `importPreview/importMarkdown/importHint/parseResult/confirmImport/noValidCards` 等 10+ 个键，但无对应导入组件
11. **间隔重复系统缺失**：i18n 中有 `reviewView/remembered/fuzzy/forgot/noReviewCards/reviewComplete/flipCard/prevCard/nextCard/randomCard` 等 10+ 个复习键，但无对应复习视图实现

## 扩展建议方案（5 项，按价值排序）

1. **间隔重复复习系统**（高价值）：基于 SM-2 算法实现闪卡式复习，记录每次评分（记得/模糊/忘记）自动计算下次复习间隔，取代当前无记忆的一次性测验
2. **Markdown 批量导入 UI**（高价值）：实现解析器 + 预览 + 确认导入对话框，支持用户按模板格式批量创建卡片
3. **学习统计看板**（中等价值）：展示练习总次数、正确率趋势、各语言/难度掌握程度、连续学习天数等
4. **卡片导出功能**（中等价值）：支持导出为 Markdown/JSON，方便用户备份或迁移数据
5. **与思源文档块联动**（探索性）：将思源文档块内容自动解析为学习卡片，或从卡片跳转到对应笔记

## 输出物

- 完整的代码审查报告（11 个缺陷的分析与修复方案）
- 优先级排序的实施路线图（缺陷修复 P0-P2 + 扩展建议 P1-P3）
- 每个扩展的功能设计概要（数据结构、UI 布局、核心交互）

## 技术方案

### 审查与修复策略

**原则**：修复优先，扩展其次。先解除功能阻塞（删除、计数），再修复体验问题（i18n、生命周期），最后做代码质量提升（SCSS token、函数去重）。

#### 缺陷修复方案

| # | 问题 | 修复方案 | 影响文件 | 优先级 |
| --- | --- | --- | --- | --- |
| 1 | 删除功能未暴露 | `SkillListView` 卡片添加 × 删除按钮，emit delete 事件到 `index.vue`，调用 `deleteCard` + 确认弹窗 | SkillListView.vue, index.vue | P0 |
| 2 | 练习计数未递增 | `FlashcardView` 在 `goNext` 答对时 emit `practice` 事件，`index.vue` 调用 `incrementPracticeCount`；同时给计数字段加乐观更新 | FlashcardView.vue, index.vue | P0 |
| 3 | KeepAlive+键盘泄漏 | 改用 `onActivated/onDeactivated` 注册/移除键盘事件，替代 `onMounted/onUnmounted` | FlashcardView.vue | P0 |
| 4 | 页码未重置 | `SkillListView` 添加 `watch([searchQuery, selectedLanguage, selectedCategory, selectedDifficulty], () => page=1)` | SkillListView.vue | P0 |
| 5 | AI失败无提示 | `SkillDialog` catch 中设置 `aiError` ref，模板中条件渲染错误文案 | SkillDialog.vue | P1 |
| 6 | watch中断测验 | 删除 `watch(props.cards)`，改为 `watch(() => props.cards.length)` 仅在数量变化时重置；或添加 `quizActive` 标志在答题中屏蔽重置 | FlashcardView.vue | P1 |
| 7 | i18n三层冗余 | 删除 `DEFAULT_I18N` 中的 i18n 键（JSON 已覆盖），`FlashcardView/SkillListView` 移除本地 fallback 直接使用 props.i18n；保留 `DEFAULT_I18N` 仅用于 JSON 中不存在的键作为真正 fallback | useI18n.ts, FlashcardView.vue, SkillListView.vue | P1 |
| 8 | 硬编码+函数重复 | 提取 `langLabel` 到 `composables/useLangLabel.ts`；模板中 `'(空)'`/`'次'` 改用 i18n 键 | FlashcardView.vue, SkillListView.vue, CategoryFilter.vue, 新增 composable | P1 |
| 9 | SCSS硬编码 | `FlashcardView.scss` 中 `gap: 10px` 改为 `gap: $spacing-2`(8px) 或 `gap: $spacing-3`(12px)，对齐 Codex 间距体系 | FlashcardView.scss | P2 |
| 10 | Markdown导入UI | 新建 `ImportDialog.vue` 组件，含 Markdown 粘贴区 + 解析预览表 + 确认按钮 | 新增组件 | 扩展 |
| 11 | 间隔重复 | 新建 `ReviewView.vue` + `useReviewQueue.ts`，基于 SM-2 算法 | 新增组件+composable | 扩展 |


#### 扩展功能技术方案

**1. 间隔重复复习系统**

- **算法**：SM-2（SuperMemo 2），每次评分 remembered/fuzzy/forgot 对应 EF 调整和间隔计算
- **数据结构**：`SkillCard` 扩展 `reviewData?: { ef: number; interval: number; nextReview: number; repetitions: number }`
- **存储**：`SkillStorage` 新增 `updateReviewData(id, data)` 方法
- **UI**：`ReviewView.vue` — 单卡片翻转模式，正面题目/背面答案+代码，三个评分按钮
- **复习队列**：`useReviewQueue.ts` — 筛选 `nextReview <= Date.now()` 的卡片，按间隔升序排列

**2. Markdown 批量导入 UI**

- **解析器**：`composables/useMarkdownParser.ts` — 解析 `## title\n\nanswer\n\n- distractor...\n\n```lang\ncode\n\`\`\`` 格式
- **UI**：`ImportDialog.vue` — textarea 粘贴区 + 解析结果预览表格 + 确认导入按钮
- **注册**：在 `index.vue` 工具栏添加导入按钮，打开 ImportDialog

**3. 学习统计看板**

- **数据来源**：基于 `practiceCount` + 新增的 `practiceHistory: { date: number; rating: ReviewRating }[]`
- **UI**：`StatsView.vue` — Chart.js 柱状图（每日练习量）+ 饼图（难度分布）+ 进度环
- **存储**：`SkillStorage` 新增 `addPracticeRecord(id, rating)` 追加历史

**4. 卡片导出**

- **格式**：Markdown（可重新导入）+ JSON（完整数据备份）
- **实现**：`composables/useExport.ts` — 生成 Markdown/JSON 字符串，调用 `triggerBlobDownload`
- **UI**：在工具栏或上下文菜单添加导出按钮

**5. 与思源文档块联动**

- **方向A（块→卡片）**：右键菜单「生成学习卡片」，用 AI 从选中块内容提取题目+答案+干扰项
- **方向B（卡片→块）**：卡片详情中「在笔记中查看」，跳转到关联的思源块
- **实现**：通过 `@/api` 中思源 API 封装获取块内容，通过 `eventBus` + `App.vue` 调度跳转

### 架构约束

- 所有新增功能必须通过 8 步注册清单
- 跨功能通信使用 `emitCustomEvent` + `App.vue` 调度，不直接导入
- 存储使用 `PluginStorage`，AI 使用 `callAI`
- SCSS 分离到 `styles/` 目录，使用全局设计 Token
- 新增 i18n 键在 `src/i18n/{zh_CN,en_US}/skillLearning.json` 追加
