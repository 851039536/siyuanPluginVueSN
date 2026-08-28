# 闪卡阅读

闪卡式阅读/记忆工具，支持分类管理和卡片翻转。提供列表视图、单卡视图和统计视图三种模式，用户可创建、编辑、分类闪卡，记录练习次数，适用于背单词或知识点记忆。

## 目录结构

```
src/features/flashcardReading/
├── index.ts                         # 功能注册入口 → FlashcardReading
├── FlashcardReading.ts              # 注册类 + 弹窗控制（showFlashcardDialog 等）+ destroy 清理
├── index.vue                        # 主面板组件
├── utils.ts                         # 纯工具函数（syncIncrementPractice / copyAndNotify）
├── README.md
├── types/
│   ├── index.ts                     # 类型定义（Flashcard, I18n, ViewMode 等）+ CARD_CONFIG 共享常量 + FlashcardTabManager 独立窗口管理器
│   └── storage.ts                   # FlashcardStorage 存储层（导出 STORAGE_KEY）
├── composables/
│   ├── useFlashcardStorage.ts       # 存储 composable（模块级共享单例：storage + cards/categories）
│   ├── useFlashcardOperations.ts    # 列表侧操作 composable（弹窗开关 + 删除）
│   ├── useI18n.ts                   # 国际化统一 fallback composable
│   ├── usePlayWord.ts               # 发音 composable（SpeechSynthesis，卸载时自动取消）
│   └── useTypingQueue.ts            # 打字练习加权队列（Fisher-Yates 优化）
├── components/
│   ├── PanelHeader.vue              # 面板标题栏 + 存储路径
│   ├── CategoryFilter.vue           # 分类筛选 + 搜索
│   ├── CardList.vue                 # 列表视图
│   ├── SingleCardView.vue           # 单卡视图
│   ├── StatisticsView.vue           # 统计视图
│   ├── TypingPractice.vue           # 打字练习
│   ├── CardDialog.vue               # 卡片创建/编辑弹窗（自包含：内部持有表单状态并直接调 storage）
│   └── FlashcardDialog.vue          # 弹窗式快速浏览
└── styles/
    ├── _variables.scss              # 局部 SCSS 变量和 mixin
    ├── index.scss                   # 主样式入口（引用 CardDialog/TypingPractice/StatisticsView）
    ├── CardDialog.scss              # 卡片弹窗样式
    ├── TypingPractice.scss          # 打字练习样式
    ├── StatisticsView.scss          # 统计视图样式
    ├── SingleCardView.scss          # 单卡视图样式（index.vue 与 FlashcardDialog 共用）
    └── FlashcardDialog.scss         # 弹窗式快速浏览样式
```

## 数据流说明

- **存储单例**：`useFlashcardStorage` 内部维护模块级共享 `FlashcardStorage` 实例与 `cards`/`categories` 响应式状态，Dock 面板与浮动弹窗复用同一份数据；`resetFlashcardStorage()` 在插件卸载时重置。
- **数据同步事件**：任何入口（CardDialog 保存、列表删除、浮动工具栏收藏）写入后均通过 `emitCustomEvent("flashcardDataChanged")` 广播，监听侧统一刷新共享状态。
- **弹窗自包含**：CardDialog 只接收 `visible` + `editingCard` + `i18n` + `plugin`，表单校验与持久化全部在弹窗内部完成，仅 emit `saved`/`close` 极简通知。

## 单词标记与边学边写过滤

- **标记入口**：列表卡片操作区的眼睛按钮（`CardList.vue`）与边学边写当前词旁的标记按钮（`TypingPractice.vue`），写入 `Flashcard.typingHidden`（共享模型字段，见 `@/utils/sharedStorage/flashcardStorage.ts`）；已标记单词在列表中标题弱化显示。
- **过滤开关**：边学边写顶部"隐藏标记/显示标记"toggle，持久化到 `TypingSettings.hideMarked`（默认开启：标记即从练习队列排除；切到"显示标记"可临时把已标记词放回练习）；开启时 `index.vue` 的 `typingCards` computed 剔除已标记单词，仅影响练习队列，列表/统计视图不受影响。
- **练习中标记**：边学边写内标记当前词且开关开启时，该词从队列原位剔除（保持当前进度），不整队重建。

## 双形态承载（Dock 面板 + 独立窗口）

- **独立窗口**：面板头部"在独立窗口打开"按钮（浮动窗口内经 `isFloating` 自动隐藏）→ `FlashcardTabManager.openFloating()`（`types/index.ts`）：`openTab` 创建/聚焦主窗口页签（`iconBookmark` 图标）→ `openWindow` 移入浮动窗口；关闭浮动窗口时页签自动移回主窗口。
- **页签模型**：`plugin.addTab({ type: "flashcard-reading-tab" })` 在 Manager 构造时同步注册，模块级 `tabRegistered` 防多进程重复注册；页签内以 `mode: "tab"` 挂载同一 `index.vue`，容器补 `vp-dock-root` 全局基准字号。
- **独立窗体 UI 精简**：浮动窗口中 `PanelHeader` 传 `floating` 隐藏重复标题（页签标题已标识功能名），添加/刷新等操作按钮保留，功能逻辑零改动。
- **跨窗口同步限制**：独立窗口是独立渲染进程，`flashcardDataChanged` 事件不跨窗口；打开时经共享存储加载全量数据，另一侧的增删改在本窗口需刷新（刷新按钮）后可见。

## 扩展建议

### 1. 导入/导出功能
- 添加 JSON 格式的批量导入/导出，支持从 Anki/CSV 格式转换
- 使用 `triggerBlobDownload` / `triggerDownload` from `@/utils/domUtils`

### 2. 间隔重复算法（Spaced Repetition）
- 引入 SM-2 或 FSRS 算法替代简单的 `practiceCount` 递增
- 基于卡片掌握度决定复习优先级，而非仅按练习次数加权

### 3. 键盘快捷键
- 添加全局/局部快捷键支持（← → 翻卡、Enter 确认打字、Escape 关闭弹窗）
- 使用 `emitCustomEvent` from `@/utils/eventBus` 通知父组件

### 4. 数据备份与迁移
- 添加版本号机制检测存储格式变更
- 提供 `settingsBackup.ts` 中的备份/恢复入口

### 5. 卡片排序与筛选增强
- 支持按创建时间/练习次数/掌握度排序
- 支持多选分类筛选标签

### 6. 批量操作
- 批量删除/移动/标记卡片
- 右键菜单操作支持

### 7. 打字练习增强
- 错误单词自动收藏到专属复习队列
- 练习完成后展示错误排行榜
- 支持自定义每轮卡片数范围（当前 5-100）
