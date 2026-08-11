---
name: quickNote-show-completed-projects
overview: 修复 quickNote 项目跟进 Tab 中"已完成"状态项目被 activeProjects 过滤而完全不显示的问题，改为全部项目均展示、未完成在前已完成在后，靠状态徽章区分。
todos:
  - id: update-visible-projects-composable
    content: 修改 useProjects.ts：activeProjects 改为显示全部项目的 visibleProjects（未完成在前、已完成在后，组内按 updatedAt 倒序）
    status: completed
  - id: sync-index-references
    content: 同步 index.vue 中 activeProjects 的 3 处引用为 visibleProjects，保持项目 Tab 渲染一致
    status: completed
    dependencies:
      - update-visible-projects-composable
---

## 需求概述

quickNote 插件"项目跟进"Tab 中，状态为「已完成」的项目完全不显示（被 `activeProjects` 的 `status !== "completed"` 过滤），导致新增后无感知。用户要求已完成项目也出现在列表中，通过与进行中/卡住项目不同的状态徽章（绿色"已完成"）进行区分即可。

## 核心功能

- 项目列表展示**全部**项目：进行中、卡住、已完成均显示，不再过滤
- 排序规则：未完成（进行中/卡住）排在前、已完成排在后，各组内部按更新时间倒序
- 状态区分：沿用现有 ProjectItem 组件的状态徽章（completed 为绿色"已完成"标签），无需改组件
- 空态逻辑：仅当项目列表真正为空时显示"暂无项目"空态

## 技术栈

沿用现有技术栈：Vue 3 + TypeScript + composable 模式（`useProjects.ts`），无新增依赖、无 i18n 改动、无样式改动。

## 实现方案

### 核心修改：useProjects.ts 的列表 computed

将 `activeProjects` 更名为 `visibleProjects`（语义从"未完成列表"变为"可见项目列表"），取消 completed 过滤，改为**分组排序**：未完成在前、已完成沉底，组内按 `updatedAt` 倒序。排序在副本上执行（`[...projects.value]` 后 sort），避免原地修改响应式数组。

关键代码：

```ts
/** 可见项目列表（全部显示）：未完成在前、已完成排后，组内按更新时间倒序 */
const visibleProjects = computed(() =>
  [...projects.value].sort((a, b) => {
    if ((a.status === "completed") !== (b.status === "completed")) {
      return a.status === "completed" ? 1 : -1
    }
    return b.updatedAt - a.updatedAt
  }),
)
```

### 同步引用：index.vue

项目 Tab 的 3 处引用（空态判断 `v-if`、列表渲染 `v-for`、取用 `projectsApi.activeProjects`）同步改为 `visibleProjects`。

## 实现注意

- **不动 `blockedProjects`**：它仅服务顶部 TodayFocus 聚焦区（index.vue:109 / TodayFocus.vue:51），语义独立，本次不改
- **不动 ProjectItem.vue**：状态徽章已由 `STATUS_META` 渲染（completed → 绿色"已完成"），天然可区分
- **保留 ProjectForm.vue 的 status 重置修复**（新增后重置为 active），防止用户选过"已完成"后新增项目默认 completed 的泄漏隐患
- **空态回归**：改后 `visibleProjects.length === 0` 仅在项目真正为空时成立，行为正确
- 不改名 `projects`（原始全量 ref 仍被复盘/待办关联引用），避免误伤其他功能

## 架构设计

数据流不变：`projects.value`（全量 ref）→ `visibleProjects`（派生排序视图）→ index.vue 项目 Tab 渲染。改动仅限派生层，存储层、组件层零侵入，风险面小。

## 目录结构

```
src/features/quickNote/
├── composables/
│   └── useProjects.ts   # [MODIFY] activeProjects → visibleProjects：取消 completed 过滤，改为分组排序（未完成在前/已完成在后，组内按 updatedAt 倒序）
└── index.vue            # [MODIFY] 3 处 activeProjects 引用改为 visibleProjects（空态判断/列表渲染/取用）
```