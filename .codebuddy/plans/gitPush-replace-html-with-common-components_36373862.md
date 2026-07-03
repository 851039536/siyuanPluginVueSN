---
name: gitPush-replace-html-with-common-components
overview: 将 gitPush 模块中的原生 HTML 表单元素（`<input>`、`<select>`、`<label>`）替换为 `src/components/` 公共组件（Input、Select、Label），并清理替换后不再使用的样式。
todos:
  - id: replace-searchbox
    content: 替换 SearchBox.vue：将原生 input 替换为 Input 组件（prefixIcon + clearable）
    status: completed
  - id: replace-dialog-inputs
    content: 替换弹窗组件中的原生 input/textarea/select：AddProjectDialog、EditProjectDialog、CategoryDialog、SettingsDialog、IdeManagementDialog、ScanImportDialog、RemoteConfigDialog
    status: completed
  - id: replace-sub-inputs
    content: 替换 TagPanel.vue 和 StashSection.vue 中的迷你 input 为 Input(size="small")
    status: completed
  - id: cleanup-styles
    content: 清理 SCSS 样式：删除 SearchBox.scss 全部内容、精简 Form.scss 中不再使用的 .gp-input/.gp-select/.gp-label
    status: completed
    dependencies:
      - replace-dialog-inputs
      - replace-sub-inputs
      - replace-searchbox
  - id: verify-build
    content: 运行 pnpm lint + npx tsc --noEmit 验证零错误
    status: completed
    dependencies:
      - cleanup-styles
---

## 用户需求

使用 `src/components/` 公共组件（Input、Select）替换 gitPush 模块中的原生 HTML 表单元素，并删除替换后不再使用的 SCSS 样式。

## 核心原则

- **按钮不替换**：所有按钮已使用 `vp-btn` 自定义 CSS 类体系，保持不变
- **特殊 input 不替换**：`<input type="checkbox">`、`<input type="radio">`、`<input type="color">` 保留原生元素
- **ProjectCard 行内编辑不替换**：卡片内的分类 `<select>` 和行内名称 `<input>` 尺寸极小且样式特殊，替换收益低于风险，保持原样
- **替换后清理样式**：Input/Select 自带 scoped 样式，替换后需删除 Form.scss 和 SearchBox.scss 中不再使用的类

## 涉及范围

- **组件文件（10 个）**：SearchBox.vue、AddProjectDialog.vue、EditProjectDialog.vue、CategoryDialog.vue、SettingsDialog.vue、IdeManagementDialog.vue、ScanImportDialog.vue、RemoteConfigDialog.vue、TagPanel.vue、StashSection.vue
- **样式文件（2 个）**：Form.scss（精简 .gp-input/.gp-select/.gp-label）、SearchBox.scss（大幅精简）
- **不修改**：index.vue、ProjectCard.vue、ListViewToolbar.vue、PanelHeader.vue 等其余组件

## 技术方案

### 1. Input 组件替换策略

- **SearchBox.vue**：`<input class="gp-search-input">` → `<Input prefixIcon="mdi:magnify" clearable size="small">`，Input 组件自带 prefixIcon + clearable + FormField 包裹
- **弹窗表单（AddProjectDialog / EditProjectDialog / CategoryDialog 等）**：`<label class="gp-label">...</label><input class="gp-input" v-model="x">` → `<Input v-model="x" :label="i18n.xxx" size="small">`。Input 组件内置 FormField 包裹层自动渲染 label
- **EditProjectDialog textarea**：`<textarea class="gp-input"  v-model="x" rows="3">` → `<Input type="textarea" v-model="x" :rows="3" size="small">`
- **SettingsDialog number**：`<input type="number" v-model.number="x" min="1" max="10" class="gp-input">` → `<Input type="number" v-model="x" size="small">`
- **TagPanel / StashSection 迷你输入**：`<input class="gp-tag-input">` → `<Input size="small">`，去掉自定义类

### 2. Select 组件替换策略

- Select 使用 options 数组 API：需在 `<script>` 中添加 computed 将原始数据转为 `SelectOption[]` 格式
- AddProjectDialog 分类选择：`<select v-model="catId">` → `<Select v-model="catId" :options="categoryOptions" size="small">`
- EditProjectDialog 状态选择 / IDE 预设选择 / 远程平台选择同理
- Select 的 `modelValue` 支持 `string | number | boolean | null`，与原有 `v-model` 类型兼容

### 3. 布局适配

- Input 组件自动包裹 `<div class="si-input si-input--small">` + `<FormField>`，会对弹窗布局产生轻微影响
- 原 `.gp-form-group` 包裹的 `label + input` 改为单独一个 `<Input label="...">` 后，可移除 `.gp-form-group` 的外层 div
- `.gp-path-row` 需要保留（包含 Input + 目录选择按钮的横向布局）

### 4. 样式清理

- **Form.scss**：`.gp-input` 和 `.gp-select` 在全部替换后可删除；`.gp-label` 需确认是否还有独立使用场景后决定
- **SearchBox.scss**：`.gp-search-wrap`/`.gp-search-icon`/`.gp-search-input`/`.gp-search-clear` 全部由 Input 组件样式替代，整个文件可删除
- **index.scss**：`.gp-card-name-input` 保留（ProjectCard 行内编辑不替换）；其余不变