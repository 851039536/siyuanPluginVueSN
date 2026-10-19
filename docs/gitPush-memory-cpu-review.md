# gitPush · 内存泄漏与「每次进入页面 CPU 暴涨」审查

> 审查对象：`src/features/gitPush/`（262 个文件），同时交叉核对 `src/utils/vueAppHelper.ts`、`src/utils/timerRegistry.ts`、`src/index.ts` 与思源前端 `addDock / Custom / Tab` 生命周期。
>
> 审查方式：静态阅读（read/grep/glob）+ 思源前端源码（Gitee `siyuan-note/siyuan@master`）交叉验证。
> **未执行**构建 / lint / 测试，**未修改**任何源码。
>
> 结论口径：凡「只能由运行时确认」的条目均标注 **待运行时验证**，不与「已确认缺陷」混排。

---

## 0. 结论摘要

1. **「每次进入页面 CPU 暴涨」的主因不是典型内存泄漏，而是「进入/切回窗口即触发全量 git 刷新风暴」**：
   - 窗口获焦 → `useGitProbe.handleFocus()` 立刻对**全部项目**跑一轮（每项目至少 1 次 `git rev-parse HEAD`，每 3 轮强制真跑 `git status`）；
   - 同时**每张已渲染的项目卡片**（默认「工作区」Tab 常驻）各挂一个 `window` focus 监听，获焦后各自 `force` 重查工作区 + 推送状态（`force` 绕过调度器单飞）；
   - 结果：一次「切回思源 / 点进面板」≈ **N（探测）+ M（卡片）** 量级的 git 子进程突发，N=20 时约 40~80 次进程创建（本机单次 git 冷启动 0.25~1.2s），CPU 在十几秒内被打满。
2. **首次进入（或每次新开独立 Tab / 浮动窗口）还有一次初始化风暴**：`onMounted` 里 `useRepoLinkAudit` 对全部项目**并发**跑 `git remote -v`（N 次），`gitProbe.start()` 的 `ensureWatch` 对每个项目**串行**跑 2 次 `rev-parse`（2N 次），15s 后首轮轮询再对每项目跑约 3 次 git（3N 次）。
3. **常驻轮询与设计文档不符**：README 声称「index mtime 未变 → 0 次进程」「面板不可见不轮询」，实现是：
   - index 未变时仍每轮**每项目 spawn 一次** `git rev-parse HEAD`（`useGitProbe.ts:278`）；
   - `isActive()` 只看 `document.visibilityState`，**Dock 隐藏后照常轮询**（`index.vue:798-801`）；
   - 被预筛跳过的轮次不推进退避（`useGitProbe.ts:334-341`），间隔会**卡在 15s 基准**而不是退到 120s。
4. **真实的内存/资源泄漏有 5 处**，最严重的是 **Dock 面板永不 unmount**（`createVueDockApp` 没给 `addDock` 注册 `destroy`、`init` 无幂等保护）：插件重载 / 禁用 / 布局重建后，探测定时器链、`fs.watch`、`window` 监听全部残留，且 `GitExecutor` 没有 `destroyed` 守卫，残留链在卸载后**仍能继续 spawn git**。dev 模式下每次热重载叠一条，CPU 会阶梯式上涨。
5. 其余泄漏：`manager.destroy()` 不关 `LineStatsStore` 的 SQLite 句柄；`CommitIndex` 内存段无上限（`INDEX_MAX_PROJECT_SEGMENTS` 定义了却从未使用）；`useRepoLinkAudit` 卸载后不取消在飞的 N 条 git；`TimerRegistry` 已触发的句柄不从集合移除。

---

## 1. 先分清两件事：CPU 峰值 vs 内存泄漏

| 现象 | 性质 | 是否随「进入次数」累积 | 本报告条目 |
|---|---|---|---|
| 切回窗口/点进面板瞬间 CPU 拉满十几秒 | 每次进入都发生的**重活** | 否（每次固定成本，除非泄漏叠加） | P0-1、P0-2 |
| 面板打开后 CPU 周期性抬高、进程管理器里 `git.exe` 反复出现 | 常驻轮询成本（含实现缺陷） | 否（持续成本） | P0-3 |
| 每点一次卡片/每切换一次 Tab 卡顿、进程突发 | 懒加载查询集合过大 | 否 | P1 |
| 越用越卡、JS 堆/DOM/监听器只增不减、插件重载后更糟 | **真正的资源泄漏** | **是** | L1~L5 |

---

## 2. P0：CPU 暴涨的根因（按与「进入页面」症状的匹配度排序）

### P0-1 窗口 focus 双路刷新风暴 —— 每次「切回/点进」最直接的解释

**A. 探测层：一次 focus = 全项目一轮**

`src/features/gitPush/composables/useGitProbe.ts:429-443`

```ts
function handleFocus(): void {
  if (destroyed || isPaused()) return
  const cfg = getConfig()
  const away = blurredAt > 0 ? Date.now() - blurredAt : 0
  blurredAt = 0
  cancelPollTimer()
  void pollRound()          // ← 立即对 projects.value 全量跑一轮
  ...
}
```

- `pollRound()`（同文件 `:346-355`）只在 `isPaused() || !isActive()` 时跳过，**没有「正在跑」的在途守卫**；`runPollRoundNow()`（`:561-569`）是 `for ... await` **串行**遍历全部项目。
- `pollOnce()` 调 `scheduler.loadStatus(id, { mode: "refresh" })`（`:310`）时**不传 `minIntervalMs`**，绕过 UI 刷新用的 2s 节流；`loadStatus` 内部还会连带 `checkPushStatus`（`for-each-ref`），即每个项目 2~3 次 git。
- 每次 focus 都会触发；连续快速切窗还会叠加多条并发轮询链（`pollTimer` 在轮中为 `null`，`cancelPollTimer()` 是 no-op）。

**B. 卡片层：每张卡一个 focus 监听，获焦即 N 卡齐发 git**

`src/features/gitPush/components/ListView/WorkingTreePanel.vue:377-393`

```ts
function handleAutoRefreshTrigger() {
  if (autoRefreshTimer !== null) return
  if (props.gitOpLoading || props.refreshingWorkingTree) return
  if (Date.now() - lastRefreshStartedAt < AUTO_REFRESH_MIN_INTERVAL_MS) return  // 仅 2s/卡
  autoRefreshTimer = autoRefreshTimers.setTimeout(() => {
    autoRefreshTimer = null
    ...
    emit("refreshWorkingTree")
  }, AUTO_REFRESH_DEBOUNCE_MS)
}
onMounted(() => window.addEventListener("focus", handleAutoRefreshTrigger))
```

- 卡片默认 Tab 就是「工作区」（`ProjectCard.vue:235` `ref("worktree")`；`CardTabs.vue:5-11` `Tabs lazy` 使默认面板常驻），所以**每张已挂载卡片都有一个 window focus 监听**。
- 获焦后 `emit("refreshWorkingTree")` → `ProjectCard.vue:49` → `useRefreshOps.handleRefreshWorkingTree` → `scheduler.loadWorkingTree(id, { force: true })`（`useRefreshOps.ts:137-145`）。`force: true` **绕过调度器单飞**，与 probe 的同一项目查询无法合并。
- 节流 `AUTO_REFRESH_MIN_INTERVAL_MS = 2000` 是**逐卡片**的：离开 2 秒以上再切回，N 张卡会同时全部命中。

**结论**：只要「进入页面」包含「SiYuan 窗口重新获得焦点」（从编辑器/浏览器切回、或点进面板），每次都会产生约 `N + M` 量级的 git 进程突发。这是与「每次进入都暴涨」最吻合的路径。

**修复（P0）**
1. 删除 `WorkingTreePanel` 里的 per-card `window focus` 监听；窗口获焦收敛为**面板级唯一入口**（`index.vue` 或 manager），用既有 `runBatchWithProgress` 批量刷新当前可见项目。
2. `useGitProbe` 增加轮询在途合并守卫：`roundInFlight` + `roundPending`（重复触发只合并为一次），`handleFocus` 传入最小间隔（如 2s）。
3. `pollOnce` 的 `loadStatus` 补 `minIntervalMs`；`handleRefreshWorkingTree` 的自动触发路径改 `force: false`（单飞去重），仅手动刷新保留 `force`。

---

### P0-2 面板初始化 / 新开页签：一次性全量扫描风暴

`src/features/gitPush/index.vue:835-852`（`onMounted` 链路）：

```ts
await loadProjects()
...
await loadProbeConfig()
gitProbe.start()          // ← :849
```

叠加三处全量工作：

| 来源 | 次数 | 证据 |
|---|---|---|
| `useRepoLinkAudit` immediate watch，对全部项目**并发** `git remote -v` | N | `useRepoLinkAudit.ts:75-79`、`:58`；`ProjectStore.ts:291-293` |
| `gitProbe.start()` → `ensureWatch()`，每项目**串行** `rev-parse --absolute-git-dir` + `rev-parse HEAD` | **2N** | `useGitProbe.ts:129-148`；`WorktreeOps.ts:385-391,410-416` |
| 15s 后首轮轮询（`lastHead/firstRun` 必然真查）：`status --porcelain=v2` + `checkPushStatus` | ≈ 3N | `useGitProbe.ts:259-266,273-276,301-343` |

- `ensureWatch` 是 `for ... await` **串行**的（`:129-148`），N=20 时就是 40 次连续进程创建；README 记录单次 `git rev-parse HEAD ≈ 250ms`，EDR/杀软环境可放大到 0.5~1s，合计 10~40 秒持续 churn。
- 并发重复：`watch(projectProbeSignature, () => gitProbe.syncProjects())`（`index.vue:867-870`）会在 `loadProjects()` 写回时触发一次 `ensureWatch()`，与 `start()` 的 `ensureWatch()` 可能**重叠**（`ensureWatch` 无 in-flight Promise 去重），首挂载可能发出约 2 倍 rev-parse。
- 触发范围：打开 Dock（首次，见 L1 说明 SiYuan 的 Custom 只创建一次）、**每次新开独立 Tab**、**每次插件重载**、切换项目分类后卡片首次挂载（另有 `scanMarkdownFiles` 同步扫盘 × 卡片数）。
- 独立 Tab 每次关闭即 unmount、重开即重新全量扫描 —— 如果用户的「进入页面」实际是「每次打开 gitPush 页签/浮动窗口」，这就是主因。

**修复（P0）**
1. `ensureWatch` 增加模块/manager 级 in-flight Promise 去重；建监听改为限流并发（`poolProcess(projects, 4~10)`）而不是串行。
2. gitdir / HEAD 解析结果上提到 manager 做短 TTL 缓存（项目增删/改路径时失效，`syncProjects` 已有失效点），二次进入零 git 调用。
3. `useRepoLinkAudit` 不应在 setup `immediate`，改为「首次进入统计视图」时执行 + `gitOpsPaused` 时跳过。
4. 卡片挂载的 `scanMarkdownFiles`（`useCardData.ts:287-289` → `useMarkdownFiles.ts:61-100`，同步 `readdirSync` + 逐文件 `statSync`）改为 manager 级按「路径」缓存，或延迟到用户点开 Markdown 弹窗。

---

### P0-3 常驻轮询：预筛名不副实 + 面板隐藏不停 + 退避失效

`src/features/gitPush/composables/useGitProbe.ts:220-288`（`needStatusQuery`）：

```ts
if (skipped >= MAX_SKIPPED_ROUNDS) return true      // :232-233 每 3 轮强制真查
// ① index mtime 未变 → 继续走 ②
if (entry.lastHead === undefined) { await refreshHeadBaseline(...); return query() }
const head = await manager.getHeadHash(resolveValidPath(project))   // :278 ← 每轮 spawn 一次
if (head !== entry.lastHead) { entry.lastHead = head; return query() }
return skip()
```

- 预筛只省掉 `git status`，**HEAD 判据仍是每个项目每轮一次 `git rev-parse HEAD`**（`WorktreeOps.ts:385-391`，无缓存）。
- 被跳过的轮次 `queried === false`，而退避只在 `queried === true` 时推进（`:334-341`）→ 轮询节奏停在 `poll.intervalMs = 15000`（`types/probeConfig.ts:89-105`），**不是** README:358 所述的「15s→30s→60s→120s」。
- `scheduleRebuild()` 每 5 分钟还会 `gitDirCache.clear()` 并清空 `entry.gitDir`（`:471-490`），下一轮每项目再补一次 `rev-parse`。
- `index.vue:798-801`：

```ts
function isProbeActive(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden"
}
```
Dock 被隐藏/切到别的 Dock 时 `document.visibilityState` 仍是 `visible` → **探测永远不停**。README:360「面板不可见 / git 全局暂停时不轮询」与实现不符。

**量化（N=20，已稳态）**：每 2 分钟约 2 轮 × 20 次 rev-parse + 每 6 分钟一轮 20 × (status+pushStatus) ≈ **每分钟约 10~20 次 git 进程创建**，全天候；面板越隐藏越容易被误认为「后台没在跑」。

**修复（P0）**
1. HEAD 判据改为**读 `.git/HEAD` 文件文本**（`fs.readFileSync`，微秒级、0 spawn，只需比较文本是否变化），或由第 1 层 `GitDirWatcher` 的 HEAD 事件维护 `lastHead`；只有 watcher 不可用时才回退 `rev-parse`。
2. 退避推进与「是否真查」解耦：被预筛跳过也按「无变化」推进 `interval`；或把强制真查改为**按时间**（如每 5 分钟一次）而非按轮。
3. `isProbeActive` 纳入面板可见性：由 Dock/Tab 的 init/destroy + SiYuan `addDock` 的 `update` 回调维护「活跃面板计数」，隐藏即暂停轮询、重新可见时 `probeNow()` 补一轮；或至少用挂载根元素的 `checkVisibility()` / `isConnected`。

---

### P1 卡片交互的查询放大（"点一下卡一会儿"）

`ProjectCard.vue:3` 根节点挂了 `@click.capture="handleCardClick"`（`:379-382`）：

```ts
function handleCardClick() {
  void ops.ensureProjectStatus(props.project.id)
  void ensureDetailsLoaded()
}
```

首次点击任一卡片任意位置（含按钮）→ `ensureDetailsLoaded`（`useCardData.ts:184-212`）：

- 并发 4 个本地 git：`log / branches / stash / tags`；
- 后台再补 `conflicts`、`loadRemoteTags`（**每远程 1 次网络 `git ls-remote --tags`**）、`loadLogStats`（`git log -N --shortstat`，源码注释实测 200 条约 2.3s）。
- 失败不置 `detailsLoaded`，**每次点击都会重试整组**。
- `useCardData` 在 `onMounted` 时还会消费父层脏标记（`:280-284`）并可能 force 重载。

**修复（P1）**：首载只拉当前激活 Tab 需要的域；`loadRemoteTags` 延迟到打开 TAG 面板；`loadLogStats` 延迟到 LOG 面板可见/悬停；失败加重试上限。

---

### P2 派生计算的全量重算（次要）

`pushStatuses / workingTrees` 是深响应式 `ref<Record>`（`useProjectQueryScheduler.ts:49-51`），每写一个项目都会让 `useGitStats.projectStats`（`useGitStats.ts:58-210`，O(N) 单次遍历 + 排序）失效并重算；批量加载 N 项目 ≈ O(N²) 次派生计算，并连带 `groupedProjects → visibleGroups → filteredGroups → ListView` 重渲染。N 为数十时中等，可与 P1 一起优化（`shallowRef` + 手动触发或按需聚合）。

---

## 3. L：真正的内存 / 资源泄漏

### L1【最严重 · 已确认缺陷】Dock 面板永不 unmount（跨功能，13 个 Dock 共用）

`src/utils/vueAppHelper.ts:64-101`：

```ts
plugin.addDock({
  config: {...}, data: {}, type,
  init: function (this: { element?: Element }) {
    const container = document.createElement("div")
    ...
    const app = createApp({ setup() { return () => h(component as any, {...}) } })
    app.mount(container)                 // ← 只 mount
    this.element?.appendChild(container)
    // Dock 的 Vue 实例生命周期交给思源 dock 管理，卸载时随 dock DOM 移除后被 GC   ← 该假设不成立
  },
})
```

- **没有传 `destroy`**：思源 `addDock` 的签名明确支持 `destroy?: (this: Custom) => void`（`node_modules/siyuan/siyuan.d.ts:725-739`），未注册 → Dock 被移除时 Vue `app.unmount()` 永远不会被调用。
- **`init` 无幂等保护**：没有「先 unmount 旧实例」的守卫（独立 Tab 路径反而有：`GitPushManager.ts:534-551` 的 `mountTabPanel` 首行 `unmountTabPanel()` + `registerTabModel` 注册了 `destroy`，可对照）。
- 后果：`index.vue:854-858` 的 `onUnmounted(() => { ...; gitProbe.destroy() })` **不会执行**，而 `useGitProbe.destroy()`（`useGitProbe.ts:571-582`）是唯一释放 `fs.watch`、`TimerRegistry`、`window focus/blur` 监听的入口。`GitPushManager.destroy()`（`GitPushManager.ts:503-507`）也完全不碰 Dock app。

**泄漏规模**：每个残留面板实例 = 每项目 3~8 个 `fs.watch`（`GitDirWatcher.ts:66-75`，N=20 可达 160 个句柄）+ 一条 15s 轮询链 + 一条 5min 重建链 + window 监听 + 整棵 Vue 组件树（含全部卡片与 watcher）。插件重载/禁用/更新、布局重建后逐次累积。

**关于「是否每次打开 Dock 都重建」**（运行时确认点）：
- 已核对思源源码（`app/src/layout/dock/index.ts` `toggleModel`）：Dock 面板**首次显示**时才创建 `Custom`（`toggleModel` → `new Tab(...)` → `plugin.docks[type].model({tab})` → `new Custom(...)` → 构造函数内调 `init`），之后隐藏只是切 class，`data-id` 不删，**再次显示不会重新 init/mount**。
- 因此纯「隐藏→显示」不会累积；**会累积的是插件重载/禁用后新面板叠加旧面板**（旧面板因 L1 未卸载）。dev 模式 `pnpm dev` 每次热重载都会叠一条，CPU 阶梯上升。

**修复（P0，改公共工具收益最大）**：`createVueDockApp` 内保存 `app/container`，抽 `unmount()`（`app?.unmount()` + `container?.remove()`）；`init` 首行先 `unmount()`；`addDock({ ..., destroy: unmount })`；`GitPushManager` 保存句柄并在 `destroy()` 中先卸载 Dock。需回归其余 12 个使用方是否依赖「面板常驻」语义（`statistics`、`docAnalysis` 等）。

---

### L2【已确认缺陷】`manager.destroy()` 覆盖不全 + `GitExecutor` 无 destroyed 守卫

- `GitPushManager.ts:503-507`：

```ts
destroy() {
  this.writeLock.destroy()
  this.executor.destroy()
  this.unmountTabPanel()
}
```
未清理：`commitIndex`（内存段）、`lineStatsStore`（SQLite 句柄）、Dock Vue app（L1）。
- `LineStatsStore.ts` 无 `close()`，而 `PluginDatabase.close()` 已存在（`src/utils/sqliteDb.ts:452-460`）；`src/utils/sqliteDb.ts:195-217` 每次 `openPluginDatabase` 新建 `DatabaseSync`。每次插件重载泄漏一个 SQLite 连接（及 `-wal/-shm` 句柄）。
- `GitExecutor.destroy()`（`GitExecutor.ts:393-409`）只 kill 当前进程/清队列，**没有 `destroyed` 标志**，`execGit`（`:168-300`）入口也不检查 → L1 泄漏的旧探测链在插件卸载后**仍能继续 spawn git**（读操作不过写锁，不会被打断）。
- `CommitIndex`：`segments / loaded / fileLinesByProject` 只增不减（`CommitIndex.ts:93-107`）；`types/indexCache.ts:96` 定义了 `INDEX_MAX_PROJECT_SEGMENTS = 40` 但**生产代码零引用**（仅注释/spec 提到）。`getIndexStatus()`（`GitPushManager.ts:452-482`）会把**全部项目段** `ensureLoaded` 进内存后才返回计数。

**修复（P1）**：`LineStatsStore` 加 `close()`，`manager.destroy()` 里 close 并置空缓存；`GitExecutor` 加 `destroyed` 守卫；`CommitIndex` 实现淘汰（按 `analyzedAt` 最旧，复用 `withProjectLock`），`getIndexStatus` 查完即释放段。

---

### L3【已确认缺陷】`useRepoLinkAudit` 无视图门控、无暂停判断、无取消

`composables/useRepoLinkAudit.ts:54-79`：

```ts
async function runAudit() {
  if (auditing.value) return
  ...
  const settled = await Promise.allSettled(projects.value.map((p) => auditProject(p)))  // ← N 个 git remote -v
  ...
}
watch(() => projects.value.map(...).join("|"), () => { void runAudit() }, { immediate: true })
```

- 在根组件 setup 即执行（与当前视图无关），结果只被统计视图消费；
- 没有 `onUnmounted` 取消：关闭面板 / 切 Tab 后在飞的 N 条 git 继续跑完，并把结果写回已卸载组件的 ref；
- 与探测层重复读同一批仓库，互不单飞。

**修复（P1）**：改为首次进入统计视图时触发 + 暂停时跳过；`AbortController`（可参考 `useConsistencyAudit.ts` 的既有范式）；与 probe 共享 `poolProcess` 节流；结果按项目签名做会话级缓存。

---

### L4【已确认缺陷 · 小】`TimerRegistry` 已触发句柄永不从集合移除

`src/utils/timerRegistry.ts:20-24`：`setTimeout` 只 `this.timers.add(handle)`，回调触发后不 `delete`。`useGitProbe` 每轮轮询/重建都会留下一个 number（长会话数千条，CPU 无关、纯内存缓慢增长）。建议包装回调：触发时先 `this.timers.delete(handle)` 再执行。

---

### L5【已确认缺陷 · 结构】`probe.start()` 非幂等 + Dock/Tab 双实例

- `useGitProbe.start()`（`:452-465`）无 `started` 守卫：重复调用会重复 `addEventListener("focus"/"blur")`、重复 `scheduleRebuild` 链，而 `destroy()` 只 remove 一次。
- Dock 1 个常驻实例 + 每次打开独立 Tab 一个新实例 → 两套 `useGitProbe` / scheduler / TimerRegistry，共享同一个 `GitExecutor` 池；所有刷新路径翻倍（`docs/gitPush-query-scheduling-review.md:245` 已记录「跨面板不去重」为既有限制，但 probe 全量扫描放大了代价）。
- 模块级 `tabRegistered`（`GitPushManager.ts:95-96,512-531`）生命周期长于 manager：插件重载后新 manager 因 flag 为 true 跳过 `addTab`，而 SiYuan 侧旧的 tab init 闭包仍持有**旧 manager** → 页签可能挂到旧实例（旧 executor 被 destroy 但仍可 spawn git，见 L2）。

**修复（P1）**：`start()` 加 `started` 守卫（先 remove 再 add）；把 `tabRegistered` 挂到 `plugin` 实例或移除；长期看应把探测上提为 manager 单例（面板只订阅），使多面板自然共享一套探测。

---

## 4. 已排除的误报（避免过度修复）

| 项 | 结论 | 证据 |
|---|---|---|
| 监听器不配平 | 主要路径均配平 | `index.vue:836/855`（document click）、`useCardMenu.ts:62-86`、`WorkingTreePanel.vue:389-393`、`ListViewToolbar.vue:148-155`、`CandlestickSection.vue:279-294`、各 Dialog 的 keydown、`useGitProbe.ts:462/573` 均成对，capture 参数一致 |
| 常驻 rAF / CSS 动画泄漏 | 无 | 全模块无自循环 rAF（仅一次性，卸载时 cancel）；无限 CSS 动画只绑定 loading 态，结束即消失 |
| 裸 `setInterval` | 无 | gitPush 内唯一 `setInterval` 在 `OutputPanel.vue`，走 `TimerRegistry` + `onUnmounted clearAll` |
| `useProjectQueryScheduler` 队列堆积 | 无 | 无定时器/rAF/队列；`inflight` 在 `finally` 出队（`:66-90`），`clearProject` 清键（`:283-295`）。已知弱点：无 AbortSignal，卸载后 in-flight 仍会 resolve 并写 ref |
| `GitDirWatcher` 内部按项目重复 add | 无 | `watch()` 首行 `unwatch`（`:87-88`）；`unwatch` 清 timer + `close()` 全部 watcher；`destroy()` 遍历全部（`:134-147`）。句柄多只因**面板实例数**（L1） |
| `GitExecutor` 正常路径进程/abort 泄漏 | 未见 | 完成回调递减计数、`delete` 进程、移除 abort 监听（`:215-227`）；destroy 拒绝并清空双队列（`:393-409`）。弱项：`execFile` 同步抛错时可能漏减计数（概率极低，**待验证**）；Windows 上 SIGTERM 不保证杀 git 派生子进程 |
| `dockPreload` 重复预载 | 无 | gitPush 未注册 `registerDockPreload`（全仓仅 statistics 使用） |
| 深 watch 大数组 | 无 | 仅 `CloneLogPanel.vue:78`（克隆日志）与 `SettingsDialog.vue:568`（小对象） |
| `v-for` key | 稳定 | 主列表 `project.id`、TAB id、提交 `entry.hash` |

---

## 5. 建议的修复顺序

| 优先级 | 改动 | 文件 | 预期收益 |
|---|---|---|---|
| P0-1 | 删除 per-card `window focus` 监听；面板级唯一 focus 入口 + 批量刷新 + 最小间隔；probe 加在途合并守卫；自动刷新路径去 `force` | `WorkingTreePanel.vue`、`index.vue`、`useGitProbe.ts`、`useRefreshOps.ts` | 直接消除「每次切回」的 N+M 进程风暴 |
| P0-2 | 预筛 HEAD 判据改读 `.git/HEAD` 文件；跳过轮次也推进退避；隐藏面板暂停轮询 | `useGitProbe.ts` | 常驻 CPU 降到近零，修复与 README 的偏差 |
| P0-3 | `ensureWatch` in-flight 去重 + 限流并发；gitdir/HEAD 短 TTL 缓存；audit 延迟到统计视图 | `useGitProbe.ts`、`GitPushManager.ts`、`useRepoLinkAudit.ts` | 首次进入/新开 Tab 的 3N~6N 进程风暴压缩到 ≤1N |
| P0-4 | `createVueDockApp` 注册 `destroy` + init 幂等卸载；manager 卸载 Dock | `src/utils/vueAppHelper.ts`、`GitPushManager.ts` | 消除插件重载/禁用后的探测链与 fs.watch 泄漏（13 个功能共同受益） |
| P1 | `manager.destroy()` 关 SQLite 句柄；`GitExecutor` destroyed 守卫；`CommitIndex` 淘汰 | `GitPushManager.ts`、`LineStatsStore.ts`、`GitExecutor.ts`、`CommitIndex.ts` | 卸载后不再残留 git 进程 / 句柄 / 无界内存 |
| P1 | `useRepoLinkAudit` 取消 + 门控 + 缓存 | `useRepoLinkAudit.ts` | 卸载后 N 条在飞 git 立即停止 |
| P1 | 卡片首载按激活 Tab 懒加载；`ls-remote`/`shortstat` 延迟 | `useCardData.ts`、`ProjectCard.vue` | 首次点击的 7~10 进程降到 2~3 |
| P2 | `TimerRegistry` 触发即移除句柄；`probe.start()` 幂等；`tabRegistered` 挂 plugin | `timerRegistry.ts`、`useGitProbe.ts`、`GitPushManager.ts` | 长会话内存缓慢增长、重复初始化 |

---

## 6. 在真机上 3 步确认主因（建议先做，再改代码）

1. **是否泄漏**（DevTools Console，主窗口 `Ctrl+Shift+I`）：
   ```js
   document.querySelectorAll(".git-push-panel").length                        // 期望恒为 1
   document.querySelectorAll(".vp-dock-root").length                          // 期望恒为 1
   getEventListeners(window).focus?.length ?? 0                               // Chrome DevTools 专有
   ```
   反复「关闭/打开 Dock」10 次 + 「打开/关闭独立 Tab」10 次，每次记录。数值单调上升 = 确认 L1（Dock 重建/未卸载）；恒定 = Dock 只 init 一次，主因回到 P0-1/P0-2。

2. **哪条路径在 spawn git**（任务管理器/Process Explorer，过滤 `git.exe`）：
   - 首次进入后 30s 内：预期约 3N~6N 次（P0-2）；
   - 关掉面板静置 3 分钟：预期仍周期性出现（P0-3，且可确认隐藏未暂停）；
   - 从浏览器/编辑器切回 SiYuan（离开 >2s）：预期一次 N+M 次突发（P0-1）。

3. **堆/监听器是否累积**（DevTools Performance monitor / Memory）：
   反复进入 10 次后看 `JS heap size`、`DOM Nodes`、`Listeners` 是否回到基线；单调上升即 L1/L3/L4 之一，再配合第 1 步的 `.git-push-panel` 计数定位。

---

## 7. 不确定项（需要运行时确认）

1. **Dock 是否会在特定操作下重建 Custom**：源码显示隐藏/显示不重建；但「布局重置 / 工作区切换 / 插件重载」会重建，且当前实现重建后旧 app 不卸载（L1 确认缺陷）。用户侧「每次进入」的具体动作会改变首要根因的排序。
2. `GitExecutor.run()` 中 `execFile` 同步抛错导致信号量计数漏减的概率（静态阅读无法排除）。
3. Windows 上 `SIGTERM` 对 git 子进程树的实际效果。
4. P0-1/P0-2 的 CPU 幅度取决于项目数、磁盘类型、杀软/EDR；本报告给出的是**进程次数**，不是实测 CPU 百分比。
