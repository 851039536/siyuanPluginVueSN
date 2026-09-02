# gitPush 模块 Git 操作一致性与边界问题审查 + 修复计划

## Summary

对 `src/features/gitPush` 的 git 操作链路（GitExecutor / RemoteOps / RepoOps / WorktreeOps / ProjectStore + 视图组合层）做一致性与边界审查，输出结构化审查报告，并修复全部已确认问题。核心修复方向：

1. **命令越界面**：补齐 `--` 分隔符 / 输入校验（tag、conflict file、clone URL）
2. **路径越界**：`resolveValidPath` 降级不再静默；addProject 接入存在性 + git 仓库校验
3. **并发越界**：新增项目级写锁（写写互斥、读写并行）；ProjectStore 写路径串行化
4. **吞错与确认**：discardFile 失败不再静默；resolveConflictFile 加确认；loading 标志引用计数
5. **一致性**：GitExecutor 错误信息携带 exit code / 超时标识；缓存失效点补全；杂项类型修正

## Current State Analysis

### 架构（已探明，含实测行号）

```
GitPushManager.ts（门面，纯转发）
 ├── GitExecutor.ts   — execFile("git", args[]) 数组传参，不经 shell；双池信号量（网络/本地）+ AbortController
 ├── ProjectStore.ts  — 内存缓存 + mutateProject 克隆后写回
 ├── RemoteOps.ts     — push/pull/fetch，错误对象模式 { ok, stderr, skipped }
 ├── WorktreeOps.ts   — status/diff/stage/commit/stash/branch/rebase 改写（throw 模式）
 └── RepoOps.ts       — tag/冲突/remote 配置/clone/扫描
```

- 已有防护：push↔pull 经 `isOpInProgress` 后端互斥（useRemoteProgress.ts:139/211）；破坏性操作确认弹窗；空仓库/detached HEAD/无 remote 边界已处理。
- 关键缺口：写操作（commit/stash/discard/stage）与 push/pull 之间无互斥；`checkIsGitRepo`（WorktreeOps.ts:296-303）已实现但零调用方；`resolveValidPathWithSource` 的 `source: "fallback"` 信息从未呈现给用户。

### 审查确认的问题清单（30 项中纳入修复的按组分列，见 Proposed Changes）

> 说明：探查报告中「分支名含空格导致 noUpstream 误报」一项经复核为**非问题**——git check-ref-format 禁止 ref 名含空格/`..`/`^~:?*`，rev 插值实际安全，不修复，仅报告中说明。

## Proposed Changes

### A. 命令越界面修复（RepoOps.ts）

| # | 位置 | 问题 | 修复 |
|---|------|------|------|
| A1 | RepoOps.ts:31-43 | `createTag`/`deleteTag`/`pushTag` 的 tag 名、remote 名未用 `--` 分隔，以 `-` 开头的 tag 名会被 git 当作选项 | 命令改为 `["tag", "-a", name, "-m", msg, "--"]` 形式补 `--`（`deleteTag`：`["tag", "-d", "--", name]`；`pushTag`：`["push", remote, "--", tag]`） |
| A2 | RepoOps.ts:66-69 | `resolveConflictFile` 的 file 参数未用 `--` | `checkout --ours -- <file>` / `checkout --theirs -- <file>` / `add -- <file>` |
| A3 | RepoOps.ts:108-120 | `cloneRepo` URL 未防选项注入；parentDir 只查存在不查是目录 | ① URL 以 `-` 开头直接 throw（中文错误信息）；② `fs.statSync(parentDir).isDirectory()` 校验，包 try-catch |
| A4 | RepoOps.ts:185 | `scanForGitRepos` 中 `statSync` 未捕获 TOCTOU ENOENT | 包 try-catch，失败跳过该目录 |

### B. 路径边界修复

| # | 位置 | 问题 | 修复 |
|---|------|------|------|
| B1 | utils.ts:579-619 + RemoteOps.ts 各入口 | `resolveValidPath` 全路径失效时静默降级返回主路径（可能不存在），cwd 无效 → git ENOENT 报错不友好；`source: "fallback"` 信息从未呈现 | RemoteOps 的 `remoteOpAll`/`remoteOpSingle`/`fetchAllForProject`/`checkPushStatus` 改用 `resolveValidPathWithSource`；当 `source === "fallback"` 时将「所有已知路径均不存在，已回退主路径，请检查项目路径配置」追加到该平台结果的 stderr/summary，不再伪装成 git 底层报错 |
| B2 | ProjectStore.ts:96-123 + index.vue:847-857 | `addProject` 不校验路径存在性、不校验是否 git 仓库（`checkIsGitRepo` 死代码） | 复用 `checkIsGitRepo`：在 `index.vue` 的 addProject 流程（保持 AddProjectDialog 自包含模式不变，校验放在 manager 入口 `addProject` 内）对主路径做 existsSync + isDirectory + `.git` 存在性校验，失败 throw 中文错误（「路径不存在」/「不是 Git 仓库」）；detectRemotes 静默失败行为保留 |
| B3 | WorktreeOps.ts:296-303 | `checkIsGitRepo` 零调用方 | 由 B2 消化（成为真实调用方），不做其他改动 |

### C. 并发越界：项目级写锁（用户已确认方案）

新增 `managers/ProjectWriteLock.ts`（新文件，纯逻辑层，符合三层分层）：

```ts
// 按项目路径键控的写锁：写写互斥、读写并行
class ProjectWriteLock {
  private chains: Map<string, Promise<unknown>>;
  runExclusive<T>(projectPath: string, fn: () => Promise<T>): Promise<T>;
  destroy(): void; // 供 GitPushManager.destroy 调用（置 destroyed 标志，新任务拒绝）
}
```

接入点（全部经 `GitPushManager` 构造器注入或模块内引用，写入路径统一包 `runExclusive(resolveValidPath(path), ...)`）：

| 位置 | 操作 |
|------|------|
| WorktreeOps.ts | `stageFile`/`stageAll`/`unstageFile`/`unstageAll`/`discardFile`/`commit`/`switchBranch`/`stash save`/`pop`/`apply`/`drop`/`rewriteCommitMessage` |
| RepoOps.ts | `createTag`/`deleteTag`/`abortMerge`/`resolveConflictFile` |
| RemoteOps.ts | `tryRemoteOp`（push/pull 主体，替代/叠加现有 isOpInProgress 互斥，形成后端兜底） |

- 读操作（status/diff/log/branches/checkPushStatus）不持锁，保持并行。
- 锁内操作沿用现有错误模式（WorktreeOps throw / RemoteOps 错误对象），不改变对外签名。
- ProjectStore.ts 写路径串行化：`saveProjects` 内部经同一把锁（或独立 Promise 链）序列化，消除并发 mutate 的 lost update（ProjectStore.ts:69-91）。

### D. 吞错与确认机制修复

| # | 位置 | 问题 | 修复 |
|---|------|------|------|
| D1 | WorktreeOps.ts:136-139 | `discardFile` staged 分支 `reset HEAD`/`checkout --` 各带 `.catch(() => {})`，失败用户无感知 | 移除吞错，任一命令失败向上 throw（与同类写操作一致） |
| D2 | useGitHandlers.ts:167-169 | `resolveConflictFile` ours/theirs 直接覆盖冲突文件，无确认 | 在 `handleResolveConflict` 中加 `showConfirm`（文案说明将覆盖未保留一侧的改动） |
| D3 | useGitHandlers.ts:149 | `handlePushTag` 用 `Promise.all` fast-fail，多远程部分成功时只报第一个错 | 改 `Promise.allSettled`，汇总失败远程列表后统一 toast |
| D4 | useRemoteProgress.ts:140-141 | push/pull 入口守卫静默返回 `{success:false}` | 拒绝时向该卡片 `commitOutputs` 写入「操作进行中，请稍候」提示（复用现有输出通道） |
| D5 | useRefreshOps.ts:51-72 | `handleRefresh` 无重入守卫，`refreshing` 单值被覆盖 | 入口处 `if (refreshing.value) return` |
| D6 | WorktreeOps.ts:329-418 | `rewriteCommitMessage`（rebase 改写）后不失效 pushStatusCache | 改写成功后调用 `invalidatePushStatusCache(id)`（与 commit 路径 useGitOps.ts:136 对齐） |

### E. loading 标志引用计数（Record 型标志防提前清除）

- 位置：useGitHandlers.ts:67/88（`gitOpLoading`）、useGitOps.ts stash 相关（`stashLoading`）、useRefreshOps.ts:46。
- 方案：新增轻量 helper（放 `composables/useFlagCounter.ts` 或直接放 utils.ts——按 Rule of Three，3 处使用，提取到 `utils.ts` 导出 `acquireFlag(record, id) / releaseFlag(record, id)`）：值改为计数，`acquire` 自增，`release` 递减至 0 时 `delete`。三处调用点改为 acquire/release 配对，先完成者不再提前清除他人标志。
- UI 模板读取处兼容：计数 > 0 即视为 loading（现有 `!!record[id]` 判断天然兼容 number）。

### F. 一致性修正

| # | 位置 | 问题 | 修复 |
|---|------|------|------|
| F1 | GitExecutor.ts:191 | 错误 reject 丢弃 exit code；超时时错误文案无「超时」标识 | reject 的 Error message 拼入 `exit code: N`；`error.killed === true`（execFile timeout SIGTERM）时前置「命令超时（Xms）」 |
| F2 | GitExecutor.ts:209-221 | `removeFromQueue` 形参类型只标 `gitWaitQueue` 却复用于 network 队列 | 放宽参数类型为两队列的联合/共同类型 |
| F3 | WorktreeOps.ts:208-233 | `getCommitLog(count="all")` 无上限，大仓库可能超 10MB maxBuffer | count 为 all 时加 `-n 5000` 保护上限 |
| F4 | ProjectStore.ts:142-151 | `updateProjectMeta` 浅合并导致 patch 中数组按引用共享 | patch 写入前对 `tags`/`localPaths`/`pathDevices` 做浅拷贝 |
| F5 | useGitOps.ts / useGitHandlers.ts（E 项同文件） | — | 与 E 合并实施，不重复改动 |

## Assumptions & Decisions

1. **不做** git ref 插值防护（RemoteOps.ts:439 `${remote}/${branch}...HEAD`）——git ref 格式本身禁止空格与 rev 元字符，无实际越界面，报告中说明即可。
2. **不做** `scanForGitRepos` 同步 BFS 改异步——涉及面大且已有 MAX_DEPTH/MAX_RESULTS 缓解，报告记录、单独立项。
3. porcelain `-z` 改造、网络命令超时时长调整（30s→更长）不在本次范围，报告记录。
4. 写锁实现为进程内逻辑锁（非文件锁），覆盖插件自身发起的操作；用户在终端的手工操作不感知此锁（git 自身 index.lock 仍兜底）。
5. 校验类错误信息统一中文（与模块现有中文错误文案一致）。
6. 修复后 AI 不执行 `pnpm vite build` / `pnpm lint`（AGENTS 规则），由用户验证。

## Verification

1. `npx tsc --noEmit`（用户执行）— 类型检查通过
2. `pnpm lint`（用户执行）— 规范检查
3. 人工边界验证清单（用户执行）：
   - 添加一个不存在路径的项目 → 应报「路径不存在」而非静默入库
   - 添加非 git 目录 → 应报「不是 Git 仓库」
   - 断网状态下批量推送 → 全路径失效时各平台输出应含路径回退警告
   - 快速连点「丢弃文件」两文件 → 第二个操作期间按钮保持禁用（引用计数生效）
   - 冲突解决 ours/theirs → 应先弹确认框
   - stash pop 期间触发 push → push 应排队等 stash 完成（写锁生效，无 index.lock 报错）
4. 最终审查报告（问题清单 + 已修复项 + 记录不修复项及理由）在会话中输出，不新建文档文件。
