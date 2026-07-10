---
name: pronunciation-redundancy-cleanup
overview: 修复 PronunciationDialog.vue 代码冗余和样式硬编码残留：删除死代码 matchedCard、提取 buildPrompt 公共后缀、handleCategorySelect 改 watch、categoryOptions 占位符走 i18n、3 处 SCSS 硬编码修复、模板空行清理。
todos:
  - id: remove-matchedcard
    content: 移除死代码 matchedCard ref 及其 2 处赋值
    status: completed
  - id: dedup-buildprompt
    content: 提取 buildPrompt 公共后缀 PROMPT_SUFFIX 消除中英文分支重复
    status: completed
  - id: inline-handlecategory
    content: 用 watch 替代 handleCategorySelect 薄壳函数
    status: completed
  - id: i18n-categoryoptions
    content: categoryOptions 占位选项改用 t() 读取 i18n
    status: completed
  - id: fix-scss-hardcode
    content: 修复 3 处 SCSS 硬编码残留（spacing 变量替换）
    status: completed
  - id: fix-template-blankline
    content: 移除模板 L55-56 多余空行
    status: completed
---

## 用户需求

修复 PronunciationDialog.vue 审查中发现的代码冗余和样式主题问题。

## 核心问题

### 代码冗余（4 项）

1. **死代码 `matchedCard`**：L315 声明 `ref<Flashcard | null>(null)`，在 L446/L455 被写入但组件内从未被读取
2. **`buildPrompt` 中英文分支 ~70% 重复**：L390-434，两个分支的「注意事项」块完全相同（6 行），格式指令高度相似
3. **`handleCategorySelect` 一行薄壳**：L524-528，仅清空 customCategoryInput，可用 watch 替代
4. **`categoryOptions` 占位选项硬编码**：L334-341，"请选择类别" 和 "自定义..." 未使用 t() 读取 i18n

### 样式硬编码残留（3 项）

5. `.empty-icon margin-bottom: 16px` → `g.$spacing-4`
6. `.result-content :deep(h4) margin: 0 0 12px 0; padding-bottom: 8px` → `g.$spacing-3` / `g.$spacing-2`
7. `.input-section @include ft.flex-column(8px)` → `ft.flex-column(g.$spacing-2)`

### 模板瑕疵（1 项）

8. L55-56 多余空行

## 修改文件

- `src/features/floatingToolbar/components/PronunciationDialog.vue`
- `src/features/floatingToolbar/styles/pronunciation.scss`

## 修复方案

### 1. 移除死代码 matchedCard

- 删除 L315 `const matchedCard = ref<Flashcard | null>(null)`
- 删除 L446 `matchedCard.value = null`
- 删除 L455 `matchedCard.value = localResult`

### 2. buildPrompt 去重

提取两个分支完全相同的「注意事项」块为模块级常量 `PROMPT_SUFFIX`，两个分支仅保留差异部分（中文翻译 vs 英文谐音），末尾拼接公共后缀。

### 3. handleCategorySelect → watch

删除 `handleCategorySelect` 函数和模板中的 `@change="handleCategorySelect"`，改用 `watch(selectedCategory, (val) => { if (val === '__custom__') customCategoryInput.value = '' })`。

### 4. categoryOptions i18n

将占位选项的 label 改为 `t('selectCategoryPlaceholder', ...)` 和 `t('customCategory', ...)`。

### 5-7. SCSS 硬编码修复

- L50: `8px` → `g.$spacing-2`
- L119: `0 0 12px 0` → `0 0 g.$spacing-3 0`
- L124: `8px` → `g.$spacing-2`
- L150: `16px` → `g.$spacing-4`

### 8. 模板空行

移除 L55-56 之间的多余空行。