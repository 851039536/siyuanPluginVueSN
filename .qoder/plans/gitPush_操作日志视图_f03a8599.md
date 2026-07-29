# gitPush 操作日志视图（log）

## Summary

在 [PanelHeader.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/PanelHeader.vue) 视图切换区（L14-L40）新增第三个 "log" 视图按钮，记录每个项目的 Git 操作历史：推送了什么（各平台成败与摘要）、拉取了什么、提交了什么（commit message）。

**核心架构决策**：
- **埋点位置**：composable 漏斗层——push/pull 全部路径收敛于 `useRemoteProgress` 的 `remoteOpAll`/`remoteOpSingle` 两个函数，commit 收敛于 `useGitOps.doCommit`，共 3 个插入点，且这三处已持有项目 id、action、逐平台结构化结果、commit message，零反查、零管理层改动
- **持久化**：`GitPushStorage` 新增 `opLogs` TypedStorage 槽位（key: `git-push-op-logs`）。由于 TypedStorage 是全量 JSON 读写，必须：环形上限（300 条）+ 防抖落盘（约 1s）+ 卸载时 flush
- **UI**：照搬 StatsPanel 模式——`v-if` 惰性渲染 + i18n prop + 数据 prop + 极简事件

## 类型与存储（types/）

### `src/features/gitPush/types/storage.ts`
1. 新增类型与常量（放在现有 `CommitLogEntry` 附近，遵循 DEFAULT_* 常量共置惯例）：
   - `GitOpAction` 联合类型：`"push" | "pull" | "commit"`（字面量联合，未来加 fetch/stash/tag 只需扩展此类型）
   - `GitOpLogPlatform` 接口：`{ key: string, label: string, ok: boolean, skipped: boolean, summary: string }`（逐平台结果，直接从 `PushOutputEntry` 投影，**不存 fullStdout/fullStderr**，防撑爆存储）
   - `GitOpLogEntry` 接口：`{ id: string, time: string(ISO), projectId: string, projectName: string, action: GitOpAction, ok: boolean, summary: string, message?: string(commit信息), platforms?: GitOpLogPlatform[] }`
   - `MAX_OP_LOG_COUNT = 300` 常量（参考 s3Backup 的 `MAX_LOG_COUNT` 先例）
2. `GitPushStorage` 类（L256-L281）：新增 `readonly opLogs: TypedStorage<GitOpLogEntry[]>` 字段，构造函数注册 `new TypedStorage(storage, "git-push-op-logs", [])`

### `src/features/gitPush/types/meta.ts`
3. 新增面板视图联合类型（消除 PanelHeader 与 index.vue 两处内联字面量重复，单一数据源）：
   ```ts
   /** 面板头部视图（列表/统计/操作日志） */
   export type PanelView = "list" | "stats" | "log"
   ```
   注意：与现有 `ViewMode`（列表筛选模式 all/needsPush/...）语义不同，不要混用。

### `src/features/gitPush/types/index.ts`
4. 重导出块补充：`GitOpAction`、`GitOpLogEntry`、`GitOpLogPlatform` 类型 + `MAX_OP_LOG_COUNT` 常量（来自 storage.ts），`PanelView` 类型（来自 meta.ts）

## 日志 composable（新建）

### `src/features/gitPush/composables/useOpLog.ts`（新建，约 100 行内）
文件头注释 + 职责：持有日志 ref 状态、加载/追加/清空/防抖持久化。

- 入参：`manager: GitPushManager`（经 `manager.storage.opLogs` 访问槽位，与 index.vue 已有的 `props.manager.storage.gitOpsPaused` 用法一致）
- `opLogs = ref<GitOpLogEntry[]>([])`
- `ensureLoaded()`：惰性首读（缓存 loadPromise 防并发重复加载）——**append 前必须先 ensureLoaded**，否则防抖 save 会用只含内存新条目的数组覆盖已存历史
- `appendOpLog(entry: Omit<GitOpLogEntry, "id" | "time">)`：`await ensureLoaded()` → 自动补 id（时间戳+随机后缀）/time → `unshift` → 超 `MAX_OP_LOG_COUNT` 截断 → 触发防抖 save（约 1s，单一定时器合并批量操作的密集写入）；整体 fire-and-forget，内部 try/catch 仅 `console.warn`，**日志失败绝不影响 git 操作主流程**
- `clearOpLogs()`：清空 ref + 立即 save
- `flush()`：立即落盘未保存缓冲；`onUnmounted` 中调用（清理防抖定时器 + flush）

## 埋点（3 处漏斗）

### `src/features/gitPush/composables/useGitOps.ts`
- 在 `useGitOps` 内实例化 `useOpLog(manager)`，将 `appendOpLog` 传入 `useRemoteProgress` 的 opts（L223 现有 `{ loadPushStatus, safeTimeout }` 增加一项）
- `doCommit`（L132-L144）：`manager.commit` 成功后 append `{ projectId: id, projectName: project.name, action: "commit", ok: true, summary: result首行, message }`；为记录失败，给 `manager.commit` 调用加 try/catch——catch 中 append 失败条目（summary 取错误首行）后**原样 rethrow**（保持 handleCommit 的现有错误处理不变）
- return 块透出 `opLogs`、`ensureOpLogsLoaded`（供视图切换加载）、`clearOpLogs`

### `src/features/gitPush/composables/useRemoteProgress.ts`
- opts 接口增加 `appendOpLog` 回调（保持本文件对 storage 零依赖）
- `remoteOpAll`（L116-L172）：L159 `buildOutputEntries` 产出后 append 一条——`action` 用入参、`ok` 取 entries 中任一非 skipped 平台 ok、`platforms` 由 entries 投影（丢弃 fullStdout/fullStderr，保留 skipped 标记）、`summary` 取首个非 skipped 平台摘要；catch 分支（L163-L168）也 append 失败条目
- `remoteOpSingle`（L175-L239）：成功路径 L211 与 catch 路径 L223 各 append 一条单平台条目（platforms 为单元素数组）

### `src/features/gitPush/composables/useGitPush.ts`
- return 块透出 `gitOps` 的 `opLogs / ensureOpLogsLoaded / clearOpLogs`

## 视图层

### `src/features/gitPush/components/PanelHeader.vue`
- L250：`defineModel<"list" | "stats">` 改为 `defineModel<PanelView>`（从 `../types` 导入）
- L39 后按现有按钮模式（L29-L39）新增第三个按钮：`active` 判 `'log'`、tooltip `i18n.logView`、图标 `mdi:history`、i18n 中文注释 `<!-- 按钮（tooltip："操作日志"） -->`

### `src/features/gitPush/index.vue`
- L468：`ref<"list" | "stats">("list")` 改为 `ref<PanelView>("list")`，注释同步更新；其余 currentView 引用点（L687/L702/L733）均为等值比较或赋值 list，三值化语义不变，无需改动
- L40 后新增（带中文区块注释 `<!-- ========== 操作日志视图 ========== -->`）：
  ```
  <LogPanel v-if="currentView === 'log'" :i18n="i18n" :logs="opLogs" @clear="confirmClearOpLogs" @view-project="onViewProject" />
  ```
- 从 `useGitPush` 解构 `opLogs / ensureOpLogsLoaded / clearOpLogs`
- 仿 L687-L690 的 stats watch，在同一 watch 中增加：`if (view === "log") await ensureOpLogsLoaded()`（惰性加载）
- 清空需二次确认（项目"清空操作统一确认提示"规范）：新增 `confirmClearOpLogs()`，复用现有 `showConfirm` 通用确认弹窗（L448）
- import LogPanel（L296 附近）

### `src/features/gitPush/components/LogPanel.vue`（新建，≤300 行）
照搬 StatsPanel 结构（props：`i18n` + `logs: GitOpLogEntry[]`；emits：`clear`、`viewProject`）：
- 空状态：无日志时居中显示 `mdi:history` 大图标 + `i18n.noOpLogs`
- 顶部工具条：日志条数 + 操作类型筛选（全部/推送/拉取/提交，本地 ref 筛选）+ 清空按钮（emit("clear")）
- 日志列表：**默认渲染最近 50 条 + "加载更多"按钮**（本地分页 ref，避免 300 条全渲染）；每条显示：时间（本地化短格式）、项目名（可点击 emit viewProject 跳转列表定位，复用 StatsPanel 的 viewProject 交互）、操作类型徽章（push/pull/commit 各配色）、成败状态点、摘要文本；push/pull 条目可展开显示逐平台结果（platform label + ok/skip/fail + summary）；commit 条目展示 message
- 模板所有 i18n 渲染点加中文注释；无任何硬编码中文兜底
- style 块双行导入：`@use "../styles/LogPanel.scss"` + `@use "../styles/index.scss"`

### `src/features/gitPush/styles/LogPanel.scss`（新建）
- 头部 `@use "./variables" as *` + `@use "./mixins" as *`（与 StatsPanel.scss L1-L2 一致）
- Codex 风格：边框卡片（禁 box-shadow）、`$radius-*`/`$spacing-*` Token；两级字号——条目主文本 `$font-size-xs`，时间/徽章/平台明细等辅助文字 `$font-size-2xs`；字体三要素全部用 Token

## i18n

### `src/i18n/zh_CN/gitPush.json` 与 `src/i18n/en_US/gitPush.json`
在 `gitPush` 嵌套对象内（listView/statsView 附近，两文件 L244-L245）同步新增键，例如：
- `logView`: "操作日志" / "Operation log"
- `noOpLogs`: "暂无操作记录" / "No operations yet"
- `opPush` / `opPull` / `opCommit`: "推送" / "拉取" / "提交" 及英文
- `clearLogs`: "清空日志"、`clearLogsConfirm`: "确认清空"、`clearLogsConfirmBody`: 确认正文
- `loadMoreLogs`: "加载更多"、`logFilterAll`: "全部"、`opSkipped`: "已跳过" 等面板文案

⛔ 禁止直接改 `zh_CN.json`/`en_US.json`（构建产物）。

## Test Plan

由用户自行验证（AI 不执行 build/lint）：
1. `npx tsc --noEmit` — PanelView 三值化后全库类型对齐
2. `pnpm i18n:verify` — 中英分片键对齐
3. 手工验证：推送/拉取/提交后切到 log 视图查看记录；重启插件后日志仍在（持久化）；清空需二次确认；连续多项目批量推送日志合并落盘不卡顿

## Dependencies

1. types（storage.ts + meta.ts + index.ts）→ 一切的前置
2. useOpLog.ts → 埋点（useGitOps / useRemoteProgress）的前置
3. i18n 键 → LogPanel / PanelHeader 模板的前置（项目禁 i18n 兜底）
4. PanelHeader 与 index.vue 的 PanelView 类型必须同一提交内改（defineModel 与父 ref 类型不一致会编译失败）
5. LogPanel + LogPanel.scss → index.vue 挂载的前置

## Risks and Mitigations

- **防抖窗口内崩溃丢日志**：`onUnmounted` flush；最多丢约 1s 日志，可接受
- **append 先于首读导致覆盖历史**：`appendOpLog` 内部先 `ensureLoaded()`（缓存 loadPromise），杜绝竞态
- **日志膨胀写放大**：环形 300 条 + 不存 fullStdout/fullStderr + 防抖合并批量写
- **与 ProjectCard 内 LOG 标签页（git commit log）语义混淆**：i18n 明确命名"操作日志"，数据源完全不同（插件操作记录 vs git log）
- **skipped 平台混入噪音**：platforms 保留 skipped 标记，UI 以"已跳过"弱化展示；条目级 ok 判定忽略 skipped 平台
- **日志写入拖慢 git 操作**：append fire-and-forget + 内部 try/catch，仅 console.warn

## Rejected Alternatives

1. **GitPushManager 门面层埋点（方案 A/B）**：门面 `commit(projectPath, message)` 只有路径没有项目 id/名称，需反查 ProjectStore；门面方法均为单行薄委托，包裹记录逻辑会污染委托层；composable 漏斗处数据（id、逐平台结构化结果、message）已齐备
2. **GitExecutor 底层埋点**：无项目/业务语义，会记录大量内部辅助命令（status/rev-parse 等）噪音
3. **新增 managers/OpLogStore.ts 类**：写入方只有 composable 层，独立 manager 类增加文件与装配成本；useOpLog composable 同时满足响应式 UI 与持久化职责（符合 Rule of Three——首个消费者不做过度抽象）
4. **本次即覆盖 fetch/stash/tag 操作**：超出需求（推送/拉取/提交）范围；`GitOpAction` 联合类型已预留扩展位，未来在对应漏斗加一行 append 即可
5. **每条日志立即落盘（s3Backup 现状模式）**：gitPush 批量推送场景下会造成密集全量 JSON 写放大，改用防抖合并