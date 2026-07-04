---
name: gitPush 刷新性能优化与代码冗余清理
overview: 针对 gitPush 模块卡片刷新耗时问题，从三个维度优化：(1) 减少 git 子进程调用数量（合并重复的 rev-parse、静默刷新跳过 update-index --refresh）；(2) 减少持久化存储重复读取（Manager 层增加项目内存缓存）；(3) ProjectCard 重渲染优化（拆分 Record props 为单项目数据）。同时清理 6 处代码冗余（重复注释、重复函数、死代码）。
todos:
  - id: manager-cache
    content: GitPushManager 新增项目内存缓存：getProjectById + invalidateProjectCache，替换全部 getProjects().find() 调用
    status: completed
  - id: merge-revparse
    content: useGitOps 新增 loadProjectGitStatus 合并 rev-parse HEAD，silentRefreshAll/onMounted/watch 切换调用
    status: completed
    dependencies:
      - manager-cache
  - id: parallel-refresh
    content: handleRefresh 并行化六项加载，silentRefreshAll HEAD 未变时传 skipRefresh=true
    status: completed
    dependencies:
      - merge-revparse
  - id: card-props-split
    content: ProjectCard 拆分 Record props 为单项目值，减少全量 re-render
    status: completed
    dependencies:
      - parallel-refresh
  - id: dedup-ops
    content: useGitOps 提取 remoteOpAll/remoteOpSingle/isOpInProgress 通用函数，消除 push/pull 重复代码，清理死代码
    status: completed
    dependencies:
      - card-props-split
  - id: cleanup-misc
    content: 清理重复注释、resolveValidPath 复用、移除 handleCardClick 空函数
    status: completed
    dependencies:
      - dedup-ops
---

## 用户需求

用户反映 gitPush 模块的 `ProjectCard.vue` 卡片每次刷新加载 git 状态时非常耗时，要求给出优化方案，并审查代码冗余。

## 产品概述

gitPush 是思源笔记插件中的 Git 多仓库管理模块。主面板 `index.vue` 按分类渲染多个 `ProjectCard` 卡片，每张卡片需要加载推送状态、工作区变更、分支、提交日志、Stash、Tag 等 git 信息。当前实现存在多个性能瓶颈和代码冗余。

## 核心问题

### 性能瓶颈（5 项）

1. **Manager 层反复反序列化全部项目**：`checkPushStatus`、`fetchAllForProject`、`remoteOpAll`、`remoteOpSingle`、`refreshRemotes` 每次都调 `getProjects()` 从存储层重新加载全部项目 JSON 再 `.find()`，N 个项目刷新时触发 N 次全量反序列化
2. **重复 `rev-parse --abbrev-ref HEAD` 调用**：`checkPushStatus` 和 `getWorkingTreeStatus` 各自调一次获取分支名，同一项目刷新时执行两次相同命令
3. **`silentRefreshAll` 未跳过 `update-index --refresh`**：HEAD 未变时仍执行 `loadWorkingTree(id)`（不带 `skipRefresh=true`），对大仓库是显著性能损耗（首屏 `onMounted` 已用 `skipRefresh=true`）
4. **`handleRefresh` 串行两批加载**：第一批 `refreshRemotes + loadPushStatus(fetchFirst)` 与第二批 `loadWorkingTree + loadCommitLog + loadBranches + loadStashList` 之间无数据依赖，却串行等待
5. **ProjectCard 接收整个 Record 作为 props**：`:push-statuses="pushStatuses"` 传递全量字典，任一项目状态变更触发所有卡片 re-render

### 代码冗余（6 项）

1. **重复文件头注释**：`useGitPush.ts`（3 行）、`useGitOps.ts`（3 行）、`useProjectCrud.ts`（2 行）
2. **push/pull 函数重复**：`pushToAll`/`pullToAll` 结构完全相同（60 行），`pushSingle`/`pullSingle` 结构完全相同（44 行）
3. **`isPushing`/`isPulling` 逻辑完全一致**
4. **死代码**：`getPullStatus`、`pullToAll`、`pullProgress` ref 已导出但 UI 从未使用
5. **路径检测逻辑重复**：`resolveValidPath` 与 `resolveValidPathWithSource` 重复遍历路径列表
6. **`handleCardClick` 空函数**：刷新逻辑已被注释，函数体仅做防抖检查后什么都不干

## 技术栈

- Vue 3 + TypeScript + Vite（思源笔记插件）
- child_process.execFile 执行 git 命令（信号量限流，默认并发 3）
- TypedStorage 持久化项目数据
- SCSS 分离 + Codex UI 风格

## 实现方案

### 优化 1：Manager 层项目内存缓存

在 `GitPushManager` 中增加 `private projectCache: Map<string, GitProject>` 和 `private projectsCache: GitProject[] | null`，新增 `getProjectById(id)` 方法优先读缓存。所有写操作（`addProject`/`removeProject`/`updateProjectMeta`/`refreshRemotes`/`toggleStar`/`setProjectStatus`/`appendTag`/`removeTag`/`recordLastActivity`/`moveProject`/`deleteCategory`）后调 `invalidateProjectCache()` 清空缓存。`checkPushStatus`/`fetchAllForProject`/`remoteOpAll`/`remoteOpSingle`/`refreshRemotes` 改用 `getProjectById(id)` 替代 `getProjects().find()`。

- **复杂度**：O(1) 缓存命中 vs O(N) 全量反序列化 + 遍历
- **瓶颈**：首次加载仍需一次全量读取，后续命中缓存零 I/O
- **缓存一致性**：写操作同步失效缓存，读时若缓存为空则从存储加载并填充

### 优化 2：合并 `rev-parse HEAD` 调用

在 `useGitOps` 中新增 `loadProjectGitStatus(id)` 方法，先调一次 `manager.getBranch(cwd)` 获取 branch，再将 branch 传给 `checkPushStatus(id, { branch })` 和 `getWorkingTreeStatus(cwd, { branch, skipRefresh })`。两个方法均已支持 `opts.branch` 参数。

`silentRefreshAll`、`handleRefresh`、`onMounted`、`watch(activeCategory)` 中的 `loadPushStatus + loadWorkingTree` 并行调用改为 `loadProjectGitStatus`。

### 优化 3：`silentRefreshAll` 跳过 `update-index --refresh`

`silentRefreshAll` 中 HEAD 未变分支的 `loadWorkingTree(p.id)` 改为 `loadWorkingTree(p.id, true)`。首屏 `onMounted` 已使用此模式（L717），`silentRefreshAll` 应保持一致。仅当 HEAD 变化时（需要完整刷新）才执行带 `update-index --refresh` 的 `loadWorkingTree(id)`。

### 优化 4：`handleRefresh` 并行化

将当前串行两批改为：先获取 branch，再并行执行全部 6 个操作（`refreshRemotes` + `loadPushStatus({ fetchFirst: true, branch })` + `loadWorkingTree(id, false, branch)` + `loadCommitLog` + `loadBranches` + `loadStashList`）。`refreshRemotes` 不依赖 branch，可与其他操作并行。

### 优化 5：ProjectCard 拆分 Record props

`index.vue` 中将 `:push-statuses="pushStatuses"` 改为 `:push-status="pushStatuses[project.id]"`，同理处理 `workingTrees`/`branches`/`stashEntries`/`conflicts`/`commitOutputs`/`pullOutputs`/`pushOutputs`/`committing`/`generatingMsgs`/`gitOpLoading`/`commitLogLoading`/`tagsCache`/`tagLoading`/`tagPushLoading`/`stashLoading`/`genStashDescLoading`。ProjectCard props 类型从 `Record<string, any>` 改为 `any`（单项目数据）。

- **效果**：项目 A 的 pushStatus 更新不再触发项目 B 的 ProjectCard re-render，因为 props 引用未变
- **注意**：`fileDiffsForProject` 和 `commitLogForProject` 函数也需改为直接传值

### 冗余清理 1：重复注释

- `useGitPush.ts` L1-3 → 保留 1 行
- `useGitOps.ts` L1-3 → 保留 1 行
- `useProjectCrud.ts` L1-2 → 保留 1 行

### 冗余清理 2：合并 push/pull 重复函数

在 `useGitOps` 中提取：

- `remoteOpAll(id, action, progressRef, outputsRef, managerFn)` 通用函数
- `remoteOpSingle(id, target, action, progressRef, outputsRef, managerFn)` 通用函数
- `pushToAll`/`pullToAll`/`pushSingle`/`pullSingle` 变为单行委托调用

### 冗余清理 3：合并 isPushing/isPulling

提取 `isOpInProgress(progressRef, projectId, target?)` 通用函数，`isPushing`/`isPulling` 变为单行委托。

### 冗余清理 4：resolveValidPath 复用

`resolveValidPath` 改为 `return resolveValidPathWithSource(project).path`，消除重复的路径遍历逻辑。

### 冗余清理 5：清理死代码

- 移除 `getPullStatus`（useGitPush 未导出、UI 未使用）
- 移除 `pullToAll`（index.vue 未使用，`pullSingle` 保留）
- 移除 `pullProgress` ref（仅 `pullToAll` 使用）
- 从 `useGitPush` 返回对象中移除对应导出

### 冗余清理 6：handleCardClick 清理

移除空的 `handleCardClick` 函数及 `@card-click` 事件绑定（含 ProjectCard 中的 `@click="$emit('cardClick', ...)"`）。IDE 菜单关闭逻辑已由 `closeIdeMenuOnOutside` 全局点击监听覆盖。

## 实现注意事项

- **缓存失效一致性**：所有修改项目数据的写操作必须调 `invalidateProjectCache()`，否则会读到过期数据。特别注意 `recordLastActivity`（L250-256）在 `loadCommitLog` 中被异步调用
- **并发安全**：`loadProjectGitStatus` 中 `getBranch` 必须在 `checkPushStatus`/`getWorkingTreeStatus` 之前完成（await），不能并行
- **`handleRefresh` 的 `fetchFirst`**：`refreshRemotes` 内部调 `detectRemotes`（`git remote -v`），与 `loadPushStatus({ fetchFirst: true })` 中的 `fetch` 并行无冲突
- **Record props 拆分后**：`pushStatuses[project.id]` 可能为 `undefined`，ProjectCard 模板中需用 `?.` 或 `|| {}` 兜底（当前模板已有 `v-if` 守卫）
- **死代码移除**：`pullToAll` 虽然从 UI 未调用，但属于 `useGitPush` 公共 API，移除需同步从 `useGitPush` 返回对象和 index.vue 中删除引用（如有）
- **不擅自构建运行**：修改完成后由用户自行 `pnpm lint && npx tsc --noEmit` 验证

## 架构设计

```mermaid
graph TD
    subgraph "优化前调用链（每项目刷新）"
        A1[checkPushStatus] --> B1[getProjects 反序列化全部]
        A1 --> C1[rev-parse HEAD]
        A2[getWorkingTreeStatus] --> B2[rev-parse HEAD 重复]
        A2 --> D1[update-index --refresh]
    end

    subgraph "优化后调用链"
        E1[loadProjectGitStatus] --> F1[getBranch 一次]
        E1 --> F2[checkPushStatus branch=...]
        E1 --> F3[getWorkingTreeStatus branch=... skipRefresh]
        F2 --> G1[getProjectById 缓存命中]
        F3 --> G1
        G1 -.-> H1[内存缓存 Map O1]
    end

    style B1 fill:#f88
        style C1 fill:#fc8
        style D1 fill:#f88
        style F1 fill #8f8
        style G1 fill #8f8
        style H1 fill #8cf
</parameter>
```

## 目录结构

```
src/features/gitPush/
├── GitPushManager.ts          # [MODIFY] 新增 projectCache + getProjectById + invalidateProjectCache；checkPushStatus/fetchAllForProject/remoteOpAll/remoteOpSingle/refreshRemotes 改用 getProjectById
├── utils.ts                   # [MODIFY] resolveValidPath 复用 resolveValidPathWithSource
├── composables/
│   ├── useGitPush.ts          # [MODIFY] 去重复注释；移除 pullToAll/pullProgress/getPullStatus 导出
│   ├── useGitOps.ts           # [MODIFY] 去重复注释；提取 remoteOpAll/remoteOpSingle/isOpInProgress 通用函数；新增 loadProjectGitStatus；移除 getPullStatus/pullToAll/pullProgress
│   └── useProjectCrud.ts      # [MODIFY] 去重复注释
├── index.vue                  # [MODIFY] handleRefresh 并行化；silentRefreshAll 跳过 update-index；onMounted/watch 用 loadProjectGitStatus；拆分 Record props 为单项目值；移除 handleCardClick
└── components/
    └── ProjectCard.vue         # [MODIFY] Props 类型从 Record<string,any> 改为单项目 any；移除 @cardClick emit
```