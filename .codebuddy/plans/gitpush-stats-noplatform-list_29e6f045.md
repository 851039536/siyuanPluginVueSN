---
name: gitpush-stats-noplatform-list
overview: 在 gitPush 统计视图中新增"未设置平台的项目"列表，并为所有表格列表添加固定高度+滚动优化，整体 UI 布局优化。
todos:
  - id: add-no-platform-computed
    content: 在 useGitPush.ts 新增 noPlatformProjects computed 并加入 return 解构
    status: completed
  - id: wire-prop-in-index
    content: 在 index.vue 解构 noPlatformProjects 并传递给 StatsPanel
    status: completed
    dependencies:
      - add-no-platform-computed
  - id: add-section-and-scroll
    content: 在 StatsPanel.vue 新增"未设置平台"区块模板，并为所有表格容器添加固定高度可滚动样式
    status: completed
    dependencies:
      - wire-prop-in-index
---

## 用户需求

在统计视图中新增"未设置平台的项目"列表，优化所有列表为固定高度可滚动，并优化 UI 布局。

## 核心功能

- 新增"未设置平台的项目"区块：展示所有 githubUrl、giteeUrl、giteaUrl 均为空的项目，含项目名称、所属分类、添加时间
- 列表固定高度优化：为所有表格容器添加固定高度限制（220px），超出内容可纵向滚动
- UI 布局微调：保持现有设计风格一致性

## 技术方案

### 实现策略

基于现有 StatsPanel 的 props 驱动 + computed 数据流模式，新增 `noPlatformProjects` computed 并传递到 StatsPanel，复用现有表格样式并增加滚动容器。

### 修改文件（3 个）

1. **useGitPush.ts** — 新增 `noPlatformProjects` computed

- 过滤条件：`projects.filter(p => !p.githubUrl && !p.giteeUrl && !p.giteaUrl)`
- 置于 `uncommittedProjects` 之后，`recentCommits` 之前
- 加入 return 解构对象（统计视图数据区）

2. **StatsPanel.vue** — 新增区块 + 列表滚动优化

- 新增 prop：`noPlatformProjects: GitProject[]`
- 新增区块模板：在推送状态分布区块之后插入（与 noRemote 统计自然关联），使用现有表格样式
- 表头：项目名称 | 分类 | 添加时间
- 列表滚动：`.gp-table-wrap` 添加 `max-height: 220px; overflow-y: auto`
- 空状态：无数据时隐藏整个区块（v-if 控制）

3. **index.vue** — 数据流通

- 从 useGitPush 解构 `noPlatformProjects`
- StatsPanel 组件添加 `:no-platform-projects="noPlatformProjects"` prop

### 数据流

```
GitPushStorage.projects (持久化)
  → useGitPush.projects (ref)
    → noPlatformProjects (computed: filter)
      → index.vue (:no-platform-projects)
        → StatsPanel (props.noPlatformProjects)
          → 模板渲染 v-for
```
