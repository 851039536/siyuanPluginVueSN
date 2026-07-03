---
name: gitPush-interaction-fixes
overview: 修复 gitPush 模块 12 个交互逻辑漏洞：覆盖 AbortController 竞态、全局队列误清、编辑弹窗状态同步、乐观更新回滚、拉取指引、批量操作取消、统一 ConfirmDialog、v-html 安全、名称编辑错误处理等。
todos:
  - id: fix-abortcontroller-queue
    content: 修复 GitPushManager.ts 漏洞 1-2：AbortController Map→数组管理、onAbort 队列只过滤关联项
    status: completed
  - id: fix-applyremotes-cleanup
    content: 修复 GitPushManager.ts 漏洞 4/6：applyRemotesToProject 先清空再设置、ff-only 中文错误消息
    status: completed
  - id: fix-optimistic-rollback
    content: 修复 useProjectCrud.ts 漏洞 5：toggleStar/setProjectStatus 加 try-catch 回滚
    status: completed
  - id: fix-edit-sync
    content: 修复 index.vue + EditProjectDialog.vue 漏洞 3/4：@saved 触发 loadProjects、远程操作后 refreshRemotes
    status: completed
  - id: fix-confirm-replace
    content: 修复 index.vue 漏洞 7/8/10/11：6 处 confirm→ConfirmDialog、批量取消按钮、名称编辑错误处理
    status: completed
  - id: fix-v-html-slot
    content: 修复 ConfirmDialog.vue + index.vue 漏洞 9：v-html→具名 slot、message 改用模板
    status: completed
  - id: verify
    content: 验证：pnpm lint + npx tsc --noEmit
    status: completed
    dependencies:
      - fix-abortcontroller-queue
      - fix-applyremotes-cleanup
      - fix-optimistic-rollback
      - fix-edit-sync
      - fix-confirm-replace
      - fix-v-html-slot
---

## 用户需求

修复 gitPush 模块 12 个交互逻辑漏洞，包括 6 个高严重度、5 个中严重度、1 个低严重度问题。

## 修复范围

### 高严重度（6 项）

- **AbortController 覆盖竞态**：`remoteOpAll`/`remoteOpSingle` 同项目 ID 覆盖 AbortController，导致前者无法取消且 finally delete 误删后者
- **abort 清空全局队列**：`onAbort` 中 `gitWaitQueue.filter(()=>false)` 取消项目 A 时误伤项目 B 排队操作
- **编辑后不刷新**：EditProjectDialog `@saved` 仅关闭弹窗，未同步响应式状态，修改不生效直到手动刷新
- **远程增删不同步**：增删改远程仓库后未调 `updateProjectMeta` 同步持久化字段；`applyRemotesToProject` 不清理已删除的远程
- **乐观更新无回滚**：`toggleStar`/`setProjectStatus` 先改本地再写存储，失败不回滚
- **ff-only 无指引**：分叉时静默失败，未提示用户如何解决冲突

### 中严重度（5 项）

- **原生 confirm 混用**：6 处破坏性操作用 `window.confirm()` 而非 ConfirmDialog 组件
- **批量推送无取消**：`pushingAllProjects` 缺少 UI 入口切换为 false
- **v-html XSS 隐患**：ConfirmDialog 用 `v-html` 渲染 message prop
- **名称编辑无错误处理**：`handleNameEditSave` 失败时 `editingNameId` 不重置

### 低严重度（1 项）

- **空值静默放弃**：清空名称后失焦无提示

## 技术栈

- TypeScript + Vue 3 (Composition API)
- 思源笔记插件框架 (`siyuan` 模块的 `showMessage`)
- 已有 mixin 体系：`focus-ring` / `text-ellipsis` / `gp-label-base`

## 实现方案

### 漏洞 1-2：AbortController 竞态 + 全局队列误清

- **GitPushManager.ts L68**：`abortControllers: Map<string, AbortController>` → `Map<string, AbortController[]>` 维护数组，`set` 改为 `push`，`delete` 改为过滤
- **L440-441**：`this.abortControllers.set(id, ac)` → `push`；**L500**：`delete(id)` → `filter` 移除当前 ac
- **L538-548**：同理 remoteOpSingle 的 set/delete
- **L555-560**：`cancelOp` 遍历同 ID 下所有 AbortController 调用 abort
- **L1014**：`filter(()=>false)` → 改为 `filter` 只移除与当前 signal 关联的排队项（需要队列项关联 signal）

### 漏洞 3：编辑后刷新

- **index.vue L828-829**：`@saved="editDialogProjectId = ''"` → 增加 `"handleEditSaved(editDialogProjectId)"`，调用 `loadProjects()` 或 `refreshRemotes()` 同步状态

### 漏洞 4：远程增删同步

- **EditProjectDialog.vue L495-530**：handleAddRemote/handleRemoveRemote/saveRemoteEdit 成功后，在 `loadRemotes()` 后追加 `props.manager.refreshRemotes(props.projectId)` 同步持久化
- **GitPushManager.ts L108-120**：`applyRemotesToProject` 在赋值循环前，先手动清空四个平台的 remote/url 字段（`project.githubRemote = undefined` 等），再根据检测结果重新设置

### 漏洞 5：乐观更新回滚

- **useProjectCrud.ts L64-75**：`toggleStar`/`setProjectStatus` 包裹 try-catch，失败时用 `patchProject` 回滚原始值

### 漏洞 6：ff-only 错误指引

- **GitPushManager.ts L354**：保持 `--ff-only` 不变，在 `tryExec` 的 catch 中检测特定错误关键词（`Not possible to fast-forward` / `fatal:`），拼入更易理解的中文错误消息

### 漏洞 7：原生 confirm 替换

- **index.vue** 6 处 `confirm()` 调用统一改用 `<ConfirmDialog>` 组件，每处增加对应的 ref 状态变量和确认/取消回调

### 漏洞 8：批量推送取消按钮

- **index.vue** 的 PanelHeader（或筛选工具栏区域）增加「取消全部推送」按钮，`v-if="pushingAllProjects"`，点击执行 `pushingAllProjects = false`

### 漏洞 9：v-html → slot

- **ConfirmDialog.vue L15**：移除 `v-html="message"`，改用 `<slot name="message"><p>{{ message }}</p></slot>` 提供默认纯文本渲染
- **index.vue L791**：从 `:message="'将从 <strong>' + pendingPullLabel + '</strong> 拉取...'"` 改为 `<template #message>将从 <strong>{{ pendingPullLabel }}</strong> 拉取...</template>`

### 漏洞 10：名称编辑错误处理

- **index.vue L1467-1473**：包裹 try-catch，失败调用 `showMessage`；`editingNameId = ''` 移入 finally

### 漏洞 11：空值静默放弃

- **index.vue L1469**：`if (!newName)` 分支增加 `showMessage("项目名称不能为空", 2000, "warning")`

## 架构要点

- 所有破坏性操作必须经过确认弹窗（ConfirmDialog）
- AbortController 改为数组管理确保幂等取消
- 远程操作完成必须同步持久化状态
- 乐观更新必须包含失败回滚路径