---
name: gitpush-stats-performance-optimization
overview: 优化统计视图加载性能：移除切换到 stats 视图时不必要的重量级 git 操作（commitLog/branches/stash），只加载统计面板实际需要的最小数据（pushStatus + workingTree）。
todos:
  - id: optimize-stats-watch
    content: 精简 index.vue 中 stats 视图 watch 回调：移除 loadCommitLog/loadBranches/loadStashList 三个无效 git 调用，修正缓存判断条件和注释
    status: completed
  - id: verify-build
    content: 运行 pnpm vite build 确认构建零错误
    status: completed
    dependencies:
      - optimize-stats-watch
---

## 用户需求

优化 GitPush 统计视图（StatsPanel）在 50+ 项目场景下的加载性能，解决切换到统计视图时卡顿和加载慢的问题。

## 优化目标

将 stats watch 中每个项目需要执行的 git 命令从 **5 个**（commitLog + branches + stashList + pushStatus + workingTree）减少到 **2 个**（pushStatus + workingTree），并在已有缓存时完全跳过。预期将加载时间从 ~30-60 秒降低到 ~5-10 秒。

## 技术栈

- Vue 3 + TypeScript
- Sass/SCSS
- Git shell 子进程（通过思源插件管理器调用）

## 实现方案

### 根因分析

`src/features/gitPush/index.vue` 第 1254-1268 行的 `watch(currentView)` 回调在切换到 stats 视图时，对每个未缓存项目批量执行 5 个 git shell 命令：

- `loadCommitLog`：执行 `git log`（最重）
- `loadBranches`：执行 `git branch`
- `loadStashList`：执行 `git stash list`
- `loadPushStatus`：执行 `git rev-list --left-right`
- `loadWorkingTree`：执行 `git status --porcelain`

前三个命令对统计视图完全无用（统计面板已移除 recentCommits 栏位，不显示 commits/branches/stash）。50 个项目、每批 3 个并发、每个 3-5 个 git 进程 = 约 13 批次 × 多次 fork = **150+ 次 shell 执行**。

### 优化策略（方案 A：精简 stats watch 数据加载）

**修改 `index.vue` 第 1254-1268 行 watch 回调**：

1. **移除无用加载**：去掉 `loadCommitLog(p.id)`、`loadBranches(p.id)`、`loadStashList(p.id)` 三个调用
2. **优化缓存判断**：将 `pending` 过滤条件从 `!commitLogs.value[p.id]` 改为 `!pushStatuses.value[p.id] || !workingTrees.value[p.id]`，更精确地判断哪些项目真的缺少 stats 所需数据
3. **更新注释**：注释从"统计视图需要 recentCommits/branches"更正为"统计视图仅需 pushStatus + workingTree"

**修改前**（当前代码）：

```ts
watch(currentView, async (view) => {
  if (view !== "stats") return
  const pending = projects.value.filter(p => !commitLogs.value[p.id])
  if (pending.length === 0) return
  await batchProcess(pending, 3, async (p) => {
    await Promise.all([
      workingTrees.value[p.id] ? Promise.resolve() : loadWorkingTree(p.id, true),
      pushStatuses.value[p.id] ? Promise.resolve() : loadPushStatus(p.id),
      loadCommitLog(p.id),
      loadBranches(p.id),
      loadStashList(p.id),
    ])
  })
})
```

**修改后**：

```ts
watch(currentView, async (view) => {
  if (view !== "stats") return
  const pending = projects.value.filter(p => !pushStatuses.value[p.id] || !workingTrees.value[p.id])
  if (pending.length === 0) return
  await batchProcess(pending, 3, async (p) => {
    await Promise.all([
      pushStatuses.value[p.id] ? Promise.resolve() : loadPushStatus(p.id),
      workingTrees.value[p.id] ? Promise.resolve() : loadWorkingTree(p.id, true),
    ])
  })
})
```

### 优化收益

| 指标 | 优化前 | 优化后 |
| --- | --- | --- |
| git 命令数/未缓存项目 | 5 | 2 |
| 首次 stats 视图加载 (50 项目) | 150+ 次 shell 执行 | ~50-60 次 shell 执行 |
| 已缓存时 | 仍需执行 commitLog+branches+stashList (3 个) | **完全跳过**（2 个都已有缓存） |
| 再次切换到 stats | 同上 | 即时显示（pushStatuses/workingTrees 都已缓存） |


### 兼容性说明

- 不影响列表视图任何功能（列表视图的 commitLog/branches/stash 通过 `handleExpand` 按需懒加载）
- 不影响 stats 视图渲染数据（StatsPanel 只消费 pushStatusStats、needsPushProjects、uncommittedProjects、platformStatusProjects，全部来源于 pushStatuses + workingTrees + projects）
- 不改变任何 props 接口或组件 API

## 实现细节

### 修改文件

仅修改 1 个文件：

- `src/features/gitPush/index.vue`：第 1252-1268 行 watch 回调优化

### 验证方法

1. `pnpm vite build` 确认构建通过
2. 在 50+ 项目环境下切换到统计视图，观察加载时间应显著缩短
3. 确认统计视图各数据栏（总览卡片、远程覆盖率、推送状态分布、平台配置状态、待处理项目）均正常显示