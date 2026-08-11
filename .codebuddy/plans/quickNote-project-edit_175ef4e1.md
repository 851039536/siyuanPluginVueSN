---
name: quickNote-project-edit
overview: 为 quickNote 项目跟进 Tab 增加编辑修改功能：ProjectItem 卡片增加编辑按钮 → ProjectForm 支持编辑模式（回填表单 + 保存/取消） → index.vue 串联编辑状态调度。
todos:
  - id: edit-project-item-btn
    content: ProjectItem.vue 卡片头部 actions 新增编辑按钮，emit edit 事件
    status: completed
  - id: edit-project-form-mode
    content: ProjectForm.vue 支持 editingProject prop，编辑模式回填表单 + 保存/取消按钮 + 提交区分新增/编辑
    status: completed
  - id: edit-index-dispatch
    content: index.vue 管理编辑状态，ProjectForm 传 prop + ProjectItem 接 emit，分发 add/update + 取消清空
    status: completed
    dependencies:
      - edit-project-item-btn
      - edit-project-form-mode
  - id: edit-cancel-btn-style
    content: ProjectForm.scss 新增取消按钮样式，编辑模式 actions 左右布局
    status: completed
    dependencies:
      - edit-project-form-mode
---

## 用户需求

为 quickNote「项目跟进」Tab 增加编辑已创建项目的功能。目前该 Tab 仅有新增表单和删除按钮，用户无法修改已创建的项目名称、状态、进度或卡点信息。

## 核心功能

- **卡片编辑入口**：ProjectItem 卡片头部操作区新增编辑按钮（铅笔图标），与现有删除按钮并列
- **表单编辑模式**：点击编辑后，ProjectForm 回填当前项目数据，按钮区切换为"保存 + 取消"
- **保存更新**：保存时调用 `projectsApi.update(id, patch)` 更新数据并持久化，表单恢复为新增模式
- **取消编辑**：取消按钮清空编辑状态和表单，回到新增模式

## 技术方案

### 实现策略

**数据流设计**：编辑状态由 `index.vue` 集中管理（`editingProject: Ref<ProjectItem | null>`），通过 props 向下传递到 `ProjectForm`，通过 emit 从 `ProjectItem` 和 `ProjectForm` 向上传递事件。这符合项目现有的子组件数据流模式（父管状态、子纯展示+emit）。

**关键决策**：

- 编辑态表单复用同一个 `ProjectForm` 组件，通过 `editingProject` prop 是否为 null 区分新增/编辑模式，避免创建新组件
- 编辑时表单字段用 `watch` 响应 `editingProject` 变化，自动回填数据
- 保存时 index.vue 判断 `editingProject` 是否存在，分发 `add()` 或 `update()`

### 改动点

#### 1. ProjectItem.vue — 卡片新增编辑按钮

- `.qn-proj-item__actions` 中删除按钮前插入编辑按钮（`<button class="qn-icon-btn" :title="i18n.edit" @click="emit('edit')">`）
- emit 定义新增 `edit: []`
- 图标使用已注册的 `edit`（mdi:pencil）

#### 2. ProjectForm.vue — 支持编辑模式

- 新增 `editingProject?: ProjectItem | null` prop
- `watch(editingProject)`：有值时回填 `name/status/currentStep/nextStep/blockers`，无值时清空
- 新增 emit `cancel: []`
- `handleSubmit`：新增模式 emit `submit(payload)` 不变；编辑模式 emit `submit({ ...payload, id: editingProject.value.id })`
- 按钮区：编辑模式显示"保存"（disabled 条件同新增）+ "取消"按钮；新增模式仅显示"添加项目"
- 提交文案用 computed：编辑模式用 `i18n.save`，新增用 `i18n.addProject`

#### 3. index.vue — 编辑状态调度

- 新增 `editingProject: Ref<ProjectItem | null> = ref(null)`
- `ProjectForm` 增加 prop `:editing-project="editingProject"`
- `ProjectItem` 增加事件 `@edit="startEdit(project)"`
- `startEdit(project)`：设置 `editingProject.value = project`
- `handleProjectSubmit(payload)`：新增模式调 `projectsApi.add(payload)`；编辑模式调 `projectsApi.update(payload.id, patch)` 并清空 `editingProject`
- `handleCancelEdit()`：清空 `editingProject`

#### 4. ProjectForm.scss — 取消按钮样式

- 新增 `.qn-proj-form__cancel-btn`：与 add-btn 同级排列，灰色边框按钮（`border: 1px solid var(--b3-border-color)`，透明背景，hover 变浅）
- `.qn-proj-form__actions` 编辑模式下两按钮 justify-content: space-between

### 影响范围

- 仅修改 4 个文件，无新增文件
- 无破坏性变更，向后完全兼容
- 不涉及注册链（i18n 键已存在、图标已注册）