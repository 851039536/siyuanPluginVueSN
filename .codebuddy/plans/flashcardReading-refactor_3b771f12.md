---
name: flashcardReading-refactor
overview: 审查并重构 flashcardReading 模块：修复 CLAUDE.md 违规（剪贴板统一入口），合并冗余代码（重复剪贴板逻辑、未使用的 useCardNavigation），修复性能问题（O(n²) 队列构建优化、统计缓存），规范 types/index.ts 仅放类型定义，并给出扩展建议。
todos:
  - id: claude-compliance
    content: 修复 CLAUDE.md 违规：统一剪贴板调用为 copyToClipboard（index.vue/PanelHeader.vue/FlashcardDialog.vue）；拆分 types/index.ts 中的运行时逻辑到独立 FlashcardReading.ts
    status: completed
  - id: extract-usei18n-composable
    content: 提取 useI18n composable：统一 i18n fallback 模式，为所有组件提供带默认值的类型安全 i18n computed refs；修改所有 8 个组件模板使用该 composable
    status: completed
  - id: remove-redundancy
    content: 移除冗余：导出 STORAGE_KEY 常量；删除 useCardNavigation 并统一到 useTypingQueue（FlashcardDialog 改用 useTypingQueue）；消除组件间重复逻辑
    status: completed
  - id: perf-optimization
    content: 性能优化：useTypingQueue.buildQueue 改用 Fisher-Yates O(n) 洗牌；合并 index.vue 中 5 个打字设置 ref 为 reactive 对象；statisticsData 添加依赖去重缓存
    status: completed
  - id: extract-operations-composable
    content: 提取 useFlashcardOperations composable：将 index.vue 中 openCreateDialog/closeDialog/saveCard/editCard/deleteCard 等操作逻辑（约 200 行）移入独立 composable
    status: completed
  - id: split-scss-and-cleanup
    content: 拆分 styles/index.scss（958行）为 _dialog.scss、_typing.scss、_statistics.scss 三个独立文件；通过 index.scss 统一导入
    status: completed
  - id: verify-and-document
    content: 使用 [skill:vue-best-practices] 和 [skill:vite] 做最终验证：pnpm vite build 确认无警告；编写扩展建议到 README.md
    status: completed
    dependencies:
      - claude-compliance
      - extract-usei18n-composable
      - remove-redundancy
      - perf-optimization
      - extract-operations-composable
      - split-scss-and-cleanup
---

## 用户需求

审查 `src/features/flashcardReading` 模块全部 TypeScript/JavaScript/CSS/SCSS 代码，在不改变现有功能逻辑的前提下，完成以下工作：

1. 识别并合并冗余代码
2. 评估性能优化可能性
3. 进行代码重构
4. 确保修改符合项目 CLAUDE.md 编码规范
5. 给出扩展建议

## 审查范围

- `index.vue`（主面板，530行）
- `index.ts`（注册入口）
- `types/index.ts`（类型定义 + FlashcardReading 管理类 + 弹窗函数，215行）
- `types/storage.ts`（存储层，183行）
- `composables/useFlashcardStorage.ts`（存储 composable）
- `composables/usePlayWord.ts`（发音 composable）
- `composables/useTypingQueue.ts`（打字队列）
- `composables/useCardNavigation.ts`（卡片导航，仅 FlashcardDialog 使用）
- `components/CardDialog.vue, CardList.vue, CategoryFilter.vue, PanelHeader.vue, SingleCardView.vue, StatisticsView.vue, TypingPractice.vue, FlashcardDialog.vue`
- `styles/index.scss`（958行）

## 发现的问题清单

### 1. CLAUDE.md 规范违规

| 文件 | 行号 | 问题 | 修复方案 |
| --- | --- | --- | --- |
| `index.vue` | L528-535 | 直接使用 `navigator.clipboard.writeText` | 改用 `copyToClipboard` from `@/utils/domUtils` |
| `PanelHeader.vue` | L69-76 | 同上 | 同上 |
| `FlashcardDialog.vue` | L145-153 | 同上 | 同上 |
| `types/index.ts` | 全文 | 混合类型定义 + `FlashcardReading` 管理类 + `showFlashcardDialog` 等函数 | 管理类移动到独立 `FlashcardReading.ts`，弹窗函数保留但改为从该模块导出（types/index.ts 应仅放纯类型） |


### 2. 冗余代码

**剪贴板复制逻辑**：3 个文件中完全相同的 `try { navigator.clipboard.writeText; showMessage } catch { showMessage }` 模式，应统一用 `copyToClipboard` + 外层 `showMessage`。

**`STORAGE_KEY` 字符串 "flashcard-cards"**：在 `PanelHeader.vue` (L60) 和 `types/storage.ts` (L18) 中重复定义，应从 storage.ts 统一导出。

**导航逻辑重叠**：`useCardNavigation.ts` 的 `previous/next/random` 方法仅在 `FlashcardDialog.vue` 中使用，其模式与 `useTypingQueue` 高度相似但无权重计算。可合并为统一 composable。

**i18n fallback 模式散布**：如 `{{ i18n.addCard || '添加卡片' }}` 在 8 个组件模板中大量重复，应提取为统一的 `useI18n(i18n)` composable 提供带默认值的 computed refs。

### 3. 性能问题

**`useTypingQueue.buildQueue()` O(n²)**：while 循环内 `remaining.splice(pickedIndex, 1)` 删除数组中间元素导致 O(n²) 复杂度。应改为 Fisher-Yates 洗牌算法 O(n)。

**`statisticsData` computed 无缓存**：每次 cards 变化完整遍历重算，cards 频繁更新时（如打字练习 incrementPracticeCount）会触发重复计算。应有浅层依赖缓存。

**`categories` ref 与 storage 耦合**：`useFlashcardStorage` 中 categories 与 cards 分别异步加载，但 categories 是 cards 的派生数据，不应独立存储。

**25+ 独立 ref**：`index.vue` 中有 25 个独立的 `ref()` 声明，其中 `caseInsensitive/instantReset/coverMode/timerEnabled/sessionSize` 等 5 个打字设置可合并为 `reactive` 对象，减少响应式追踪开销。

### 4. 代码组织问题

**`index.vue` 过大**（530行）：可从 `loadCards` 到 `saveTypingSettings` 的操作逻辑（约 200 行）提取为 `composables/useFlashcardOperations.ts`。

**`types/index.ts` 职责不纯**（215行）：包含类型定义 + 管理类 + 弹窗函数。应按 CLAUDE.md 规定拆分为纯类型文件 + 独立功能文件。

**`style/index.scss` 过大**（958行）：可拆分 dialog 样式为 `_dialog.scss`、typing 样式为 `_typing.scss`、statistics 样式为 `_statistics.scss`。

## 实施计划

### 技术方案

- **CLAUDE.md 合规**：用 `copyToClipboard` 替换所有直接 `navigator.clipboard.writeText` 调用；拆分 `types/index.ts`
- **去冗余**：提取 `useI18n` composable 统一 fallback；导出 `STORAGE_KEY` 常量
- **性能优化**：`buildQueue()` 改用 Fisher-Yates 洗牌；合并 settings refs 为 reactive 对象
- **代码组织**：提取 `useFlashcardOperations`；拆分 scss 文件

### 关键决策

- `copyToClipboard` 返回 `Promise<boolean>`，调用方自行处理 showMessage，与现有模式一致
- FlashcardReading 管理类移入 `FlashcardReading.ts`（与 CLAUDE.md 中 `class MyFeatureStorage` 模式对齐）
- 不改变任何现有组件 props/emits 接口，保证完全向后兼容

### 风险控制

- 所有修改为纯内部重构，不改变 API 契约
- 每个任务完成后验证构建无错误
- 重构后功能行为与重构前完全一致

## 使用的 Agent 扩展

### Skill

- **vue-best-practices**
- 用途：确保重构后的 Vue 组件遵循 Composition API + script setup + TypeScript 最佳实践
- 预期结果：确认所有组件使用 Composition API，emit 命名符合 camelCase 规范，无 Options API 残留

- **vite**
- 用途：验证重构后 `pnpm vite build` 能否通过，确保 import/export 改动不引入构建错误
- 预期结果：构建成功无警告，模块依赖关系正确

### SubAgent

- **code-explorer**
- 用途：在重构前搜索项目中所有引用 flashcardReading 模块类型的文件，确认修改影响范围
- 预期结果：得到完整的引用关系图，确保不遗漏任何需要更新的引用路径
