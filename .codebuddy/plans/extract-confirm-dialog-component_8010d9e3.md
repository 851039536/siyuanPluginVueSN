---
name: extract-confirm-dialog-component
overview: 将 gitPush/index.vue 中的拉取确认弹窗（行 924-955）抽取为通用组件 ConfirmDialog.vue，并清理 styles/index.scss 中三处重复的 gp-modal-* 样式。
todos:
  - id: create-confirm-dialog
    content: "新建 ConfirmDialog.vue 通用确认弹窗组件（Props: visible/title/message/confirmText/cancelText，Emits: confirm/cancel）"
    status: completed
  - id: create-confirm-scss
    content: 新建 ConfirmDialog.scss，从 index.scss 行 978-1015 迁移 gp-modal-* 样式
    status: completed
  - id: update-index-vue
    content: 修改 index.vue：替换内联弹窗为 ConfirmDialog 组件导入，通过 props 传入 pendingPullLabel
    status: completed
    dependencies:
      - create-confirm-dialog
      - create-confirm-scss
  - id: clean-index-scss
    content: 清理 styles/index.scss 中三处重复的 gp-modal-* 样式定义（行 978-1015、1038-1073、1075-1114）
    status: completed
    dependencies:
      - create-confirm-scss
---

## 用户需求

将 gitPush/index.vue 第 924-955 行的拉取确认弹窗抽取为通用确认弹窗组件，然后在 index.vue 中导入使用。

## 核心功能

- 新建通用确认弹窗组件 ConfirmDialog.vue，支持自定义标题、消息文案、确认/取消按钮文字
- 将 gp-modal-* 样式从 styles/index.scss 迁移至独立的 ConfirmDialog.scss
- 清理 index.scss 中三处重复的 gp-modal-* 定义（行 978-1015、1038-1073、1075-1114）
- index.vue 中替换内联弹窗为 `<ConfirmDialog>` 组件引用

## 产品概览

将 gitPush 功能模块中的内联确认弹窗重构为独立的可复用 Vue 组件，遵循项目已有的子组件抽取模式（参照 SettingsDialog.vue）。同时消除 styles/index.scss 中三处样式重复定义问题。

## 技术方案

### 实现策略

参照 gitPush 模块中已有的 SettingsDialog.vue / CategoryDialog.vue 子组件模式：Props 传入数据 + Emits 传出事件 + 独立 SCSS 文件。

### 关键决策

1. **组件命名为 ConfirmDialog.vue**，放置于 `src/features/gitPush/components/`
2. **Props 设计**：`visible: boolean`（控制显隐）、`title: string`（弹窗标题）、`message: string`（弹窗正文，支持 HTML）、`confirmText?: string`（确认按钮文字，默认"确认"）、`cancelText?: string`（取消按钮文字，默认"取消"）
3. **Emits 设计**：`confirm`（确认回调）、`cancel`（取消/点击遮罩关闭）
4. **样式迁移**：取 index.scss 中最完整的一组 gp-modal-* 定义（行 978-1015，带 border-bottom/background 装饰），迁移至 ConfirmDialog.scss
5. **index.vue 改动**：用 `<ConfirmDialog>` 替代内联模板，`pendingPullLabel` 的计算仍保留在 index.vue 中通过 prop 传入

### 实现细节

- **文件头注释**：ConfirmDialog.vue 顶部添加 `<!-- gitPush 通用确认弹窗组件 -->`
- **SCSS 导入规则**：在 ConfirmDialog.vue 中使用双行导入（`@use '../styles/ConfirmDialog.scss'` + `@use '../styles/index.scss'`），与其他子组件保持一致
- **遮罩点击关闭**：`@click.self="$emit('cancel')"` 保持原有行为
- **清理 index.scss**：移除三处重复的 gp-modal-mask/dialog/header/body/footer 定义块

### 目录结构

```
src/features/gitPush/
├── components/
│   └── ConfirmDialog.vue    # [NEW] 通用确认弹窗组件
├── styles/
│   ├── ConfirmDialog.scss   # [NEW] 确认弹窗样式（从 index.scss 迁移）
│   └── index.scss           # [MODIFY] 删除三处 gp-modal-* 重复样式
└── index.vue                # [MODIFY] 替换内联弹窗为 ConfirmDialog 组件
```