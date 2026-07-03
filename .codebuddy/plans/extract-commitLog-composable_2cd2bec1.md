---
name: extract-commitLog-composable
overview: 将 index.vue 中 commitLog 相关逻辑提取为独立 composable `useCommitLog.ts`，减少 index.vue 约 30 行代码。
todos:
  - id: create-composable
    content: 新建 useCommitLog.ts composable 文件，封装 commitLogLoading、expandedProjects、commitLogForProject、handleExpand、handleReloadCommitLog
    status: completed
  - id: update-index-vue
    content: 修改 index.vue：新增 import useCommitLog 并调用；删除已提取的 5 段代码；移除不再需要的 CommitLogEntry 类型导入（如无其他引用）
    status: completed
    dependencies:
      - create-composable
  - id: verify-lint
    content: 执行 pnpm lint + pnpm i18n:verify + npx tsc --noEmit 验证编译和规范通过
    status: completed
    dependencies:
      - update-index-vue
---

## 用户需求

将 index.vue 中 commitLog 相关的状态管理和事件处理逻辑提取到独立的 composable 文件 `useCommitLog.ts` 中，以缩减 index.vue 的代码量（当前 1317行），遵循现有 composable 模式。

## 提取范围

- `commitLogLoading` ref — 提交日志加载状态（Record<string, boolean>）
- `expandedProjects` ref — 已展开过的项目集合（Set<string>），内部使用不对外暴露
- `commitLogForProject()` — 从 commitLogs 响应式 map 取值并返回
- `handleExpand()` — 面板首次展开时并行加载 commitLog + branches + stash + tags
- `handleReloadCommitLog()` — 用户修改提交记录显示条数时重新加载

## 约束

- index.vue 模板中的引用（`:commit-log-loading`、`:commit-log-for-project`、`@expand`、`@reload-commit-log`）保持不变
- 不修改 BranchCommitList.vue、WorkingTreePanel.vue、ProjectCard.vue 任何代码
- 遵循现有 composable 工厂函数 + 依赖注入模式

## 技术方案

### 实现策略

遵循项目现有 composable 模式（如 `useProjectCrud`、`useIdeManagement` 等）：导出工厂函数，通过参数注入外部依赖，返回响应式 refs 和函数。

### 新建文件：`src/features/gitPush/composables/useCommitLog.ts`

工厂函数签名：

```ts
export function useCommitLog(deps: {
  commitLogs: Ref<Record<string, CommitLogEntry[]>>
  loadCommitLog: (id: string, count?: number) => Promise<void>
  loadBranches: (id: string) => Promise<void>
  loadStashList: (id: string) => Promise<void>
  loadTags: (id: string) => Promise<void>
})
```

返回对象：

- `commitLogLoading: Ref<Record<string, boolean>>` — 外部引用，保持模板绑定不变
- `commitLogForProject: (projectId: string) => CommitLogEntry[]` — 外部引用
- `handleExpand: (projectId: string) => Promise<void>` — 外部引用
- `handleReloadCommitLog: (id: string, count: number) => Promise<void>` — 外部引用

`expandedProjects` 为内部 ref，不对外暴露（仅 handleExpand 内部使用）。

### 修改文件：`src/features/gitPush/index.vue`

1. **新增 import**：`import { useCommitLog } from "./composables/useCommitLog"`（第357行附近）
2. **新增调用**（第472行之后）：解构 `useCommitLog({ commitLogs, loadCommitLog, loadBranches, loadStashList, loadTags })` 获取四个导出成员
3. **删除代码**：

- 第693-696行：`commitLogForProject()` 函数定义
- 第699行：`commitLogLoading` ref 声明
- 第702行：`expandedProjects` ref 声明
- 第704-723行：`handleExpand()` 函数定义
- 第1201-1209行：`handleReloadCommitLog()` 函数定义

4. **不再需要**从 types 导入 `CommitLogEntry`（第319-320行）— 检查是否还有其他位置使用该类型

### 不变部分

- 模板中的 `:commit-log-loading="commitLogLoading"`、`:commit-log-for-project="commitLogForProject"`、`@expand="handleExpand"`、`@reload-commit-log="handleReloadCommitLog"` 完全不变
- `handleCommit`(1195行)、`silentRefreshAll`(746行)、`handleRefresh`(878行) 直接调用 `loadCommitLog()` 的逻辑保持在 index.vue 中不动
- 所有子组件零修改

### 架构一致性

- 与 `useProjectCrud`/`useIdeManagement` 调用模式一致：在 index.vue 调用工厂函数，参数来自 `useGitPush`（已解构的值）
- 不引入任何新架构模式或概念

## 目录结构

```
src/features/gitPush/
├── composables/
│   └── useCommitLog.ts        # [NEW] commitLog 状态与事件处理提纯
└── index.vue                   # [MODIFY] 删除 ~30 行，新增 2 行 import + 4 行调用
```