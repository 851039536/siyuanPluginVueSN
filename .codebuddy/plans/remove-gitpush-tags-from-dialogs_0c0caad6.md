---
name: remove-gitpush-tags-from-dialogs
overview: 从 EditProjectDialog.vue 和 AddProjectDialog.vue 中移除所有标签相关 UI 和逻辑，同时更新父组件 index.vue 的对应绑定和 SCSS 样式。
todos:
  - id: remove-edit-dialog-tags
    content: 移除 EditProjectDialog.vue 中所有标签相关代码（模板、props、refs、函数、初始化回填、保存字段）
    status: completed
  - id: remove-add-dialog-tags
    content: 移除 AddProjectDialog.vue 中所有标签相关代码（模板输入框、ref、emit 类型、submit 逻辑）
    status: completed
  - id: update-parent-and-styles
    content: 更新父组件 index.vue（移除 :all-tags prop + 简化 handleAddFromDialog）并移除 styles/index.scss 中的 3 个标签样式块
    status: completed
    dependencies:
      - remove-edit-dialog-tags
      - remove-add-dialog-tags
---

## 用户需求

从 `EditProjectDialog.vue` 和 `AddProjectDialog.vue` 两个组件中彻底移除标签（tags）相关功能。

## 核心改动

- **EditProjectDialog.vue**：移除标签编辑 UI（标签展示列表、输入框、datalist 建议）、移除 `allTags` prop、移除 `localTags`/`tagInput` 状态、移除 `addTag()`/`removeTag()` 方法、移除初始化时标签回填、移除保存时的 tags 字段
- **AddProjectDialog.vue**：移除标签输入框、移除 `tags` ref 状态、移除 emit 中的 tags 参数、移除 submit 中的 tags 计算
- **index.vue（父组件）**：移除 EditProjectDialog 的 `:all-tags` prop 传递、更新 `handleAddFromDialog` 不再接收传递 tags
- **styles/index.scss**：移除 `.gp-edit-tags`、`.gp-edit-tag`、`.gp-edit-tag-x` 三个样式块

## 技术方案

### 实现策略

直接删除标签相关代码，不新增任何功能。`addProject` 的 `tags` 参数已经是可选的（`tags?: string[]`），所以只需不传即可。

### 影响范围控制

- 仅修改 4 个文件（2 个组件 + 1 个父组件 + 1 个样式文件）
- 数据类型 `GitProject.tags` 字段保留不动（已有数据不受影响，ListViewToolbar 的标签筛选功能继续可用）
- `allTags` computed / `getAllTags()` 仍保留在 `useProjectCrud.ts` 中，供 `ListViewToolbar` 使用
- `GitPushManager.updateProjectMeta` 的 `tags` 参数仍接受但 EditProjectDialog 不再传入

### 修改文件清单

```
src/features/gitPush/
├── components/
│   ├── EditProjectDialog.vue    # [MODIFY] 移除标签编辑 UI 及相关逻辑
│   └── AddProjectDialog.vue     # [MODIFY] 移除标签输入框及相关逻辑
├── index.vue                    # [MODIFY] 移除 :all-tags prop 绑定 + 更新 handleAddFromDialog
└── styles/
    └── index.scss               # [MODIFY] 移除 .gp-edit-tags/.gp-edit-tag/.gp-edit-tag-x 样式
```

### 各文件具体修改点

**EditProjectDialog.vue**（约 40 行删除）：

- 模板 L62-99：删除整个 `<div class="gp-form-group">` 标签区段
- Script props：删除 `allTags: string[]` 字段
- Script refs：删除 `localTags`、`tagInput` 两个 ref
- Script 函数：删除 `addTag()`（L622-628）、`removeTag()`（L630-632）
- onMounted：删除 L582 `localTags.value = [...(p.tags || [])]`
- save()：删除 L687 `tags: localTags.value`

**AddProjectDialog.vue**（约 10 行删除）：

- 模板 L48-53：删除标签 Input 组件块
- Script ref：删除 `tags` ref（L105）
- emit 类型：`tags: string[]` 改为不含 tags
- submit()：`tags: tags.value.split(",")...` 删除该字段

**index.vue**（约 5 行修改）：

- L290：删除 `:all-tags="allTags"`
- L792-794：`handleAddFromDialog` 参数类型去掉 `tags`，调用 `addProject` 不传 tags

**styles/index.scss**（约 29 行删除）：

- L976-1004：删除 `.gp-edit-tags`、`.gp-edit-tag`、`.gp-edit-tag-x` 三个样式块