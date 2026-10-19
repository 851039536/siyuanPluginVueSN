# gitPush · 内存泄漏与「每次进入页面 CPU 暴涨」审查

> 审查对象：`src/features/gitPush/`（262 个文件），同时交叉核对 `src/utils/vueAppHelper.ts`、`src/utils/timerRegistry.ts`、`src/index.ts` 与思源前端 `addDock / Custom / Tab` 生命周期。
>
> 审查方式：静态阅读（read/grep/glob）+ 思源前端源码（Gitee `siyuan-note/siyuan@master`）交叉验证。
> 审查阶段**未执行**构建 / lint / 测试，**未修改**任何源码；修复阶段见文末「§8 修复记录」。
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

---

## 8. 修复记录（2026-10-19）

按本文档 P0 → P1 → P2 顺序落地。验证：`pnpm typecheck` 通过、`pnpm test` 全绿（34 文件 / 621 用例，含新增回归用例）。
`pnpm lint` / `pnpm build` 按仓库规范由用户执行。

### 8.1 P0-1 窗口 focus 双路刷新风暴

| 改动 | 文件 | 说明 |
|---|---|---|
| 删除每卡片 `window focus` 监听 | `components/ListView/WorkingTreePanel.vue` | 保留 `@pointerdown` 局部触发；窗口获焦统一由探测层负责 |
| focus 合并窗口 + 在途轮询合并 | `composables/useGitProbe.ts` | `FOCUS_MIN_INTERVAL_MS = 2000`；`roundInFlight` 使并发触发只跑一轮 |
| 探测轮加最小间隔节流 | `composables/useGitProbe.ts` | `loadStatus(..., { minIntervalMs: 2000 })`，与卡片自动刷新同口径 |
| 自动触发去 `force` | `useRefreshOps.ts` / `cardServices.ts` / `ProjectCard.vue` | `handleRefreshWorkingTree(id, { force: false })` 让单飞生效；手动刷新仍 `force` |

### 8.2 P0-2 进入页面的全量扫描风暴

| 改动 | 文件 | 说明 |
|---|---|---|
| 预筛 HEAD 改读 `.git/HEAD` 文件 | `useGitProbe.ts` | 每轮每项目 **0 次** `rev-parse`；文件缺失/读取失败才回退查询 |
| 建监听不再额外解析 HEAD | `useGitProbe.ts` | 2N → N 次 rev-parse；基线用 stat + 读文件建立（0 进程） |
| gitdir 解析缓存 + 限流并发 | `useGitProbe.ts` / `GitPushManager.ts` | `getGitDirCached`（5 分钟 TTL）+ `poolProcess` 并发 6 |
| 未展示项目首轮不查询 | `useGitProbe.ts` | 只建基线，避免「进入即对全部项目跑 3N 次 git」 |
| `ensureWatch` 在途去重 | `useGitProbe.ts` | `start()` 与 `syncProjects()` 同时触发只跑一次 |
| audit 改为进入统计视图 | `useRepoLinkAudit.ts` / `index.vue` | 去掉 `immediate`；`enabled = currentView === "stats"`；6 并发 + 卸载取消 |
| Markdown 扫描缓存 | `useMarkdownFiles.ts` | 按目录 mtime 缓存，N 卡挂载不再 N 次同步扫盘 |

### 8.3 P0-3 常驻轮询

| 改动 | 文件 | 说明 |
|---|---|---|
| 退避推进与「是否真查」解耦 | `useGitProbe.ts` | 预筛判无变化同样翻倍，收敛到 `maxIntervalMs`；失败轮不推进 |
| 面板真实可见性门控 | `index.vue` / `useGitProbe.ts` | `IntersectionObserver` + `checkVisibility()`；隐藏时不轮询，重新可见重置基准间隔 |
| 5 分钟重建不再清 gitdir 缓存 | `useGitProbe.ts` | 去掉每 5 分钟 N 次额外 rev-parse |
| `start()` 幂等 | `useGitProbe.ts` | 重复调用不重复注册 focus/blur 与重建链 |

### 8.4 P0-4 / P1 生命周期与泄漏

| 改动 | 文件 | 说明 |
|---|---|---|
| Dock 注册 `destroy` + `init` 幂等卸载 | `src/utils/vueAppHelper.ts` | 返回 `DockAppHandle`；`unmount()` 先 `app.unmount()` 再移除容器 |
| manager 持有并卸载 Dock；关 SQLite；释放索引 | `GitPushManager.ts` | `destroy()` 依次卸载 Dock/Tab → executor → store（`LineStatsStore.close()` / `CommitIndex.dispose()`） |
| `LineStatsStore.close()` | `managers/LineStatsStore.ts` | 关闭 `DatabaseSync`，避免重载累积句柄 |
| `CommitIndex.dispose()` + 段上限淘汰 | `managers/CommitIndex.ts` | 落地 `INDEX_MAX_PROJECT_SEGMENTS`（按 `analyzedAt` 最旧淘汰内存段 + 磁盘文件） |
| `GitExecutor` 销毁守卫 | `managers/GitExecutor.ts` | `destroyed` 后 `execGit`/`execGitStreaming` 直接拒绝，残留链无法再 spawn |
| `TimerRegistry` 触发即摘除句柄 | `src/utils/timerRegistry.ts` | 修复长会话 Set 无界增长 |
| audit 卸载取消 | `useRepoLinkAudit.ts` | `cancelled` 标记，卸载后不写回、不再发起 |
| 卡片懒加载降峰 | `useCardData.ts` / `ProjectCard.vue` | 首载不再发 `ls-remote` / 200 条 `--shortstat`，改 LOG/TAG 面板首次可见时懒加载；失败 2 次进入 30s 冷却 |
| `__gitPush` 挂载规范 | `features/gitPush/index.ts` / `src/index.ts` | 加入 `DESTROYABLE_KEYS`，去掉 `onunload` 特例与 `registerFeatures` 接收返回值 |

### 8.5 新增回归用例

- `useGitProbe.spec.ts`：预筛持续无变化时退避收敛到上限（空闲 0 进程）；未展示项目首轮不触发 `loadStatus`；`start()` 幂等只注册一次 focus/blur。
- `CommitIndex.multiProject.spec.ts`：段数超 `INDEX_MAX_PROJECT_SEGMENTS` 时按 `analyzedAt` 淘汰最旧，且内存段/磁盘文件同步清理。

### 8.6 仍建议真机复核

修复后仍建议按 §6 的三步测量复测：重点确认「关闭 Dock 后 git.exe 不再周期性出现」「从编辑器切回时不再出现 N+M 次突发」「反复开关 Tab 后 `.git-push-panel` 计数不增长」。
若首次进入仍有可感知峰值，属剩余的 N 次 gitdir 解析（首次冷缓存），可在设置中关闭「文件监听」或等待 5 分钟缓存生效后观察差异。

---

## 9. 补充修复：「需拉取」视图空白（2026-10-19 追加）

**现象**：切到智能视图「需拉取」，列表空白，看不到任何需拉取项目。

**根因（两个缺陷叠加）**：

1. **P0 — 视图补载清单漏了 `needsPull`**（`index.vue` 的 `watch(viewMode)`）：
   历史实现只对 `needsPush` / `uncommitted` 调 `ensureStatsDataLoaded()`。而「需拉取」判据是
   `pushStatuses[id].remotes[platform].behind > 0`（`useGitStats.ts`），该数据只有跑过
   `loadStatus`/`checkPushStatus` 才有。刚进面板直接点「需拉取」时 `pushStatuses` 为空 → 集合为空 → 空白。
   §8.2 的「未展示项目首轮不发 git」降峰措施会把该问题**放大**（此前探测层首轮会兜底填满状态）。
2. **P1 — `behind` 依赖 fetch 才有值**：`checkPushStatus` 是**纯本地比对** `refs/remotes/*`，
   该 ref 只在 `fetch` 时更新；默认配置网络轮询关闭 ⇒ 远程有新提交而本地从未 fetch 时，behind 恒为 0。

**修复**：

| 改动 | 文件 | 说明 |
|---|---|---|
| `needsPull` 纳入补载清单 | `index.vue` | `watch(viewMode)` 对其走专用 `ensureNeedsPullData()`；解除暂停分支同步覆盖 |
| 首次进入补一轮远程刷新 | `index.vue` | `refreshRemoteForNeedsPull()`：按项目串行 `scheduler.refreshRemote(id, { force: true })`（复用单飞管线 + 进度条），fetch 后重载状态回填 behind；单项目失败不阻断整轮 |
| 空态区分三种状态 | `index.vue` + i18n | 未 fetch：`needsPullNotFetched`；刷新中：`needsPullChecking`；已完成且为空：`needsPullEmpty` |
| 失败可重试 | `index.vue` | 整轮失败不置 `needsPullFetchCompleted`，重新进入视图会再试 |
| 模块可单测（顺带） | `useGitStats.ts` / `utils/platform.ts` | 导入由 `../types`、`../utils` 桶改为直连 `types/meta`、`types/storage`、`utils/platform`（纯模块），避免桶里的值导出把 `siyuan` 拉进 Node 测试环境 |

**新增用例**：`composables/useGitStats.spec.ts`（4 条）——`behind > 0` 必进 `needsPullProjects`、多平台 behind 逐个记录且合计正确、无 pushStatus 不误报、推/拉集合互不串味。

**验证**：`pnpm typecheck` 通过；`pnpm test` 35 文件 / **625 用例**全绿；`pnpm i18n:verify`（4619 leaf keys 中英对齐）与 `pnpm audit:encoding`（0 问题）通过。

---

## 10. 修正：§9 的「进入即全量 fetch」导致切视图卡死（2026-10-19 追加）

**现象**：§9 上线后，切到「需拉取」直接卡死（面板长时间无响应）。

**根因（上一版修复引入的三处错误）**：

1. **await 链里做全量网络 fetch**：`ensureNeedsPullData` 先 `await ensureStatsDataLoaded()` 再 `await runBatchWithProgress(全部项目 fetch)`，
   而 `watch(viewMode)` 又 `await` 它 ⇒ 视图切换被押在「N 个项目 × 网络往返」之后。单项目 fetch 超时上限 240s，N 个项目串下来就是分钟级假死。
2. **误用 `useBatchProgress.runBatch`**：它的 `runChain` 是**跨批次全局串行锁**，一批长网络任务会把后续「切分类 / 首屏加载 / 其他视图」的批次全部堵在锁后，放大为整面板卡死。
3. **`ensureStatsDataLoaded` 本身无缓存时也是 N×2 个 git 进程**（EDR 下单进程 0.25~1s），仍被放在渲染前的 await 上。

**修复原则**：**渲染不等网络，网络不占批次锁**。

| 改动 | 说明 |
|---|---|
| 后台远程检查 | `startNeedsPullRemoteCheck()` 用独立 `poolProcess`（并发 4）在后台跑，**不进 await 链**；单飞（`needsPullCheckPromise`）避免重复进入叠多轮 |
| 渲染预算 | `ensureStatsDataLoadedWithinBudget(2500ms)`：已缓存 `pushStatus` 的项目不等待；无缓存最多等 2.5s，其余转后台增量渲染 |
| 绕开批次锁 | 预算加载改用独立 `poolProcess`（并发 = git 并发设置），**不再走** `runProjectLoadBatch` → 不会占 `runChain` 阻塞其他批次 |
| 可中断 | 卸载时置 `needsPullAborted`，后台检查的剩余项目不再发网络请求；预算定时器走 `TimerRegistry` 并在 `onUnmounted` 清理 |
| 状态机修正 | 只有「确实尝试过至少一个项目且至少成功一个」才置 `needsPullCheckedThisSession`，避免全失败后永不重试；空态三态（检查中 / 已检查为空 / 未检查）逻辑同步 |

**验证**：`pnpm typecheck` 通过；`pnpm test --hookTimeout 60000` 35 文件 / 625 用例全绿；`pnpm audit:encoding` 0 问题；`pnpm i18n:verify` 通过。

**经验**（勿再犯）：任何「进入视图时触发的网络操作」都必须满足三条——
① 不 `await` 在视图切换链上；② 不占用跨批次串行锁；③ 并发受独立上限约束且可中断。

---

## 11. 再修正：进入「需拉取」CPU 打满 + 久等无数据（2026-10-19 追加）

用户复报：切到「需拉取」**CPU 直接打满**，随后缓慢下降，但**等很久也拿不到数据**。

### 11.1 严谨验证：判据链本身是正确的

先用真实 git 做端到端验证，**排除**「解析/语义错误导致拿不到数据」：

| 验证项 | 结果 |
|---|---|
| `for-each-ref --format='%(ahead-behind:HEAD)'` 字段顺序 | 与 `rev-list --left-right --count <remote>...HEAD` **完全一致**；输出 `<behind> <ahead>` |
| fetch 前 behind | `0`（本地尚不知道远程领先）→ 这正是首次进入为空的原因 |
| fetch 后 behind | `2` ✅ 判据链正确 |
| 本地领先场景 | ahead=1 / behind=2，方向未颠倒 ✅ |

结论：**数据链没有 bug**，问题全在「进入视图时做了什么」。

### 11.2 三个确凿缺陷

1. **进入视图并发跑两批全量（我引入，CPU 打满主因）**：
   `ensureStatsDataLoadedWithinBudget`（N×loadStatus）+ `startNeedsPullRemoteCheck`（N×refreshRemote，其内部又是 fetch + for-each-ref + rev-parse）
   **同时进行** ⇒ 单项目 5~6 个进程 × N × 2 批同时起飞。另外 `ensureProjectStatus` 会连 workingTree 一起查，而本视图只判 ahead/behind，**白付一倍进程**。
2. **fetch 失败被显示成「暂无需要拉取」（我引入，久等无数据的观感来源）**：
   `needsPullCheckedThisSession` 只在「至少成功一个」时置位，而失败项目的 behind 恒为 0 ⇒ 界面显示「所有项目均已是最新」，用户既看不到数据也不知道是失败。
3. **fetch 用默认 240s 超时**：不可达远程（失效地址/防火墙/私有网络）时每个项目挂满 4 分钟，整批表现为「永久没结果」。

### 11.3 修复

| 改动 | 文件 | 说明 |
|---|---|---|
| 本地加载只查 `pushStatus` 单域 | `index.vue` | 视图判据只需 ahead/behind；不再调 `ensureProjectStatus`（省掉 workingTree 那一半进程） |
| 两批严格串行（先本地后网络） | `index.vue` | 本地 ensure 完成（或预算到期）后才发起后台网络检查，杜绝 3N 级并发 |
| 失败计数 + 空态四态 | `index.vue` + i18n | 新增 `needsPullPartialFailed`：`有 N 个项目远程检查失败，结果可能不完整`，不再把「查不到」伪装成「没有」 |
| 后台 fetch 短超时 20s | `index.vue` / `RemoteOps.ts` / `queryScheduler.ts` | 新增 `fetchAllForProject({ timeoutMs })` 与 `refreshRemote({ timeoutMs })` 透传；后台检测传 20s，快速失败计入失败数 |
| 去掉多余的 `force` | `index.vue` | `refreshRemote` 内部 fetch 后本就 force 重查 pushStatus；外层 `force` 只多加一次 `rev-parse`/项目 |
| 新增 Quick fetch 入口 | `RemoteOps.ts` | `fetchRemoteQuick()`（短超时、不抛错返回布尔），供后续其他后台检测复用 |

### 11.4 新增端到端回归用例

`managers/fetchBehind.git.spec.ts`（5 条，**真实 git + 真实 GitExecutor**）：
fetch 前 behind=0 → fetch 后 behind=2 → 本地领先 ahead=1/behind=2 → 无 upstream 时映射为空 → 不可达远程抛可捕获错误。
这条用例锁住「fetch 后 behind 必须变化」这一不变量，防止重构退回「永远 0」。

### 11.5 验证

`pnpm typecheck` 通过；`pnpm test --hookTimeout 90000` **36 文件 / 630 用例全绿**；`pnpm audit:encoding` 0 问题；`pnpm i18n:verify` 通过。

### 11.6 仍可能慢的真实原因（需用户侧确认）

若修复后**首次**进入仍需等数秒，那是**网络 fetch 本身耗时**（每个项目一次网络往返，串行并发 4）。
这是「需拉取」必须付的成本——除非改成「只展示本地缓存 + 手动点『检查远程』」。
若希望完全不等网络，可把 `ensureNeedsPullData` 里的 `startNeedsPullRemoteCheck()` 改为按钮触发。

---

## 12. 用户真实环境取证 + 短路 fetch（2026-10-19 追加）

### 12.1 用用户真实数据取证

读取 `E:\siyuan2\data\storage\petal\siyuan-plugin-vite-vue-sn\git-push-projects`（64 个真实项目），
对每个真实仓库执行 `for-each-ref %(ahead-behind:HEAD)`：

| 项目 | behind | ahead | fetch 实测 |
|---|---|---|---|
| **snVideoEditor** | **78** | 0 | github ✅ 8s、cnb ✅ 1.2s、gitee ✅ 2.3s、**gitea ❌ 仓库不存在** |
| MerryTest | 2 | 2 | origin ❌ 连不上 `10.175.5.82:3000`、est ❌ 远程名损坏（`rtt`） |

**结论**：数据确实存在（snVideoEditor 落后 78 个提交），判据与解析均正确；
「显示无需拉取」有两个叠加原因：
1. 用户当时运行的构建产物时间戳为 `12:21`，早于 §11 的修复（属旧代码）；
2. 单项目「部分远程失败」在旧实现下会被当作「无更新」呈现，缺少失败提示。

### 12.2 短路 fetch（按用户明确定义修正）

用户澄清后的**正确定义**（此前一版理解反了，已修正）：

> gitee 发现**无需拉取**后，其他平台（github 等）不执行；
> gitee 显示**需要拉取**时，其他平台**也要执行**。

实现（`RemoteOps.fetchUntilMoved`）：

| 前一平台结果 | 行为 |
|---|---|
| **需要拉取**（behind > 0） | **继续执行**后续平台（其他镜像可能有额外提交；不能停） |
| **无需拉取**（behind === 0） | **跳过后**续平台（已是最新，省网络往返） |
| **失败**（失效/无权限/超时） | 视为未知，继续执行下一个平台 |

优先级（`PULL_CHECK_REMOTE_ORDER`）：`gitee → cnb → github → gitea`（按国内可用性）。
注意与 `PLATFORM_META` 的 UI 展示顺序解耦，后者不动。

**语义收益**：常见情况（gitee 已最新）只需 1 次网络往返；gitee 有更新时才继续，保证不漏其他平台。
用户真实仓库 snVideoEditor：gitee 落后 78 ⇒ 继续 github/cnb（完整判定）；若日后 gitee 追上则自动短路。

接线：`refreshRemote(id, { shortCircuit: true, timeoutMs: 20000 })` → `manager.fetchUntilMoved()`；
仅「需拉取」检测使用，用户手动 Fetch/刷新仍走完整 `fetchAllForProject`（必须更新全部远程）。

### 12.3 「没有数据显示」的根因与修复（重要）

`ListView` 用 `v-if="emptyHint"` / `v-else` 渲染——**只要 `emptyHint` 非 null，卡片列表整体不渲染**。
早期实现中 needsPull 一进入就返回「正在检查…」，导致：

- 检查期间（可达数十秒）**列表被整块遮住**，即便已有 behind>0 的项目也看不到；
- 用户观感 = 「等很久、什么都没有」，与本轮报告完全一致。

修复：`listEmptyHint` 先判 `filteredGroups.value.length > 0` → **有命中项目就返回 null**，
让列表正常渲染；只有真正空列表时才显示检查中/失败/无更新提示。

同时把首屏预算从 2500ms 收紧到 **800ms**：该步骤只做本地 git 查询（不联网），
先出本地已能算出的 behind，网络检查完全后台化。

### 12.4 新增用例

- `utils/platform.spec.ts`（6 条）：平台优先级排序、部分配置、无配置、顺序表完整性、与 `getProjectRemoteNames` 解耦。
- `managers/fetchBehind.git.spec.ts`（7 条，真实 git + 真实 GitExecutor）：判据链 5 条 + 短路语义 2 条
  （**首个平台需拉取 ⇒ 后续继续执行**；**首个平台无更新 ⇒ 短路，attempted===1**）。

### 12.5 验证

`pnpm typecheck` 通过；`pnpm test --hookTimeout 90000` **37 文件 / 638 用例全绿**；编码审计 0 问题；i18n 对齐通过。

> ⚠️ 提醒：插件 **必须重新 `pnpm build`/`pnpm dev` 部署**后才会生效；本轮排查发现用户环境中的
> `index.js` 时间戳落后于源码修复时间，是「改了但现象不变」的直接原因之一。
