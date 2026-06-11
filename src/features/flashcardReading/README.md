# 闪卡阅读

闪卡式阅读/记忆工具，支持分类管理和卡片翻转。提供列表视图、单卡视图和统计视图三种模式，用户可创建、编辑、分类闪卡，记录练习次数，适用于背单词或知识点记忆。

## 目录结构

```
src/features/flashcardReading/
├── index.ts                         # 功能注册入口 → FlashcardReading
├── FlashcardReading.ts              # 注册类 + 弹窗控制（showFlashcardDialog 等）
├── index.vue                        # 主面板组件
├── README.md
├── types/
│   ├── index.ts                     # 纯类型定义（Flashcard, I18n, ViewMode 等）
│   └── storage.ts                   # FlashcardStorage 存储层（导出 STORAGE_KEY）
├── composables/
│   ├── useFlashcardStorage.ts       # 存储 composable（cards ref + loadCards）
│   ├── useFlashcardOperations.ts    # CRUD 操作 composable
│   ├── useI18n.ts                   # 国际化统一 fallback composable
│   ├── usePlayWord.ts               # 发音 composable（SpeechSynthesis）
│   └── useTypingQueue.ts            # 打字练习加权队列（Fisher-Yates 优化）
├── components/
│   ├── PanelHeader.vue              # 面板标题栏 + 存储路径
│   ├── CategoryFilter.vue           # 分类筛选 + 搜索
│   ├── CardList.vue                 # 列表视图
│   ├── SingleCardView.vue           # 单卡视图
│   ├── StatisticsView.vue           # 统计视图
│   ├── TypingPractice.vue           # 打字练习
│   ├── CardDialog.vue               # 卡片创建/编辑弹窗
│   └── FlashcardDialog.vue          # 弹窗式快速浏览
└── styles/
    ├── _variables.scss              # 局部 SCSS 变量和 mixin
    ├── index.scss                   # 主样式入口（引用 _dialog/_typing/_statistics）
    ├── _dialog.scss                 # 弹窗样式
    ├── _typing.scss                 # 打字练习样式
    └── _statistics.scss             # 统计视图样式
```

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
