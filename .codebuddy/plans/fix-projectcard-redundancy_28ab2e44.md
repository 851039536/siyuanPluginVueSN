---
name: fix-projectcard-redundancy
overview: 修复 ProjectCard.vue 中 4 项代码冗余：删除死 emit、减少 getPushStatus 重复调用、hasAnyRemote 替换硬编码、OutputPanel 去重。
todos:
  - id: fix-emit
    content: 修复死 emit：平台按钮改用 $emit 对接父组件，删除本地 handleOpenWeb/handleCopyUrl
    status: completed
  - id: fix-pushstatus-calls
    content: 消除 getPushStatus 7 次重复调用：新增 pushBtnClass/pushBtnText 辅助函数，重构模板
    status: completed
  - id: fix-hasanyremote
    content: 推送全部按钮用 hasAnyRemote(project) 替代硬编码 4 平台检查
    status: completed
  - id: fix-outputpanel-merge
    content: 合并拉取/推送两个 OutputPanel 为 v-for 遍历
    status: completed
  - id: verify-all
    content: 验证：ESLint + tsc --noEmit
    status: completed
    dependencies:
      - fix-emit
      - fix-pushstatus-calls
      - fix-hasanyremote
      - fix-outputpanel-merge
---

## 用户需求

修复 ProjectCard.vue 中审查发现的 4 项代码冗余。

## 修复清单

### 1. 修复死 emit：对接父组件 event 体系

当前 L650-651 的 `handleOpenWeb`/`handleCopyUrl` 直接调用 `window.open`/`navigator.clipboard`，绕过了父组件 `index.vue` L917-940 的丰富实现（Electron `shell.openExternal` + `copyToClipboard` 工具函数 + Toast 提示）。将按钮改为 `$emit("openWeb", url)` / `$emit("copyUrl", url)`，删除本地包装函数。

### 2. 消除 `getPushStatus` 重复调用（7→2 次）

推送按钮模板中 `getPushStatus(project.id, r.key)` 被调用 7 次（:class 3 次 + :disabled/needsPushFor 间接 1 次 + span 三元 3 次）。提取两个辅助函数 `pushBtnClass(status)` 和 `pushBtnText(status, label)`，每个按钮仅调用 2 次。

### 3. 用 `hasAnyRemote(project)` 替代硬编码平台检查

推送全部按钮 disabled 写死 4 个远程平台属性，改用已通过 prop 传入的 `hasAnyRemote(project)`。

### 4. 合并重复的 OutputPanel

拉取/推送输出面板结构完全相同（仅 `:entries` 来源不同），合并为 `v-for` 遍历 computed 列表。

## 技术方案

### 修改范围

仅修改 `src/features/gitPush/components/ProjectCard.vue` 一个文件（4 处模板重构 + 2 处 script 新增/删除）。

### 修复 1：emit 对接父组件

**模板改动**：将 L171-172 的 `@click="handleOpenWeb(...)"` / `@contextmenu.prevent="handleCopyUrl(...)"` 改为 `@click="$emit('openWeb', getProjectUrl(project, pm.urlProp)!)"` / `@contextmenu.prevent="$emit('copyUrl', getProjectUrl(project, pm.urlProp)!)"`。

**script 改动**：

- 删除 L650-651 两个本地函数（各 1 行）
- 保留 L603-604 emit 类型声明不变（现在会被实际使用）

**效果**：父组件 `index.vue` L917-940 的 Electron shell 打开 + 剪贴板 Toast 提示逻辑生效。

### 修复 2：getPushStatus 去重

**script 新增**两个纯函数（在 `<script setup>` 底部，L650 附近）：

```typescript
// 推送按钮状态 class 映射（消除模板中 3 次 getPushStatus 调用）
function pushBtnClass(status: string | undefined): Record<string, boolean> {
  return {
    'gp-action-btn--ok': status === 'ok',
    'gp-action-btn--fail': status === 'fail',
    'gp-action-btn--active': status === 'pushing',
  }
}

// 推送按钮文本映射（消除模板中 3 次三元判断）
function pushBtnText(status: string | undefined, label: string, i18n: Record<string, any>): string {
  if (status === 'pushing') return i18n.pushing || '推送中…'
  if (status === 'ok') return i18n.done || '完成'
  if (status === 'fail') return i18n.failed || '失败'
  return label
}
```

**模板改动**（L460-470）：

- `:class="{...}"` 改为 `:class="pushBtnClass(getPushStatus(project.id, r.key))"`
- `<span>{{ getPushStatus(...) === 'pushing' ? ... : ... }}</span>` 改为 `<span>{{ pushBtnText(getPushStatus(project.id, r.key), r.label, i18n) }}</span>`

**效果**：每个按钮从 7 次调用降为 2 次（:class 1 次 + span 1 次）。

### 修复 3：hasAnyRemote

**模板改动**（L477）：`!project.githubRemote && !project.giteeRemote && !project.giteaRemote && !project.cnbRemote` 改为 `!hasAnyRemote(project)`。

`hasAnyRemote` 已是 props 声明（L581），父组件传入（L170），无需新增导入。

### 修复 4：合并 OutputPanel

**script 新增** computed：

```typescript
const outputPanels = computed(() => [
  { key: 'pull', entries: props.pullOutputs?.[props.project.id], copyText: props.entriesToText?.(props.pullOutputs?.[props.project.id]) },
  { key: 'push', entries: props.pushOutputs?.[props.project.id], copyText: props.entriesToText?.(props.pushOutputs?.[props.project.id]) },
])
```

**模板改动**：L495-509 两个 `<OutputPanel>` 替换为一个 `v-for`：

```html
<OutputPanel
  v-for="panel in outputPanels"
  :key="panel.key"
  :entries="panel.entries"
  :copy-text="panel.copyText"
  :i18n="i18n"
  @copy="$emit('copyOutput')"
/>
```

**注意**：由于 defineProps 返回的是 props 对象，需要先保存引用。当前方案直接在模板中使用已有的 props 值（`pullOutputs[project.id]` 等），无需新增 computed——直接用 `v-for` 遍历内联列表即可，更简洁。

### 验证

- ESLint：`pnpm lint`
- i18n：`pnpm i18n:verify`（本次无 i18n 变动，跳过）
- tsc：`npx tsc --noEmit`，确认 gitPush 模块零新增错误