---
name: GitPushManager 冗余与性能审查优化
overview: 对 GitPushManager.ts 进行深度审查后，发现 4 项性能瓶颈和 4 项代码冗余。核心优化：checkPushStatus 每远程省 1 个 git 子进程（合并 rev-parse --verify + rev-list --count）、缓存 noUpstream 场景的 HEAD 提交数（多远程省 N-1 次调用）、remoteOpAll build 函数消除 4 次 find 遍历、switchBranch 跳过 update-index --refresh。冗余清理：hasConflict 复用 getConflictFiles、提取 withAbortController 通用方法、checkPushStatus 复用 getBranch、移除 getTags 多余 -n1 参数。
todos:
  - id: perf-checkpush
    content: 合并 checkPushStatus 的 rev-parse --verify + rev-list，缓存 noUpstream 的 HEAD 提交数，复用 getBranch
    status: completed
  - id: perf-remoteop
    content: remoteOpAll build 改单次遍历建 Map，switchBranch 传 skipRefresh
    status: completed
  - id: dedup-abort
    content: 提取 withAbortController 通用方法，remoteOpAll/remoteOpSingle 委托调用
    status: completed
    dependencies:
      - perf-remoteop
  - id: dedup-misc
    content: hasConflict 复用 getConflictFiles，移除 getTags 的 -n1 参数
    status: completed
    dependencies:
      - dedup-abort
---

## 用户需求

审查 `GitPushManager.ts`（1352 行）的冗余和性能问题，给出优化方案。

## 产品概述

`GitPushManager` 是 gitPush 功能模块的底层 Manager 类，封装了项目 CRUD、git 命令执行（信号量限流）、推送/拉取/Fetch、工作区状态、提交日志、分支管理、Stash、Tag、冲突检测、AI 生成提交信息等全部底层逻辑。上一轮已优化了内存缓存和 composable 层，本轮聚焦 Manager 类本身的深度审查。

## 核心问题

### 性能瓶颈（4 项）

1. `checkPushStatus` 每远程 2 次 execGit：先 `rev-parse --verify` 验证远程分支存在，再 `rev-list --count` 计算 ahead/behind，可合并为直接 `rev-list` 失败即 noUpstream
2. `checkPushStatus` noUpstream 分支：多远程同时无 upstream 时重复调用 `rev-list --count HEAD`，可缓存复用
3. `remoteOpAll` 的 `build` 函数 4 次 `results.find()` 遍历，可改为单次遍历建 Map
4. `switchBranch` 调用 `getWorkingTreeStatus` 未传 `skipRefresh`，大仓库 `update-index --refresh` 耗时

### 代码冗余（4 项）

1. `hasConflict` 与 `getConflictFiles` 执行相同 git 命令 `diff --name-only --diff-filter=U`，两次调用
2. `remoteOpAll` 与 `remoteOpSingle` 中 AbortController 注册/清理逻辑重复（约 20 行）
3. `checkPushStatus` 内联 `rev-parse --abbrev-ref HEAD`，与已有的 `getBranch` 方法完全重复
4. `getTags` 的 `-n1` 参数与 `--format` 冲突，`-n1` 被忽略属多余参数

## 技术栈

- TypeScript class（`GitPushManager`），无框架依赖
- `child_process.execFile` 执行 git 命令，信号量限流（默认并发 3）
- `TypedStorage` 持久化项目/分类/标签数据
- 上一轮已新增：`projectCache`/`projectsCache` 内存缓存 + `getProjectById`/`invalidateProjectCache`

## 实现方案

### 优化 1：合并 checkPushStatus 的 rev-parse --verify + rev-list --count

**当前**（L708-726）：每个远程先 `rev-parse --verify remoteName/branch` 验证存在，成功后再 `rev-list --left-right --count remoteName/branch...HEAD` 计算 ahead/behind。两次 execGit。

**优化后**：直接调 `rev-list --left-right --count remoteName/branch...HEAD`。如果远程分支不存在，git 返回非零退出码（"fatal: ambiguous argument"），catch 中走 noUpstream 分支。省去 `rev-parse --verify` 一次子进程。

**效果**：4 个远程省 4 个 git 子进程，显著减少信号量排队等待。

### 优化 2：缓存 noUpstream 场景的 HEAD 提交数

**当前**（L722-724）：每个 noUpstream 远程各自调 `rev-list --count HEAD` 获取本地提交数。

**优化后**：提取 `headCommitCount: number | null = null` 变量，首次 noUpstream 时调用并缓存，后续远程复用。

**效果**：4 个远程都 noUpstream（新项目未 push 场景）省 3 次 execGit。

### 优化 3：remoteOpAll build 函数改为单次遍历

**当前**（L513-539）：`build("github")`/`build("gitee")`/`build("gitea")`/`build("cnb")` 各调 `results.find()` 遍历，O(4N)。

**优化后**：一次遍历 `results` 构建 `Map<PlatformKey, RemoteOpResult>`，直接从 Map 取值，O(N)。

### 优化 4：switchBranch 传 skipRefresh

L785 改为 `this.getWorkingTreeStatus(projectPath, { skipRefresh: true })`。切换分支前的安全检查不需要刷新 index，大仓库省数百毫秒。

### 冗余清理 1：hasConflict 复用 getConflictFiles

`hasConflict` 改为委托 `getConflictFiles`：`return (await this.getConflictFiles(projectPath)).length > 0`。消除重复的 `diff --name-only --diff-filter=U` 调用。

### 冗余清理 2：提取 withAbortController 通用方法

新增 `private async withAbortController<T>(id: string, fn: (signal: AbortSignal) => Promise<T>): Promise<T>`，封装 AbortController 创建 + 注册 + finally 清理。`remoteOpAll` 和 `remoteOpSingle` 委托调用，消除约 20 行重复代码。

### 冗余清理 3：checkPushStatus 复用 getBranch

L691 的 `this.execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])` 改为 `this.getBranch(cwd)`。`getBranch` 已有相同实现且含 try-catch 返回 ""。

### 冗余清理 4：移除 getTags 的 -n1 参数

L864 移除 `"-n1"`。当 `--format` 指定时 git 忽略 `-n` 参数，属多余。

## 实现注意事项

- **rev-list 合并的安全性**：`git rev-list --left-right --count remote/branch...HEAD` 在远程分支不存在时确实返回非零退出码（"fatal: ambiguous argument 'origin/main...HEAD'"），execGit 的 reject 路径会进入 catch 分支，与当前 noUpstream 逻辑一致
- **headCommitCount 缓存生命周期**：仅在单次 `checkPushStatus` 调用内缓存，不跨调用持久化（跨调用 HEAD 可能变化）
- **withAbortController 泛型**：需正确传递返回值类型 T，确保 remoteOpAll 返回 AllPlatformResult、remoteOpSingle 返回单平台结果
- **hasConflict 改为 async**：原同步签名 `async hasConflict(path): Promise<boolean>` 不变，但内部多一次 `getConflictFiles` 的数组构建开销可忽略（文件数通常极少）
- **getBranch 复用的行为差异**：`getBranch` 内部 catch 返回 ""，而原 L691 catch 返回 `emptyResult`（整个函数提前返回）。需调整：`getBranch` 返回 "" 时也 return emptyResult

## 目录结构

```
src/features/gitPush/
├── GitPushManager.ts          # [MODIFY] 4 项性能优化 + 4 项冗余清理，全部在此文件内
└── (无其他文件变更)
```

## 关键代码结构

### withAbortController 通用方法签名

```typescript
/** 注册 AbortController 并在操作完成后自动清理 */
private async withAbortController<T>(
  id: string,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const ac = new AbortController()
  const list = this.abortControllers.get(id) || []
  list.push(ac)
  this.abortControllers.set(id, list)
  try {
    return await fn(ac.signal)
  } finally {
    const existing = this.abortControllers.get(id)
    if (existing) {
      const filtered = existing.filter((a) => a !== ac)
      if (filtered.length > 0) {
        this.abortControllers.set(id, filtered)
      } else {
        this.abortControllers.delete(id)
      }
    }
  }
}
```

### checkPushStatus 优化后的 remoteChecks 逻辑

```typescript
let headCommitCount: number | null = null

const remoteChecks = remotesToCheck.map(async ({ key, remoteName }) => {
  try {
    // 直接 rev-list，失败则远程分支不存在
    const counts = await this.execGit(cwd, [
      "rev-list", "--left-right", "--count",
      `${remoteName}/${status.branch}...HEAD`,
    ])
    const parts = counts.split("\t")
    const behind = Number.parseInt(parts[0] || "0", 10)
    const ahead = Number.parseInt(parts[1] || "0", 10)
    return { key, result: { ahead, behind, noUpstream: false }, ahead }
  } catch {
    // 缓存 HEAD 提交数，多远程 noUpstream 时复用
    if (headCommitCount === null) {
      const total = await this.execGit(cwd, ["rev-list", "--count", "HEAD"]).catch(() => "0")
      headCommitCount = Number.parseInt(total, 10) || 0
    }
    return { key, result: { ahead: headCommitCount, behind: 0, noUpstream: true }, ahead: headCommitCount }
  }
})
```