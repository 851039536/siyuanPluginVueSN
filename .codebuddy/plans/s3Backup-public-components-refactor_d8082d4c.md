---
name: s3Backup-public-components-refactor
overview: 将 s3Backup 功能中的原生 HTML 表单元素替换为 src/components 公共组件（Button/Input/Select/Switch），并删除相关未使用的自定义样式。
todos:
  - id: replace-index-vue-buttons
    content: 替换 index.vue 中所有原生 button 为 Button 组件
    status: completed
  - id: replace-index-vue-inputs-selects-switches
    content: 替换 index.vue 中所有原生 input/select/checkbox 为 Input/Select/Switch 组件
    status: completed
  - id: replace-s3configform-components
    content: 替换 S3ConfigForm.vue 中所有原生 HTML 表单元素为公共组件
    status: completed
  - id: clean-unused-styles
    content: 删除 index.scss 和 S3ConfigForm.vue 内联样式中未使用的样式规则
    status: completed
    dependencies:
      - replace-index-vue-buttons
      - replace-index-vue-inputs-selects-switches
      - replace-s3configform-components
---

## 用户需求

将 s3Backup 功能模块中的原生 HTML 表单元素替换为 `src/components/` 公共组件，并删除因替换而产生的未使用样式规则。

## 产品概述

s3Backup 是思源笔记的 S3 云端备份功能模块，包含主面板 `index.vue` 和 S3 配置表单子组件 `S3ConfigForm.vue`。当前两个 .vue 文件均大量使用原生 HTML 元素（button、input、select、checkbox），需要统一替换为项目已有的公共组件，提升代码一致性与可维护性。

## 核心功能

- **按钮统一化**：将所有原生 `<button>` 替换为 `<Button>` 组件，利用其 variant、size、loading、disabled 等内置能力
- **输入框统一化**：将所有 `<input type="text/password/number/time">` 替换为 `<Input>` 组件，密码字段利用其 `showPassword` 内置切换
- **选择框统一化**：将 `<select>` 替换为 `<Select>` 组件
- **开关替换**：将 `<input type="checkbox">` 替换为 `<Switch>` 组件
- **样式清理**：删除 index.scss 和 S3ConfigForm.vue 内联样式中因替换而不再被引用的样式规则

## 技术栈

- Vue 3 + TypeScript + SCSS
- 公共组件：Button.vue、Input.vue、Select.vue、Switch.vue（均位于 `src/components/`）

## 实现方案

### 替换策略

**按钮替换（Button 组件）**：
原生 `<button class="vp-btn vp-btn--primary vp-btn--sm">` → `<Button variant="primary" size="small">`
原生 `<button class="vp-btn vp-btn--ghost vp-btn--sm">` → `<Button variant="ghost" size="small">`
原生 `<button class="action-btn delete">` → `<Button variant="danger" size="small">`
原生 `<button class="action-btn download">` → `<Button size="small">`
原生 `<button class="s3-backup-close-btn">×</button>` → `<Button variant="ghost" size="small" icon="mdi:close">`

**输入框替换（Input 组件）**：
原生 `<input type="text" class="form-input form-input--sm">` → `<Input v-model="..." size="small" placeholder="...">`
原生 `<input type="password">` + 手动切换按钮 → `<Input v-model="..." type="password" showPassword placeholder="...">`
原生 `<input type="time" class="form-input narrow">` → `<Input v-model="..." type="text" size="small">`
原生 `<input type="number" class="form-input narrow">` → `<Input v-model.number="..." type="number" size="small">`

**选择框替换（Select 组件）**：
原生 `<select class="form-select narrow">` → `<Select v-model="..." :options="[...]" size="small">`
自动备份选项 value 为 boolean，Select 原生支持 `{ value: false, label: "禁用" }`

**开关替换（Switch 组件）**：

- `useDateFolder`（ref）→ `<Switch v-model="useDateFolder" size="small">`
- `backupModeLocal.localZip/s3Upload`（reactive 属性）→ `<Switch :modelValue="backupModeLocal.localZip" @update:modelValue="backupModeLocal.localZip = $event" size="small">`
- `localConfig.pathStyle/useSSL`（reactive 属性）→ 同上 `:modelValue`+`@update:modelValue` 模式

### 样式清理

**index.scss 删除项**（约 200 行）：

- `.s3-backup-close-btn` — Button 组件替代
- `.select-path-btn` + `.open-folder-btn` — Button 组件替代
- `.form-checkbox-label` + `.form-checkbox` — Switch 组件替代（`.form-hint` 保留）
- `.form-input--sm` — Input size="small" 替代
- `.action-btn` 全部变体（download/restore/delete）— Button variant 替代
- `.refresh-btn` — Button 组件替代
- `.form-select.narrow` + `.form-input.narrow` — Select/Input 组件替代
- `.vp-btn` 全部变体（primary/ghost/sm）— Button 组件替代
- `.vp-spin` + `@keyframes vp-spin-rotate` — Button loading 内置 spinner 替代

**保留的样式**：

- `.form-hint`、`.path-preview*`、`.backup-list*`、`.progress-*`、`.info-*`、`.card-section`、`.section-header` 等结构/文本样式
- `.backup-actions-row`、`.settings-row`、`.path-actions`、`.backup-hint`、`.form-label-desc`、`.empty-state` 等布局容器样式

**S3ConfigForm.vue 内联样式删除项**（约 80 行）：

- `.guide-toggle-btn` + `.guide-close-btn` — Button 组件替代
- `.form-input` — Input 组件替代
- `.password-input-wrapper` + `.toggle-password-btn` — Input showPassword 替代
- `.form-checkbox-label` + `.form-checkbox` — Switch 组件替代

### 实现注意事项

1. **reactive 属性绑定**：`backupModeLocal` 和 `localConfig` 是 `reactive()` 对象，Switch 组件的 v-model 绑定的是 ref 的 .value，与 reactive 属性不兼容。需使用 `:modelValue="obj.prop"` + `@update:modelValue="obj.prop = $event"` 显式绑定模式
2. **Select options 格式**：`[{ value: false, label: "禁用" }, { value: true, label: "启用" }]`，value 可以是 boolean
3. **Input 的 change 事件**：公共 Input 组件的 `@change` 绑定于原生 change 事件（blur 时触发），与原有行为一致
4. **保留 Icon import**：S3ConfigForm.vue 中 `<Icon>` 仍在 guide 面板标题中使用，不可删除其 import