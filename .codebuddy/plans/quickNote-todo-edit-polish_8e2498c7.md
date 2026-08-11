---
name: quickNote-todo-edit-polish
overview: 为待办 Tab 增加编辑功能（复用 TodoForm 编辑模式，参考已完成的 Project 编辑模式）和 AI 润色按钮（参考 InspirationForm 已有的 polish 模式）。涉及 4 个文件：TodoItem.vue、TodoForm.vue、TodoForm.scss、index.vue。
todos:
  - id: edit-todo-item-btn
    content: TodoItem.vue actions 区域新增编辑按钮，emit edit 事件
    status: completed
  - id: edit-todo-form-mode
    content: TodoForm.vue 支持 editingTodo + plugin prop，编辑模式回填表单 + AI 润色 + 保存/取消按钮 + 提交区分新增/编辑
    status: completed
  - id: edit-todo-scss
    content: TodoForm.scss 新增润色按钮、取消按钮、保存按钮样式
    status: completed
    dependencies:
      - edit-todo-form-mode
  - id: edit-todo-index-dispatch
    content: index.vue 管理 editingTodo 状态，TodoForm 传 plugin+editingTodo，分发 add/update + 取消清空
    status: completed
    dependencies:
      - edit-todo-item-btn
      - edit-todo-form-mode
---

## 用户需求

为 quickNote「待办」Tab 增加条目的编辑修改功能（内容、优先级、截止日期、关联项目）以及 AI 润色能力。

## 核心功能

- **卡片编辑入口**：TodoItem 卡片 actions 区域新增编辑按钮（铅笔图标），与现有顺延/删除按钮并列
- **表单编辑模式**：点击编辑后，TodoForm 回填当前条目数据，字段区增加 AI 润色按钮（火花图标），底部按钮区切换为"取消 + 保存"
- **AI 润色待办内容**：编辑模式和非编辑模式均可点击润色按钮，调用 `useAiPolish` 流式 AI 重写 content 字段，失败自动恢复原稿并提示
- **保存更新**：保存时调用 `todoList.update(id, patch)` 更新并持久化，表单恢复为新增模式
- **取消编辑**：取消按钮清空编辑状态和表单，回到新增模式

## 实现策略

**数据流设计**：编辑状态由 `index.vue` 集中管理（`editingTodo: Ref<TodoItem | null>`），通过 props 传递到 `TodoForm`，通过 emit 从 `TodoItem` 向上传递。此模式与刚完成的 Project 编辑功能完全一致，保证模块内风格统一。

**表单复用**：借用 Project 编辑模式——TodoForm 通过 `editingTodo` prop 是否为 null 区分新增/编辑，通过 `watch(editingTodo, { immediate })` 自动回填/清空。与 Project 不同的是 Todo 表单需保留 Enter 快速添加行为（仅新增模式生效）。

**AI 润色复用**：直接复用已可用于灵感模块的 `useAiPolish(plugin)` + `polishText(polish, targetRef, original, i18n)`，零新代码。todo content 是 `ref<string>`，完美适配 `polishText` 的 `{ value: string }` 接口。

### 改动点

#### 1. TodoItem.vue — 卡片新增编辑按钮

- emit 新增 `edit: []`
- actions 区域在顺延按钮前插入编辑按钮：`<button class="qn-icon-btn" :title="i18n.edit" @click="emit('edit')">` + `IconWrapper name="edit" :size="12"`
- 更新文件头注释（加入编辑相关描述）

#### 2. TodoForm.vue — 编辑模式 + AI 润色

- 新增 props：`plugin: Plugin`（AI润色需要）、`editingTodo?: TodoItem | null`（非 null 为编辑模式）
- 新增 `watch(editingTodo, { immediate })`：有值回填 content/priority/dueDate/projectId，无值清空
- emit 改造：`add` → `submit`（payload 新增可选 `id`），新增 `cancel: []`
- 新增 `useAiPolish(props.plugin)` + 润色按钮（仅 content 非空时可用）
- `handleSubmit`：编辑模式带 id 提交且不清空（由父清空 editingTodo 触发 watch 复位），新增模式提交后清空
- 模板：新增模式保持原有 Enter 快速添加行为；编辑模式下 Enter 改为保存（区分两模式 keyboard handler）
- 按钮区：编辑模式显示润色+取消+保存三按钮；新增模式显示+按钮（保留原布局）
- 更新文件头注释

#### 3. TodoForm.scss — 润色/保存/取消按钮样式

- 新增 `.qn-todo-form__polish-btn`：图标按钮样式（参考 InspirationForm 的 `.qn-insp-form__icon-btn`），28x28 方形，灰色透明底，hover 品牌蓝
- 新增 `.qn-todo-form__cancel-btn`：边框按钮（与 ProjectForm 的 cancel-btn 一致），`margin-right: auto` 左对齐
- 新增 `.qn-todo-form__save-btn`：品牌蓝块按钮（复用 add-btn 选择器）
- 编辑模式 `.qn-todo-form__row` 第一行增加润色按钮空间

#### 4. index.vue — 编辑状态调度

- 新增 `editingTodo: Ref<TodoItemType | null> = ref(null)`
- `TodoForm` 新增 props：`:plugin="plugin"`、`:editing-todo="editingTodo"`，`@add` 改为 `@submit="handleTodoSubmit"` + `@cancel="handleTodoCancel"`
- `TodoItem` 新增事件：`@edit="startTodoEdit(todo)"`
- 新增方法：
- `startTodoEdit(todo)`：`editingTodo.value = todo`
- `handleTodoSubmit(payload)`：`payload.id ? todoList.update(id, patch) : todoList.add(payload)`，编辑成功后 `editingTodo = null`
- `handleTodoCancel()`：`editingTodo.value = null`

### 影响范围

- 仅修改 4 个文件，无新增文件
- 无破坏性变更，向后完全兼容
- i18n 键已存在（edit/save/cancel/polish），无需修改
- 图标已注册（edit/sparkles/check/close），无需修改
- `useTodoList` composable 的 `update(id, patch)` 方法不动
- `useAiPolish` 和 `polishText` 公用函数不动