---
name: flashcardReading-scss-audit
overview: 审查 flashcardReading 的 SCSS 文件与 Vue 组件命名对应关系，修复 3 个文件命名违规 + 31 处字体硬编码 + 多余 margin 硬编码
todos:
  - id: rename-files
    content: 重命名 3 个 SCSS 文件（_dialog→CardDialog、_typing→TypingPractice、_statistics→StatisticsView）并更新 index.scss 中 @use 导入路径
    status: completed
  - id: fix-variables
    content: 修复 _variables.scss fc-label mixin 内 2 处硬编码（font-size:10px→$font-size-2xs，font-weight:700→$font-weight-bold）
    status: completed
  - id: fix-index
    content: 修复 index.scss 7 处字体硬编码 + margin-bottom:17px→$spacing-4
    status: completed
    dependencies:
      - rename-files
  - id: fix-renamed-dialog
    content: 修复 CardDialog.scss（原 _dialog）1 处 font-weight 硬编码
    status: completed
    dependencies:
      - rename-files
  - id: fix-renamed-typing
    content: 修复 TypingPractice.scss（原 _typing）13 处字体硬编码 + margin-left:6px→$spacing-2
    status: completed
    dependencies:
      - rename-files
  - id: fix-renamed-statistics
    content: 修复 StatisticsView.scss（原 _statistics）9 处字体硬编码
    status: completed
    dependencies:
      - rename-files
  - id: fix-flashcarddialog
    content: 修复 FlashcardDialog.scss 1 处 font-weight 硬编码
    status: completed
  - id: verify
    content: 验证所有修改文件 lint 零错误，确认重命名后 import 链完整
    status: completed
    dependencies:
      - fix-variables
      - fix-index
      - fix-renamed-dialog
      - fix-renamed-typing
      - fix-renamed-statistics
      - fix-flashcarddialog
---

## 用户需求

审查 `src/features/flashcardReading/styles/` 下所有 SCSS 文件：

1. 检查文件名与 Vue 组件的对应关系是否符合项目规范（组件专属 `<ComponentName>.scss` PascalCase 无 `_` 前缀）
2. 修复字体三要素硬编码违规（font-size/font-weight/line-height），统一改为全局设计 Token

## 核心改动

### 文件重命名（3 个）

| 当前文件 | 重命名为 | 对应 Vue 组件 |
| --- | --- | --- |
| `_dialog.scss` | `CardDialog.scss` | CardDialog.vue |
| `_typing.scss` | `TypingPractice.scss` | TypingPractice.vue |
| `_statistics.scss` | `StatisticsView.scss` | StatisticsView.vue |


### 导入链更新

`index.scss` 第 3-5 行：`@use 'dialog'` → `@use 'CardDialog'`，`'typing'` → `'TypingPractice'`，`'statistics'` → `'StatisticsView'`

### 字体硬编码修复（31 处 + 2 处 margin）

全部改为全局 Token：`$font-size-2xs` / `$font-weight-medium` / `$font-weight-semibold` / `$font-weight-bold` / `$line-height-normal`

## 技术方案

### 文件操作

使用文件系统重命名操作（git mv 等价语义），确保 Git 追溯历史不丢失。由于 3 个 partial 文件仅被 `index.scss` 引用，修改范围完全可控：

- 重命名 3 个 `.scss` 文件
- 更新 `index.scss` 中 3 行 `@use` 声明
- 6 个 SCSS 文件的内部硬编码修复

### 修复映射表

| 硬编码值 | 替换为 |
| --- | --- |
| `font-size: 10px` | `$font-size-2xs` |
| `font-weight: 500` | `$font-weight-medium` |
| `font-weight: 600` | `$font-weight-semibold` |
| `font-weight: 700` | `$font-weight-bold` |
| `line-height: 1.5` | `$line-height-normal` |
| `line-height: 1.6` | `$line-height-normal` |
| `margin-bottom: 17px` | `$spacing-4` |
| `margin-left: 6px` | `$spacing-2` |


保留不修复的微调值：`line-height: 1` / `1.2`（紧凑排版意图，无匹配 Token）、`margin-right: 2px` / `margin-top: 2px` / `margin-bottom: 10px` / `margin-top: -8px`（微调间距，改 Token 后视觉偏差明显）

### 注意事项

- `_variables.scss` 保持 `_` 前缀不变（纯 mixin/变量 partial，符合规范）
- `SingleCardView.scss` 已合规，无需修改
- Vue 组件不直接 import 被重命名的文件（它们通过 `index.scss` 间接加载），故 Vue 文件零改动