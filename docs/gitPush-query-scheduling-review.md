# gitPush 查询调度专项审查报告（重复调度 + 调度解耦）

审查对象：`src/features/gitPush/` 的**查询调度路径**（谁触发 git 子进程、何时触发、同一查询是否被重复触发）
对照范围：`composables/`（useGitOps / useRefreshOps / useCardData / useRemoteProgress / useBatchProgress / useCommitAnalysis）、`index.vue`、`components/ListView/`（ProjectCard / WorkingTreePanel / CardHeaderActions）、`managers/GitExecutor.ts`（并发池）
审查依据：`AGENTS.md § 功能模块内代码分层` / `§ 统一入口原则`、`AGENTS_ARCH.md § 单文件行数上限`、`docs/gitPush-code-review.md`（既有审查范式）
审查日期：2026-07-02
本轮改动：**已实施重构**（新增调度器 + 契约调整，见 §5 修复映射）

---

## 一、结论摘要

| 编号 | 严重度 | 问题 | 涉及文件 |
|---|---|---|---|
| D1 | 🟡 | 「项目状态查询」有 5 份并行实现（条件/是否 fetch/是否刷 remotes 各不相同） | useGitOps, useRefreshOps |
| D2 | 🟡 | 刷新三兄弟逻辑三写（handleRefresh 内联复刻另两者并集） | useRefreshOps |
| D3 | 🔴 | 已知分支名不传，同一轮多次 `rev-parse` | useGitOps, useGitHandlers |
| D4 | 🔴 | 卡片详情懒加载单飞缺口（`detailsLoaded` 在 await 之后置位） | useCardData |
| D5 | 🟡 | 首屏批量与卡片首点重复查同一项目（无最小间隔守卫） | index.vue, ProjectCard |
| D6 | 🟡 | 视图/上下文 watch 交叉重复（靠调用方 Set 兜底） | index.vue |
| D7 | 🟡 | 远程刷新两条重复网络 fetch 路径（无互斥） | useRefreshOps, useRemoteProgress |
| D8 | 🔴 | 批量进度计时器竞态（延迟 `end()` 无序号校验） | useBatchProgress |
| D9 | 🟡 | 信号推送通道与父层直接加载并存（双通道） | useGitOps, useGitHandlers |
| D10 | 🟡 | 信号机制自身 O(卡片数 × 域数) 求值开销 | useCardData, useGitOps |

**总体判断**：模块分层（Manager 门面 / managers / composables / utils）本身清晰，**问题集中在「查询调度」这一横切关注点没有归属**——去重、单飞、分支名复用、新鲜度判定四件事分别寄生在 5 个文件里，因此同一查询从不同入口进入就会重复发子进程。这不是零散 bug，而是**缺少一个调度权威**的结构性问题：每个入口都自行发明了一套去重（`Set` / 布尔 / 时间戳 / 引用计数 / 无），互相不知道对方在飞什么。

**根因一句话**：`loadPushStatus` / `loadWorkingTree` 被调用 12 处，而「是否已加载」「是否正在加载」「分支名是什么」这三个事实**没有任何单一持有者**。

---

## 二、🔴 高严重度

### D3. 已知分支名不传，同一轮操作重复 `rev-parse`

- **文件**：`useGitOps.ts:97`、`:139`、`:108`、`:189`；`useGitHandlers.ts:86`
- **类型**：重复子进程调用

`Rev-parse --abbrev-ref HEAD` 是 pushStatus 与 workingTree 的共同前置。`RemoteOps.checkPushStatus` 已支持 `opts.branch` 跳过内部 `getCurrentBranch`（`RemoteOps.ts:452`），`WorktreeOps.getWorkingTreeStatus` 同样支持（`WorktreeOps.ts:46`）。但以下路径都**丢弃了已知分支名**：

```ts
// useGitOps.ts:94-100 —— branch 就是入参，却调无参版
async function switchBranch(id: string, branch: string) {
  await manager.switchBranch(resolveValidPath(project), branch)
  await Promise.all([loadWorkingTree(id), loadPushStatus(id)])   // ← 各发一次 rev-parse
}

// useGitOps.ts:139 —— 提交不改变分支名，workingTrees[id].branch 已在缓存
await Promise.all([loadWorkingTree(id), loadPushStatus(id)])
```

同样问题见 `stageItem` / `unstageItem`（经 `withProjectPath`，`:108`）、stash 系列（`:189`）、`doDiscard`（`useGitHandlers.ts:86`）。

**影响**：一次「暂存文件」产生 3 次 `rev-parse`（其中 2 次纯浪费）；提交后 2 次；切分支 2 次。

**修复**：分支名收归调度器缓存，`loadStatus` 内部解析一次并分发；写操作后复用 `workingTrees[id].branch`。

---

### D4. 卡片详情懒加载存在单飞缺口

- **文件**：`useCardData.ts:114`（`if (detailsLoaded) return`）→ `:118`（`detailsLoaded = true`，位于 `Promise.all` **之后**）
- **类型**：并发去重漏洞

```ts
let detailsLoaded = false
async function ensureDetailsLoaded() {
  if (detailsLoaded) return          // ← 两次并发调用都能通过
  logLoading.value = true
  await Promise.all([loadLog(), loadBranches(), loadStash(), loadTags()])
  detailsLoaded = true               // ← await 之后才置位
}
```

并发入口真实存在：`ProjectCard.vue:349-355`（Tab 切换 watch）与 `:359-364`（卡片首点）可在同一 tick 内连续触发（点击卡片的同时 Tab 已切换）。

**影响**：同一卡片瞬间并发两轮 `log + branches + stash + tags`（4 个 git 子进程翻倍）。

**修复**：改为「实例级布尔 + 在途 Promise」双守卫；跨实例去重由调度器单飞承担。

---

### D8. 批量进度计时器竞态（延迟 `end()` 无序号校验）

- **文件**：`useBatchProgress.ts:45-49`、`:53`、`:78`
- **类型**：状态竞态

```ts
function finish() {
  state.value = { ...state.value, done: true }
  timers.setTimeout(end, AUTO_HIDE_DELAY)   // ← 3s 后无条件清空
}
// runBatch: release() 在 finally，与 finish() 同一 tick
```

`runChain` 让下一批在上一批 `release()` 后立刻启动。若第二批在第一批的 3s 延迟窗口内 `start()`，第一批遗留的 `end()` 会把**第二批刚刚写入的进度直接清空**（表现为进度条闪现即消失）。

**对照**：`useRemoteProgress.ts:113-129` 的同类清理**有** `opSeq` 序号校验，此处缺失——是同一问题的既有正解未被复用。

**修复**：引入 `runSeq`，延迟 `end()` 前校验 `seq === runSeq`。

---

## 三、🟡 中严重度

### D1. 「项目状态查询」5 份并行实现

| # | 位置 | 语义 |
|---|---|---|
| 1 | `useGitOps.ts:57` | 无条件加载 pushStatus |
| 2 | `useGitOps.ts:63` | 无条件加载 workingTree |
| 3 | `useGitOps.ts:70` | 无条件双加载 + 共享 rev-parse |
| 4 | `useGitOps.ts:82` | **条件**加载（已有缓存则跳过）+ 共享 rev-parse |
| 5 | `useRefreshOps.ts:59` | 内联第五份 + `refreshRemotes` + `fetchFirst` |

3 与 4 的唯一差别是「是否跳过已缓存」，却各写一份 8 行实现。

### D2. 刷新三兄弟逻辑三写

`handleRefresh`（`useRefreshOps.ts:59-71`）内联复刻了 `handleRefreshWorkingTree`（`:79-86`）与 `handleRefreshRemoteStatus`（`:88-97`）的并集，三处**各自**调用 `manager.getBranch`，且「先 refreshRemotes 再 fetch 避免陈旧远程名」的竞态注释抄了 3 遍。

### D5. 首屏批量与卡片首点重复

首屏 200ms 定时器已批量加载 workingTree（`index.vue:769-774`）；用户此时点卡片会立即强制重刷一次（`ProjectCard.vue:359-364` → `useRefreshOps.ts:79-86`），无最小间隔守卫。原 `WorkingTreePanel` 的 2s 节流只覆盖自动刷新，不覆盖此路径。

### D6. 视图/上下文 watch 交叉重复

`onViewProject`（`index.vue:884-895`）同时改 `currentView` 与 `activeCategory`，两个 watch（`:802-806`、`:821-836`）各触发一次 `loadCurrentCategoryList`；`:852-855` 注释自认「仅作冗余兜底」；stats 视图路径在 `:839-842` 与 `:821-836` 交叉。目前靠 `loadingProjectIds` Set 兜底才不重复发。

### D7. 远程刷新两条重复网络路径

`handleFetchAll`（→`useRemoteProgress.fetchAllRemotes`→`fetchAllForProject`）与 `handleRefreshRemoteStatus`（→`loadPushStatus({fetchFirst:true})`→`RemoteOps.checkPushStatus`→`fetchAllForProject`）都会 fetch 全部远程，**无项目级互斥**：同时点击产生两轮网络 fetch。

### D9. 信号推送通道与父层加载并存

同一函数体内一半直调加载、一半标记信号，形成双通道：

- `useGitOps.ts:97-99`：直调 `loadWorkingTree/loadPushStatus` + `bumpCardRefresh(log, branches)`
- `useGitOps.ts:188-189`、`useGitHandlers.ts:131,136,170,177,188`：同模式

### D10. 信号机制自身 O(卡片数 × 域数) 开销

`useCardData.ts:164-180` 每卡片注册 **5 个** watch，getter 都读同一个 `cardRefreshSignals` 对象；`useGitOps.ts:36-40` 每次 bump **重建整个 Record** → 全部 M 张卡片 × 5 个 watcher 重新求值，而实际只有 1 张变脏。

---

## 四、重构后调度架构

```
                    ┌──────────────────────────────────────────┐
                    │  useProjectQueryScheduler（唯一调度权威） │
                    │                                          │
                    │  ① 单飞   inflight: Map<`id:kind`, Promise>│
                    │  ② 新鲜度 lastLoadedAt: Map<key, ts>       │
                    │  ③ 脏标记 dirty: Map<id, Set<kind>> + epoch│
                    │  ④ 分支名 branchCache: Map<id, branch>     │
                    └──────────────────────────────────────────┘
                       ▲          ▲           ▲            ▲
        ┌──────────────┘          │           │            └──────────────┐
        │                         │           │                           │
   useGitOps               useRefreshOps   useCardData            index.vue
   (写操作后标脏)           (显式 refresh)  (卡片域查询)            (视图 ensure)
        │                         │           │                           │
        └─────────────────────────┴───────────┴───────────────────────────┘
                                   │
                        GitPushManager → managers/* → GitExecutor（双池限流）
```

三档职责与旧机制对照：

| 关注点 | 旧实现 | 新实现 |
|---|---|---|
| 在途去重 | `loadingProjectIds` Set（index.vue 局部）+ 各函数无守卫 | 调度器 `inflight`（同 `id:kind` 共享 Promise） |
| 已加载判定 | `pushStatuses[id]` / `workingTrees[id]` 真值 + `detailsLoaded` 布尔 | `lastLoadedAt` 的 `has()` / `isFresh()` |
| 分支名复用 | 无（5 处各自 `getBranch`） | `branchCache` + `resolveBranch` 单飞 |
| 卡片重载通知 | `cardRefreshSignals` push Record + 5×M watch | `invalidate` 标脏 + 单 `epoch` watch |
| 自动刷新节流 | `WorkingTreePanel.lastRefreshStartedAt`（仅覆盖面板） | 调度器 `minIntervalMs`（统一覆盖） |

---

## 五、修复映射

| 编号 | 修复内容 | 落地文件 |
|---|---|---|
| D1 | 四份状态查询实现收敛为调度器 `loadStatus`（两档 `ensure`/`refresh` 语义） | `useProjectQueryScheduler.ts`、`useGitOps.ts` |
| D2 | 三个刷新函数共用同一 `refreshRemote` 管线，删除 3 处自写 `getBranch` | `useRefreshOps.ts` |
| D3 | 分支名收归 `branchCache`；写操作复用 `workingTrees[id].branch`；切分支 `setBranch` 回填 | `useProjectQueryScheduler.ts`、`useGitOps.ts` |
| D4 | 实例布尔 + 在途 Promise 双守卫（`detailsPromise`） | `useCardData.ts` |
| D5 | 卡片首点改 `ensureProjectStatus`（ensure 语义，已有缓存即跳过） | `ProjectCard.vue`、`index.vue` |
| D6 | `loadCurrentCategoryList` / `ensureStatsDataLoaded` 共用 `ensureStatusFor`，在途与已加载均由调度器去重；删除 `loadingProjectIds` | `index.vue` |
| D7 | `handleFetchAll` 与 `handleRefreshRemoteStatus` 共用 `refreshRemote` 单飞键（`remoteRefresh`），且不传 `force` 以共享同一轮网络请求 | `useRefreshOps.ts`、`useProjectQueryScheduler.ts` |
| D8 | `runSeq` 守卫延迟 `end()` | `useBatchProgress.ts` |
| D9 | 写操作统一为「标脏（`invalidate`）」，卡片按脏集消费重载 | `useGitOps.ts`、`useGitHandlers.ts`、`useCardData.ts` |
| D10 | 5×M watch → 单 `epoch` watch + `consumeDirty`（无脏域立即返回） | `useCardData.ts`、`useGitOps.ts` |

### 契约变更

- **`GitPushManager` 对外 API：不变**（`RemoteOps.checkPushStatus` 的 `fetchFirst` 保留，仅 UI 路径不再触发它，避免改 manager 公共面）。
- `useGitPush` 返回值：移除 `cardRefreshSignals` / `fetchAllRemotes`；新增 `scheduler` / `ensureProjectStatus` / `refreshProjectStatus`。
- `CARD_SERVICES_KEY` 契约（`types/cardServices.ts`）：`cardRefreshSignals: Ref<CardRefreshSignals>` → `scheduler: ProjectQueryScheduler`；`CardDataDomain` → `ProjectQueryKind`；`CardOps` 新增 `ensureProjectStatus` / `refreshProjectStatus`。`records.*` 形状不变（UI 状态，非调度状态）。

---

## 六、规范合规性检查

| 检查项 | 状态 | 说明 |
|---|---|---|
| 分层：类型+常量 / 纯函数 / 视图逻辑 | ✅ | 新增 `types/queryScheduler.ts`（契约）与 `composables/useProjectQueryScheduler.ts`（视图层 composable），未把调度逻辑塞进 `utils/` |
| 同一常量/函数被 ≥2 文件使用须提取 | ✅ | 调度契约独立成模块，切断 `cardServices ↔ composable` 循环引用 |
| 统一入口（定时器走 TimerRegistry） | ✅ | 未新增裸 `setTimeout`；`useBatchProgress` 仍走 `TimerRegistry` |
| 单文件行数上限 | ✅ | 新增调度器 225 行；`useGitOps` 260 → 264 行（净增来自注释与委托层），`useRefreshOps` 111 → 106 行 |
| SCSS 分离 | ✅ | 无样式改动 |
| i18n 无硬编码兜底 | ✅ | 无新增文案（`pnpm i18n:verify` 结果与改动前一致，4541 键对齐） |

---

## 七、验证记录

| 项目 | 结果 |
|---|---|
| `pnpm typecheck`（`vue-tsc --noEmit`） | ✅ 0 错误 |
| `pnpm i18n:verify` | ✅ 4541 键对齐，无新增键 |
| `pnpm validate:icons` | ✅ 通过 |
| ESLint（改动文件错误数，改动前 → 改动后） | 293 → 272（**无任何文件错误数上升**；两个新增文件为 0 错误） |
| `pnpm lint` / `pnpm vite build` | 按 `AGENTS.md` 由用户执行 |

> 说明：本轮**未**运行 `eslint --fix`。首轮曾运行，因其会重排无关代码块（使 `types/index.ts` 出现 182 行格式变动、`useRemoteProgress.ts` 出现 101 行），与本次语义改动无关，故已回退并要求逐处手改，最终 diff 仅含语义变更。

### 待用户手动验证

1. 首屏 → 立即点第一张卡片：日志/分支/stash/tag 正常，无重复 workingTree 查询（D5）。
2. 连点两次「全部刷新」：进度条不出现 `current > total`，不闪现即消失（D8）。
3. 切分支 / 暂存 / 提交 / stash：状态同步正确，`rev-parse` 调用次数下降（D3）。
4. 提交后 LOG 自动重载、workingTree 与 pushStatus 更新（D9/D10）。
5. 同一卡片同时点「Fetch」与「刷新远程状态」：仅一轮网络 fetch（D7）。
6. 视图来回切 list ↔ stats ↔ 智能视图：进度计数正确、无重复入队（D6）。
7. 暂停 git 操作 → 恢复：各视图数据补齐；行数统计缓存与过滤选择不丢。
8. 删除项目：卡片详情与远程状态缓存无残留。
9. 两个卡片同时展开不同 Tab：各自只重载自己的脏域（D10）。

---

## 八、已知限制与未纳入项

1. **多面板并存（dock + 浮动 tab）**：两个 `useProjectQueryScheduler` 实例 → 跨面板仍可能对同一项目重复发 git。属既有行为，本次不修（需跨渲染进程共享缓存，代价远大于收益）。
2. **`RemoteOps.checkPushStatus` 的 `fetchFirst` 分支保留**：为不改 manager 公共面而保留，UI 路径已不再使用（统一管线自行 fetch 一次）。
3. **`useConsistencyAudit` / `useRepoLinkAudit` / `useCommitAnalysis` / `useCodeReport` 未纳入**：它们的批量审计/分析各有独立的 `analyzing` 守卫与进度语义，属「批量任务编排」而非「项目状态查询」，混入调度器会污染单飞键空间。
4. **`WorktreePanel` 自动刷新的 800ms 防抖保留**：这是「合并连续 UI 事件」的防抖，与调度器的「最小重查间隔」是不同关注点（前者合并事件、后者抑制重复查询），刻意不合并。
5. **卡片卸载期间的在飞查询**：共享 Promise 仍会 resolve 并写入已卸载卡片的 ref 闭包（不渲染、无害），`recordCommitActivity` 副作用照旧触发——与改动前一致。
