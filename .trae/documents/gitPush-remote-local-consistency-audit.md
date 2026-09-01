# gitPush 远程与本地一致性分析弹窗

## 概要

在 gitPush 功能中新增「远程与本地一致性分析」：面板头部工具栏新增图标按钮 → 点击弹出独立弹窗 → 弹窗内点击「开始分析」按钮后，批量审查**所有项目**的每个本地分支与各远程分支的一致性（是否存在 / 领先 / 落后 / 分叉 / 仅本地 / 仅远程），带进度显示、状态汇总与边界状态处理。

用户已确认的决策：
- **入口**：PanelHeader 头部工具栏图标按钮（Git 配置按钮旁）
- **fetch 策略**：弹窗内「分析前先 fetch 远程」开关，**默认开启**（fetch --prune 后比对最准确；关闭则仅用本地缓存的远程跟踪分支）

## 现状分析（探索结论）

- 现有 `useRepoLinkAudit` + `RepoLinkAuditSection`（统计视图区块）只比对**手动配置的 URL 与 `git remote -v` 实际 URL**，不涉及分支级一致性 → 本功能与其互补，不重复
- 现有 `RemoteOps.checkPushStatus` 只检查**当前分支**对已配置平台远程的 ahead/behind，不覆盖全分支、不覆盖实际存在但未在项目记录中配置的远程
- 弹窗规范：`components/common/` 下的弹窗自包含（父只传 `i18n` + `manager`，`useDialogKeyboard` 处理 Esc，`<Transition name="gp-dialog-fade">` + `v-if` 挂载于 index.vue）
- git 命令统一走 `GitExecutor.execGit`（双池限流：网络命令 ≤2 并发、本地命令默认 3 并发自动排队；支持 AbortSignal、30s 默认超时、10MB maxBuffer）→ 批量分析**无需额外节流**
- 类型分层：审计类型放 `types/meta.ts`（已 ~450 行，逼近 500 行硬阈值）→ 新类型放独立文件 `types/consistency.ts`（与 `types/report.ts`、`types/batchProgress.ts` 的按域拆分先例一致）
- 样式：`gp-status-chip` / `gp-table-*` 基类定义在 `StatsPanel.scss`（仅统计视图渲染时加载）→ 弹窗必须使用**自包含的 `gca-` 前缀样式**，避免跨视图样式依赖
- i18n：分片文件 `src/i18n/{zh_CN,en_US}/gitPush.json`，现有 `audit*` 键先例（本功能新增 `consistency*` 前缀键）

## 一致性判定逻辑（每项目）

1. `resolveValidPath(project)` 无有效路径 → 项目 error 行（"路径无效或检测失败"）
2. `manager.detectRemotes(cwd)`（`git remote -v`，本地命令）→ 实际远程列表
3. 若开启 fetch：对每个远程 `git fetch <R> --prune`（走网络池限流，失败记入 `fetchErrors[R]` 并**继续用缓存跟踪 ref 比对**）
4. `manager.getBranches(cwd)`（已有 API，含 current 标记）+ 新增 `manager.getRemoteTrackingRefs(cwd)`（`git for-each-ref refs/remotes --format=%(refname:short)`，一条命令取全部远程跟踪分支）
5. 远程分组 = 检测到的远程名 ∪ 跟踪 ref 首段（按「远程名 + /」最长前缀匹配分组，兼容 `feature/x` 型分支名与含特殊字符远程名；排除 `R/HEAD` 符号 ref）
6. 每个本地分支 B × 远程 R：
   - `R/B` 不存在于跟踪 ref → **localOnly**（仅本地）
   - 存在 → 新增 `manager.countAheadBehind(cwd, R/B, B)`（`git rev-list --left-right --count R/B...B`，左=behind 右=ahead，与 `checkPushStatus` 现有约定一致）→ `0/0` synced、`ahead>0` 需推送、`behind>0` 需拉取、双 >0 已分叉；rev-list 失败 → 该行 error
7. 远程独有分支（`R/X` 无本地 X）→ **remoteOnly** 行（含陈旧远程残留 ref，提示用户清理）
8. 汇总态：无远程 → `noRemote`；无本地且无远程分支 → `noBranches`（空仓库）

## 变更文件清单

### 新建 4 个文件

**1. `src/features/gitPush/types/consistency.ts`（~70 行）**

```ts
// 远程与本地一致性分析类型（useConsistencyAudit 产出 / ConsistencyAuditDialog 消费）
export type ConsistencyState = "synced" | "ahead" | "behind" | "diverged" | "localOnly" | "remoteOnly" | "error"

export interface ConsistencyBranchRow {
  branch: string      // 本地分支名（remoteOnly 时为远程分支名）
  current: boolean    // 是否当前分支
  remote: string      // 远程名
  state: ConsistencyState
  ahead: number       // 本地领先提交数
  behind: number      // 本地落后提交数
}

export interface ConsistencyProjectRow {
  id: string; name: string; path: string
  error: boolean                       // 路径无效/git 失败
  noRemote: boolean                    // 未配置远程
  noBranches: boolean                  // 空仓库或无分支
  fetchErrors: Record<string, string>  // 各远程 fetch 失败信息
  branches: ConsistencyBranchRow[]
}

export interface ConsistencySummary { synced: number; ahead: number; behind: number; diverged: number; localOnly: number; remoteOnly: number; error: number }
```

**2. `src/features/gitPush/composables/useConsistencyAudit.ts`（~220 行）**

参照 `useRepoLinkAudit` 模式，但完全自包含（内部 `manager.getProjects()` 取项目快照，不依赖父组件传 projects，符合弹窗自包含规则）：

- 状态：`rows` / `analyzing` / `analyzed` / `fetchFirst`（默认 true）/ `issueOnly`（默认 true）/ `progress {done,total}` / `summary`（computed 七态计数）
- `runAudit()`：`analyzing` 重入 guard → 新建 `AbortController` → `Promise.allSettled(projects.map(auditProject))`，每项目 settle 后 `progress.done++`；finally 复位 `analyzing`
- `auditProject(p)`：按上方判定逻辑 1-8 实现；fetch 传 signal；**fetch 失败且该远程无任何缓存跟踪 ref 时跳过该远程比对**（避免误报 localOnly）
- `cancel()`：abort 进行中的 fetch 子进程；`onUnmounted` 自动调用（弹窗关闭即取消，无僵尸进程）
- 错误消息用 `getErrorMessage`（`@/utils/stringUtils`）

**3. `src/features/gitPush/components/common/ConsistencyAuditDialog.vue`（~280 行）**

结构仿 `ExtFilterDialog`（mask + `rootRef` + Esc/点击遮罩关闭）：

- **Props**：`manager: GitPushManager`、`i18n: Record<string, any>`（最小标识符 + manager，自包含）
- **emit**：`close` / `viewProject: [projectId: string]`（camelCase）
- 布局：头部（标题 + 关闭）→ 工具栏（「分析前先 fetch 远程」开关 + 「开始分析/重新分析」按钮 + 「仅显示问题」开关）→ 进度（`分析中… 12/34` + 转圈图标）→ 七态汇总 chips → 结果表格（列：项目 / 分支 / 远程 / 状态 / 领先落后）→ 全部一致空态 / 未分析提示 / 暂无项目空态 → 底部关闭按钮
- `issueOnly` 过滤：仅展示 `error || noRemote || noBranches || fetchErrors 非空 || 存在非 synced 分支行` 的项目，且其分支行仅显示非 synced 行
- 组件内常量 `CONSISTENCY_STATE_META`（七态 icon/cls/labelKey，仿 `RepoLinkAuditSection` 的 `STATE_META` 先例）：
  - synced `mdi:check-circle-outline` / ahead `mdi:arrow-up` / behind `mdi:arrow-down` / diverged `mdi:call-split` / localOnly `mdi:laptop` / remoteOnly `mdi:cloud-outline` / error `mdi:alert-circle-outline`
- 点击项目名 → `emit('viewProject', row.id)`
- 模板每处 i18n 渲染上方加中文注释（AGENTS 规则）

**4. `src/features/gitPush/styles/ConsistencyAuditDialog.scss`（~200 行）**

- `gca-` 前缀自包含类（不依赖 StatsPanel.scss 的 `gp-*` 类）
- 遵循 Codex 规范：只用设计 Token（`$color-*` / `$spacing-*` / `$font-size-*` / `$font-weight-*` / `$line-height-*` / `$radius-*`），禁 `box-shadow`、禁硬编码色值/字号/尺寸
- 弹窗 max-width ~560px、max-height ~70vh，表格区滚动，`padding-right` 预留滚动条间距

### 修改 8 个文件

**5. `managers/WorktreeOps.ts`（+2 方法 ~25 行）**

```ts
/** 列出全部远程跟踪分支短名（如 origin/main），供一致性比对（本地读） */
async getRemoteTrackingRefs(projectPath: string): Promise<string[]> {
  // for-each-ref refs/remotes --format=%(refname:short)，失败返回 []
}
/** 计算 localBranch 相对 remoteRef 的 ahead/behind（左=remote→behind，右=local→ahead） */
async countAheadBehind(projectPath: string, remoteRef: string, localBranch: string): Promise<{ ahead: number, behind: number }> {
  // rev-list --left-right --count remoteRef...localBranch，解析 \t 分隔
}
```

**6. `managers/RemoteOps.ts`（+1 公开方法 ~10 行）**

```ts
/** 按路径 fetch 指定远程（--prune 清理已删除远程分支的跟踪引用），供一致性分析使用 */
async fetchRemoteAt(cwd: string, remoteName: string, opts?: { prune?: boolean, signal?: AbortSignal }): Promise<void>
```

（现有 `fetchRemote` 为 private 且无 prune/signal，不改动既有调用方。）

**7. `GitPushManager.ts`（+3 行门面透传）**

`getRemoteTrackingRefs` / `countAheadBehind` → worktreeOps；`fetchRemoteAt` → remoteOps。

**8. `types/index.ts`（+1 段重导出）**

`export type { ConsistencyState, ConsistencyBranchRow, ConsistencyProjectRow, ConsistencySummary } from "./consistency"`

**9. `components/common/PanelHeader.vue`（+1 按钮 +1 emit）**

「Git 配置」按钮后新增图标按钮：`mdi:sync-check`，`:title="i18n.consistencyOpen"`，`@click="emit('openConsistency')"`；emit 类型加 `openConsistency: []`。

**10. `index.vue`（+~15 行）**

- import `ConsistencyAuditDialog`；`const showConsistencyDialog = ref(false)`
- PanelHeader 加 `@open-consistency="showConsistencyDialog = true"`
- 与其他弹窗并列挂载：

```html
<Transition name="gp-dialog-fade">
  <ConsistencyAuditDialog
    v-if="showConsistencyDialog"
    :i18n="i18n"
    :manager="manager"
    @close="showConsistencyDialog = false"
    @view-project="(id) => { showConsistencyDialog = false; onViewProject(id) }"
  />
</Transition>
```

**11. `src/i18n/zh_CN/gitPush.json` + `src/i18n/en_US/gitPush.json`（新增 ~24 键，中英同步）**

`consistencyTitle`(远程与本地一致性分析) / `consistencyOpen`(一致性分析，头部按钮 tooltip) / `consistencyHint` / `consistencyRun`(开始分析) / `consistencyRerun`(重新分析) / `consistencyAnalyzing`(分析中…) / `consistencyFetchFirst`(分析前先 fetch 远程) / `consistencyIssueOnly`(仅显示问题) / `consistencyProgress`({0}/{1}) / `consistencySynced`(一致) / `consistencyAhead`(需推送) / `consistencyBehind`(需拉取) / `consistencyDiverged`(已分叉) / `consistencyLocalOnly`(仅本地) / `consistencyRemoteOnly`(仅远程) / `consistencyStateError`(比对失败) / `consistencyAllClear`(远程与本地全部一致) / `consistencyNoRemote`(未配置远程) / `consistencyNoBranches`(空仓库或无分支) / `consistencyFetchFailedPrefix`(fetch 失败) / `consistencyColProject`(项目) / `consistencyColBranch`(分支) / `consistencyColRemote`(远程) / `consistencyColStatus`(状态) / `consistencyAheadCount`(领先 {0}) / `consistencyBehindCount`(落后 {0}) / `consistencyCurrentBranch`(当前分支) / `consistencyNoProjects`(暂无项目)

**12. `README.md`（功能列表 +1 行）**

「远程与本地一致性分析：头部按钮打开弹窗，批量比对所有项目各本地分支与各远程分支（存在性/领先/落后/分叉），可先 fetch --prune，支持进度/汇总/仅看问题过滤」

## 边界问题处理清单（用户重点关注）

| # | 边界场景 | 处理 |
|---|---------|------|
| 1 | 项目路径无效/目录被移走 | `resolveValidPath` 空 → error 行 |
| 2 | 非 git 仓库 | git 命令 reject → 整体 try/catch → error 行 |
| 3 | 未配置任何远程 | `noRemote` 项目行（非 error） |
| 4 | 空仓库（unborn branch） | 分支/远程 ref 均空 → `noBranches` |
| 5 | detached HEAD | `branch --format` 无 current 标记 → 无当前分支指示，不报错 |
| 6 | fetch 失败（网络/认证） | 记 `fetchErrors[R]` 继续用缓存 ref；该远程无任何缓存 ref 时跳过其比对（不误报 localOnly） |
| 7 | 远程分支已删除 | 开 fetch 时 `--prune` 清理 → 正确 localOnly；关 fetch 时提示基于缓存比对 |
| 8 | 分支名含斜杠（feature/x） | 按检测远程名最长前缀分组；rev-list 参数走 execFile 数组，无注入风险 |
| 9 | 远程名非常规/陈旧远程残留 ref | 首段兜底并入远程分组，显示为该远程 remoteOnly（提示可清理） |
| 10 | 分析中关闭弹窗 | `onUnmounted` → AbortController abort → fetch 子进程 kill、排队 Promise reject → allSettled 捕获，`analyzing` 复位，无泄漏 |
| 11 | 重复点击分析按钮 | `analyzing` 重入 guard |
| 12 | 大量项目并发 | GitExecutor 双池自动排队（网络 ≤2、本地 ≤3），无需额外节流 |
| 13 | 单命令超时 | execGit 默认 30s，失败落入 error/fetchErrors |
| 14 | 分析期间项目增删 | runAudit 开始时快照项目列表，中途删除项目命令失败仅产生 error 行（无害） |
| 15 | 暂无项目 | `consistencyNoProjects` 空态 |
| 16 | i18n 缺键 | 中英分片同步新增，不使用硬编码兜底（AGENTS 规则） |

## 假设与决策

- **分支范围**：全部分支 × 全部实际远程（`git remote -v` 检测结果，而非项目记录中配置的平台远程）——覆盖镜像多平台场景（分支推了 github 没推 gitee 也能发现）
- **归档项目也参与分析**：与统计视图 `RepoLinkAudit` 用全量项目一致
- **ahead/behind 约定**：与现有 `checkPushStatus` 一致（`rev-list --left-right --count remote...local`，左=behind、右=ahead）
- **不使用 `%(upstream:track)`**：逐远程统一用 rev-list 比对，覆盖无 upstream/多 upstream 场景，逻辑统一
- **弹窗状态不跨开闭持久化**：每次打开弹窗为全新实例需重新分析（符合弹窗自包含规则，与 v-if 挂载模式一致）
- **新类型独立文件** `types/consistency.ts`：避免 `meta.ts`（~450 行）突破 500 行硬阈值
- 本功能为 gitPush 模块内增强，**不涉及**功能注册 8 步清单（无 FEATURE_CONFIG/settings 开关变更）

## 验证步骤

实现完成后：

1. `npx tsc --noEmit` — 类型检查（AI 执行）
2. `pnpm i18n:verify` — 中英键对齐（用户执行）
3. `pnpm lint` / `pnpm validate:icons` — 代码规范与图标校验（用户执行）
4. 手动功能验证（用户，开发模式）：
   - 头部新按钮 → 弹窗打开 → 默认勾选 fetch → 点击「开始分析」→ 进度递增 → 汇总 chips + 表格出现
   - 制造各状态验证：本地新建分支未推（localOnly）、远程建分支未拉（remoteOnly）、本地提交未推（ahead）、远程提交未拉（behind）、两边各自提交（diverged）
   - 关闭 fetch 开关重新分析 → 用缓存 ref 快速出结果
   - 分析中关闭弹窗 → 重开 → 无残留 git 进程（任务管理器确认）
   - 无远程项目 / 空仓库项目 / 无效路径项目 → 对应提示而非报错
