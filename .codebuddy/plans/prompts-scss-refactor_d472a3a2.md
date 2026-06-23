---
name: prompts-scss-refactor
overview: 重构 `src/features/prompts/styles/` 目录：删除违规的以下划线命名的非 mixin 文件，改为遵循 CLAUDE_RULES.md 规范——每个组件对应一个 `styles/<ComponentName>.scss` 文件。
todos:
  - id: create-component-scss
    content: 新建 4 个组件 SCSS 文件并写入对应样式内容（CategoryManageModal / DeleteConfirmModal / PromptFormModal / PromptsGrid）
    status: completed
  - id: rewrite-index-scss
    content: 重写 index.scss：仅含模态基座 + loading/empty + .vp-form-actions + 全部响应式
    status: completed
  - id: delete-old-scss
    content: 删除 5 个旧文件（_modal / _grid / _form / _category / _responsive）
    status: completed
    dependencies:
      - create-component-scss
      - rewrite-index-scss
  - id: update-vue-imports
    content: 更新 5 个 .vue 文件的 style 导入：每个组件导入自身 SCSS + index.scss
    status: completed
    dependencies:
      - create-component-scss
      - rewrite-index-scss
  - id: verify-build
    content: 验证：pnpm lint + pnpm build 确认无 SCSS 编译错误
    status: completed
    dependencies:
      - update-vue-imports
      - delete-old-scss
---

## 问题

`src/features/prompts/styles/` 下 5 个文件（`_modal.scss`、`_grid.scss`、`_form.scss`、`_category.scss`、`_responsive.scss`）使用了 `_` 下划线前缀，但它们包含实际 CSS 选择器而非纯 mixins/变量，违反 CLAUDE_RULES.md 规定：下划线前缀仅用于 partial（纯 mixins/变量）。

## 修正目标

按规范重组为：

- 仅保留 `_mixins.scss` 使用 `_` 前缀（纯 mixins + 共享变量）
- 每个组件对应 `styles/<ComponentName>.scss`（PascalCase 无下划线）
- 共享的模态基座样式 + 响应式样式 → `index.scss`
- 每个 `.vue` 组件仅导入自身需要的样式文件

## 最终目录结构

```
styles/
├── _mixins.scss              # 保留（纯 mixins）
├── index.scss                # 模态基座 + loading/empty + .vp-form-actions + 全部响应式
├── CategoryManageModal.scss  # 分类管理（.vp-category-form/list/item 等）
├── DeleteConfirmModal.scss   # 删除确认（.vp-delete-msg）
├── PromptFormModal.scss      # 表单/编辑器（.vp-form/form-group/content-editor* 等）
└── PromptsGrid.scss          # 网格/卡片/搜索（.vp-grid/card/chip/content-block/tag 等）
```

## 实现方案

### 文件操作清单

| 操作 | 文件 | 说明 |
| --- | --- | --- |
| 删除 | `_modal.scss` | 内容拆入 `index.scss` |
| 删除 | `_grid.scss` | 内容迁移到 `PromptsGrid.scss` |
| 删除 | `_form.scss` | 内容迁移到 `PromptFormModal.scss` + `.vp-form-actions` 迁入 `index.scss` |
| 删除 | `_category.scss` | 内容迁移到 `CategoryManageModal.scss` |
| 删除 | `_responsive.scss` | 内容迁入 `index.scss` |
| 重写 | `index.scss` | 仅含模态基座 + loading/empty + `.vp-form-actions` + 全部响应式 |
| 新建 | `CategoryManageModal.scss` | `_category.scss` 全部内容 |
| 新建 | `DeleteConfirmModal.scss` | `.vp-delete-msg` |
| 新建 | `PromptFormModal.scss` | `_form.scss` 除 `.vp-form-actions` 外的全部内容 |
| 新建 | `PromptsGrid.scss` | `_grid.scss` 全部内容 |
| 保留 | `_mixins.scss` | 无需改动 |


### 组件导入变更

| .vue 文件 | 原 `<style>` | 新 `<style>` |
| --- | --- | --- |
| `index.vue` | `@use './styles/index.scss'` | `@use './styles/index.scss'`（不变） |
| `CategoryManageModal.vue` | `@use '../styles/index.scss'` | `@use '../styles/CategoryManageModal.scss'` + `@use '../styles/index.scss'` |
| `DeleteConfirmModal.vue` | `@use '../styles/index.scss'` | `@use '../styles/DeleteConfirmModal.scss'` + `@use '../styles/index.scss'` |
| `PromptFormModal.vue` | `@use '../styles/index.scss'` | `@use '../styles/PromptFormModal.scss'` + `@use '../styles/index.scss'` |
| `PromptsGrid.vue` | `@use '../styles/index.scss'` | `@use '../styles/PromptsGrid.scss'` + `@use '../styles/index.scss'` |


每个子组件导入 2 个文件：自己的组件专属样式 + `index.scss`（共享模态基座/通用样式）。

### 样式归属说明

- `.vp-form-actions` 同时被 `PromptFormModal.vue` 和 `DeleteConfirmModal.vue` 使用，提至 `index.scss` 作为共享样式
- `.vp-modal-icon--danger` 仅被 `DeleteConfirmModal.vue` 使用，但属于模态基座体系，保留在 `index.scss`
- 全部响应式 `@media (max-width: 768px)` 规则集中在 `index.scss`，避免碎片化