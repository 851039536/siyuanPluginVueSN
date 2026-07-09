---
name: remove-single-card-view
overview: 从 flashcardReading 模块中移除"单卡"视图模式（ViewMode "single"），清理关联的类型定义、UI、i18n。
todos:
  - id: remove-single-view
    content: 从 types/index.ts、index.vue、useI18n.ts、i18n/zh_CN/flashcardReading.json、i18n/en_US/flashcardReading.json 中移除 single 视图模式相关代码（共 5 个文件 9 处改动）
    status: completed
---

## 用户需求

删除 flashcardReading 模块中的"单卡"视图模式（single view）。

## 核心改动

- ViewMode 联合类型移除 `"single"`
- 主面板移除单卡视图按钮和 SingleCardView 组件引用
- i18n 移除 `singleView` 键
- 保留 SingleCardView.vue 组件文件（FlashcardDialog.vue 仍在用）
- 保留共享 SCSS 样式（TypingPractice 共用）

## 技术方案

纯删除操作，无新增代码。涉及 5 个文件的精准裁剪。

### 文件修改清单

| 文件 | 行号 | 操作 |
| --- | --- | --- |
| `types/index.ts` | 47 | ViewMode 移除 `"single"` |
| `types/index.ts` | 76 | I18n 接口移除 `singleView?: string` |
| `index.vue` | 35-49 | 删除 `&lt;SingleCardView&gt;` 模板块 |
| `index.vue` | 139-145 | 删除 single 视图切换按钮 |
| `index.vue` | 205 | 删除 `SingleCardView` import |
| `index.vue` | 390 | `switchMode` 参数改为 `"typing"` |
| `composables/useI18n.ts` | - | DEFAULT_I18N 删除 `singleView` |
| `i18n/zh_CN/flashcardReading.json` | 26 | 删除 `"singleView": "单卡"` |
| `i18n/en_US/flashcardReading.json` | 26 | 删除 `"singleView": "Single"` |


### 保留不动

- `components/SingleCardView.vue` — FlashcardDialog.vue 弹窗式快速浏览仍需此组件
- `styles/index.scss` 中 `.single-card-view` / `.flashcard-item--single` — TypingPractice 打字练习共用
- `navigateAndPlay` 函数 — TypingPractice 仍使用
- `Flashcard` 类型导入 — CardList / onTypingCorrect 仍使用