# gitPush Git 操作越线风险审计与加固计划

## Summary

对 gitPush 模块全部 38 处副作用 git 调用点完成审计。整体防护体系良好（无 `reset --hard`、无裸 `--force`、pull 全部 `--ff-only`、UI 层零绕锁直写、rebase reword 已有完整恢复链），但发现 4 处缺口需修复，均为低风险小改动。用户已确认：全部修复；index.lock 仅增强错误提示（不做自动清理）。

## 审计结论（现状）

### 已确认安全的防护（无需改动）

- **高危命令不存在**：无 `reset --hard`、无裸 `--force`（仅 `--force-with-lease` + UI 二次确认 + 分支解析失败即中止）、无 cherry-pick/revert、无 branch 增删改
- **pull 安全阀**：所有 pull 带 `--ff-only`（分叉即失败，不产生 merge commit），错误经 `enhancePullError` 给出终端指引
- **丢弃变更受控**：`discardFile`/`clean` 限定单文件且带 `--` 防注入；discard/stashDrop/deleteTag/resolveConflict 均有 UI 二次确认
- **UI 零绕锁**：composables/组件全部经 GitPushManager 门面（`worktreeOps` 等为 private 字段，类型系统也禁止外部访问）
- **rebase 恢复链**：上次已修复（残留前置检测 + abort 3 次重试 + 手动恢复指引）
- **switchBranch** 有 dirty 前置检查（含 untracked 计数）

### 缺口 4 处（本次修复）

| # | 缺口 | 位置 | 风险 |
|---|------|------|------|
| 1 | 批量修正无前置状态检查（dirty/rebase 残留仓库上启动 rebase → 失败 → abort 全流程 ×N 次） | `useBatchCommitFix.ts` | 低（与上次事故同类） |
| 2 | git 命令超时被 SIGTERM 硬终止后残留 `.git/index.lock`，错误无解法指引 | `GitExecutor.ts` | 低（触发窗口小但一旦触发所有写操作失败） |
| 3 | `abortMerge` 无 merge 状态检测，stash pop 冲突场景报模糊错误 | `RepoOps.ts` | 低 |
| 4 | remote 增删改/项目级 git config 写未包 writeLock（与本地写并发写 `.git/config` 竞争窗口） | `GitPushManager.ts` | 极低 |

## Proposed Changes

### 修复 1：批量修正增加项目级前置状态检查

**文件**：`src/features/gitPush/composables/useBatchCommitFix.ts`

- `BatchFixResult` 接口新增 `blockedProjects: string[]` 字段（项目名数组）
- `fixSelected()` 重构循环：先按 `projectId` 分组（`Map<string, CommitRuleViolation[]>`），对每个项目检查一次状态——`manager.getWorkingTreeStatus(path)` 有变更 或 `manager.isInRebaseState(path)` 为 true 时，该项目整组跳过（不计入 failed，不启动 rebase），项目名记入 `blockedProjects`
- 检查通过的组按原逻辑逐条 `rewriteCommitMessage`（保留原串行行为与 preserveDate=true）

**文件**：`src/features/gitPush/components/CommitRuleCheck/ViolationListSection.vue`

- 批量结果提示区（现有 `lastResult` 渲染处）追加 blockedProjects 提示行：`blockedProjects.length > 0` 时显示，沿用现有 `.replace("{0}", ...)` 模式

**i18n**：`src/i18n/zh_CN/gitPush.json` 与 `en_US/gitPush.json` 各新增 1 键（紧邻现有 ruleCheckBatchResult 区域）：

- `ruleCheckBlockedProjects`：`已跳过 {0} 个状态异常的项目（工作区未清理或处于 rebase 中断状态）：{1}` / `Skipped {0} project(s) in an unsafe state (dirty working tree or interrupted rebase): {1}`

### 修复 2：index.lock 残留错误指引

**文件**：`src/features/gitPush/managers/GitExecutor.ts`（execGit 错误构造处，约 202-209 行）

在 reject 前检测 stderr 与 error.message，命中 `/index\.lock|another git process/i` 时在错误信息末尾追加指引：

```ts
const lockHint = /index\.lock|another git process/i.test(`${stderr}\n${error.message}`)
  ? "\n检测到 index.lock 冲突：若确认无其他 git 进程运行（IDE/终端），可删除仓库下 .git/index.lock 后重试"
  : ""
reject(new Error((stderr ? `${reason}\n${stderr}` : `${reason}: ${error.message}`) + lockHint))
```

中文硬编码与 GitExecutor 现有错误文案（"git 命令超时"等）一致——GitExecutor 无 i18n 注入通道，不为此引入。

### 修复 3：abortMerge 状态检测

**文件**：`src/features/gitPush/managers/RepoOps.ts`

- 导入 `getNodeFsPathOs`（`@/utils/nodeModules`），仿照 `WorktreeOps.isInRebaseState` 的模式：`rev-parse --git-path MERGE_HEAD` + `existsSync` 检测
- `abortMerge` 执行前检测 MERGE_HEAD：不存在时抛出明确错误——`当前无进行中的合并（merge 冲突不存在）。若这是 stash 恢复产生的冲突：stash 条目并未删除，数据不会丢失，请解决冲突或参考终端操作恢复`；存在时正常执行 `git merge --abort`

文案硬编码中文，与底层错误消息现有模式一致（错误由 useGitHandlers 的 toast 直接展示 getErrorMessage）。

### 修复 4：remote/config 写操作包 writeLock

**文件**：`src/features/gitPush/GitPushManager.ts`

以下 6 处委托方法改为 `writeLock.runExclusive` 包装（参照同文件 `abortMerge` 的现有模式）：

- `addRemote`（约 451 行）、`removeRemote`（455）、`renameRemote`（457）、`setRemoteUrl`（463）
- `setProjectGitConfig`（485）、`unsetProjectGitConfig`（489）

**保持不包锁**：`fetchRemoteAt`/`fetchAllForProject`（fetch 只写 refs/remotes 不取 index.lock，包锁反而让长时间 fetch 阻塞本地写）、`setGitGlobalConfig`/`unsetGitGlobalConfig`（home 目录作用域，不在项目锁语义内）、`cloneRepo`（全新目录无共享状态）。

## 不修项（知悉即可）

- **fetch 不包锁**：有意取舍，理由见上
- **writeLock 键为原始路径字符串**：路径统一经 `resolveValidPath` 解析，异构路径分裂风险极低；macOS 大小写敏感文件系统上做归一化反而引入错误锁共享
- **冲突解决后无「完成合并提交」入口**：功能增强而非风险修复，超出本次范围
- **discardFile/stashDrop/deleteTag 不可回滚**：有 UI 二次确认 + `--` 注入防护，属设计内行为

## Assumptions & Decisions

- index.lock 处理方式经用户确认为「仅增强错误提示」，不做自动检测清理（无法感知外部 git 进程，存在竞态风险）
- 底层错误消息（GitExecutor/RepoOps）沿用现有硬编码中文模式；模板渲染文案（ViolationListSection）走 i18n——均与代码库现状一致
- 批量修正被阻止的项目计入 `blockedProjects` 而非 `failed`/`skipped`，与"规则无法自动修复"（skipped）和"执行失败"（failed）语义区分开

## Verification

1. `npx vue-tsc --noEmit`：确认 4 个改动文件无新增类型错误（既有 video 模块 TS6133 等错误与本次无关）
2. `pnpm i18n:verify`：中英键对齐（新增 1 键）
3. `pnpm lint`：用户自行执行
4. 手动验证场景（可选）：
   - 批量修正：制造 dirty 仓库 → 勾选违规 → 批量修复 → 应显示「已跳过 N 个状态异常的项目」且不启动 rebase
   - index.lock：手动在 `.git` 下创建空 `index.lock` 文件 → 执行任意暂存/提交 → 错误信息应含删除指引
   - abortMerge：非 merge 状态点「中止合并」→ 应得到「当前无进行中的合并」明确提示而非裸 git 报错
