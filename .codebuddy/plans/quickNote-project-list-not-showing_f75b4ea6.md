---
name: quickNote-project-list-not-showing
overview: 排查 quickNote 模块项目页面新增项目后列表不显示的问题，定位根因并修复。
todos:
  - id: fix-project-form-status-reset
    content: 修复 ProjectForm.vue：新增模式提交后重置 status 为 "active"
    status: completed
  - id: fix-todo-form-priority-reset
    content: 修复 TodoForm.vue：新增模式提交后重置 priority 为 "medium"
    status: completed
  - id: fix-todolist-persist-lock
    content: 修复 useTodoList.ts：为 persist() 添加串行写锁，消除跨 composable 竞态
    status: completed
---

## 问题描述

在 quickNote 模块的"项目跟进"Tab 新增项目后，项目列表不显示（仍为空态），但新项目在"待办"Tab 的项目下拉和"每周复盘"Tab 中均可见。

## 根因分析

### 根因一（主要）：ProjectForm 新增模式 status 不清空

`ProjectForm.vue` 的 `handleSubmit()` 在新增模式下提交后清空了 `name/currentStep/nextStep/blockers`，但**未重置 `status`**。若用户将状态下拉选为"已完成"后点击添加，`status = "completed"` 会泄漏到后续所有新增项目。`activeProjects` computed 过滤 `status !== "completed"`，导致全部新增项目被过滤，列表显示空态。待办/复盘 Tab 使用全量 `projects`，不做 status 过滤，故可见。

### 根因二（同类缺陷）：TodoForm 新增模式 priority 不清空

`TodoForm.vue` 的 `handleSubmit()` 存在相同模式缺陷——新增后不清空 `priority`。用户若先选了"紧急"，后续所有新增待办默认都是"紧急"。

### 根因三：useTodoList.persist() 缺少串行写锁

`useProjects.persist()` 和 `useInspirations.persist()` 均使用 `_saveLock` 串行化写操作，但 `useTodoList.persist()` 没有锁保护。三个 composable 共写同一存储槽 `quick-note-data`，无锁的 TodoList persist 可能与 Projects persist 产生竞态，导致持久化层数据不一致。

## 技术方案

### 修复一：ProjectForm 新增后重置 status

在 `src/features/quickNote/components/project/ProjectForm.vue` 的 `handleSubmit()` 新增模式分支，添加 `status.value = "active"` 重置语句，确保后续新增项目默认恢复为"进行中"状态。

### 修复二：TodoForm 新增后重置 priority

在 `src/features/quickNote/components/todo/TodoForm.vue` 的 `handleSubmit()` 新增模式分支，添加 `priority.value = "medium"` 重置语句，与 `watch(editingTodo, {immediate:true})` 中的默认值保持一致。

### 修复三：useTodoList.persist() 添加串行写锁

参照 `useProjects.ts` 第 23-41 行的 `_saveLock` 模式，为 `useTodoList.ts` 的 `persist()` 添加串行写锁，消除三个 composable 共享同一存储槽时的竞态条件。

## 关键代码修改

### 1. ProjectForm.vue — handleSubmit（第 152-158 行附近）

在 `if (!props.editingProject)` 块内，`blockers.value = ""` 之后增加 `status.value = "active"`。

### 2. TodoForm.vue — handleSubmit（第 188-193 行附近）

在 `if (!props.editingTodo)` 块内，`projectId.value = ""` 之后增加 `priority.value = "medium"`。

### 3. useTodoList.ts — persist（第 48-52 行）

- 在 `persist` 声明之前添加 `_saveLock` 串行锁变量
- 将 `persist` 改写为链式 `_saveLock.then()` 模式，与 `useProjects.persist()` 和 `useInspirations.persist()` 保持一致
- `persist` 内部新增 `await _saveLock` 确保写入完成后才返回