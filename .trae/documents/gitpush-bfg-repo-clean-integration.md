# gitPush 集成 BFG Repo-Cleaner：仓库体检 + 历史清理

## Summary

在 gitPush 功能内新增第 8 个面板视图「仓库清理（repoclean）」，两阶段集成 BFG Repo-Cleaner：

- **阶段 1（纯 git，零新依赖）**：仓库体检报告 — 扫描 `.git` 体积 + 可达大文件 Top 50 列表
- **阶段 2（Java 运行时）**：BFG 清理向导 — 大文件清理 / 按名删除文件·文件夹 / 敏感文本全历史替换，走 mirror 裸仓库安全工作流（bundle 备份 → clone --mirror → BFG → gc → 回写原仓库）

**结论先行**：BFG 与现有 CommitRuleCheck **零功能重叠**（BFG 是 blob 内容级清理，不做提交信息规则校验、不能改写单条提交信息），纯增量能力，无任何现有功能需要替换。现有 `rebuildHistoryWithNewMessage` 的 commit-tree 重写、CAS update-ref 模式是可借鉴的基础设施，保留不动。

## Current State Analysis

### 现有架构（探索确认）

| 设施 | 位置 | 状态 |
|---|---|---|
| 视图切换 | [PanelHeader.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/common/PanelHeader.vue) 7 按钮 + `PanelView` 类型（[meta.ts L214](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/types/meta.ts#L214)） | 追加即可 |
| git 执行 | `GitExecutor.execGit(cwd, args, signal?, timeoutMs?, onOutput?, options?)`，execFile + 双池限流 + abort + maxBuffer 10MB | 直接复用 |
| 写锁 | `ProjectWriteLock.runExclusive(path, fn)`，GitPushManager 所有写操作已包裹 | 直接复用 |
| 历史重写先例 | [WorktreeOps.ts](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/WorktreeOps.ts) `rebuildHistoryWithNewMessage`（commit-tree + CAS update-ref + 临时目录 mkdtemp/rmSync + isInRebaseState/脏工作区前置检查） | 模式可复制 |
| 强推远端 | `GitPushManager.forcePushToAll(id)` 已存在 | 直接复用 |
| 流式日志 | `useCloneLog` + `CloneLogPanel.vue`（\r 刷新、200 行截断） | 直接复用 |
| 外部进程先例 | ffmpeg/yt-dlp 路径探测、useScriptRunner spawn 管理（windowsHide/taskkill） | 模式可复制 |
| 下载先例 | `s3Client.download`（node https 流式写盘） | 模式可复制 |
| 持久化 | `TypedStorage` 槽位（storage.ts GitPushStorage 类） | 追加槽位 |
| 缓存失效 | `invalidatePushStatusCacheByPath`（rewriteCommitMessage 后调用模式） | 复制同一调用模式 |

### 缺口（需新建）

- Java 运行时探测（项目零先例）；BFG jar 下载分发；mirror 工作流编排；大文件 blob 扫描。

## Proposed Changes

### 阶段 1：仓库体检报告（纯 git）

#### 1.1 `types/meta.ts` — 追加类型

```ts
// PanelView 联合类型追加 "repoclean"（注释同步更新）

// ── 仓库清理视图（RepoCleanOps 产出 / RepoCleanPanel 消费）──
export interface RepoBlobItem {
  hash: string   // blob 完整 hash
  path: string   // 最后出现的路径（rev-list --objects 输出）
  size: number   // 字节
}
export interface RepoScanResult {
  packSize: number      // .git 打包体积（count-objects size-pack，字节）
  looseSize: number     // 松散对象体积
  objectCount: number   // 可达对象总数
  topBlobs: RepoBlobItem[]  // 最大 blob Top 50（降序）
  oversizedCount: number    // 超过阈值的 blob 数
  scannedAt: string         // ISO
}
export interface RepoCleanPrefs {
  projectId: string     // 上次选中项目（"" = 第一个项目）
  thresholdMb: number   // 大文件阈值（默认 10）
}
```

同步在 `types/index.ts` 的 `export type { ... } from "./meta"` 列表中追加这 3 个类型。

#### 1.2 `managers/RepoScanOps.ts`（新建，~150 行）

- `scan(projectPath, thresholdMb, topN = 50): Promise<RepoScanResult>`
  - `git count-objects -vH` → 解析 `size-pack` / `size`（"12.50 MiB" 人类可读 → 字节）
  - `git cat-file --batch-check --batch-all-objects --unordered` → 全部对象 `<hash> <type> <size>`（无需 stdin）
  - `git rev-list --objects --all` → 可达 hash→path 映射（树对象无路径）
  - 三者 join：过滤 `blob` 类型 + 可达 → 按 size 降序取 Top N + 计数超阈值项
  - `timeoutMs` 传 120000（大仓库）；输出超 maxBuffer 10MB 时抛出带中文指引的错误（"仓库对象过多，体检不适用"）

#### 1.3 视图组件 `components/RepoCleanPanel/`（新建目录，自包含）

- `index.vue`（~120 行）：props 仅 `{ i18n, manager, projects }`，内部持有扫描状态 + `manager.storage.repoCleanPrefs` 持久化偏好（仿 CodeReportPanel 单项目选择模式，不与其他视图共享状态故不抽 composable，避免主面板 index.vue 986 行继续膨胀）
  - 空态分支（无项目 / 未扫描）→ Toolbar → 总览卡片（体积 + 对象数 + 超阈值计数，数值用 `$vp-mono` + `tabular-nums`）→ LargeBlobSection → 「历史清理」入口按钮（打开 CleanWizardDialog，阶段 2）
- `RepoCleanToolbar.vue`（~80 行）：项目 Select + 阈值 Select（1/5/10/50/100 MB）+ 扫描按钮（loading 态）+ 状态文案（仿 RuleCheckToolbar）
- `LargeBlobSection.vue`（~100 行）：Top 50 表格（大小 / 路径 / 占 .git 体积百分比条形，`usePagedList` 每页 20 分页，仿 ViolationListSection）

#### 1.4 挂载与入口

- [gitPush/index.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/index.vue)：report 视图块（L104-118）后追加 `<RepoCleanPanel v-if="currentView === 'repoclean'" :i18n="i18n" :manager="manager" :projects="projects" />`；`watch(currentView)` 不自动扫描（面板自持有结果，手动触发）
- [PanelHeader.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/common/PanelHeader.vue)：report 按钮（L104-114）后追加 repoclean 按钮 — `mdi:broom`（**已验证存在于本地 MDI 集**）、`:title="i18n.repoCleanView"`

#### 1.5 样式 `styles/RepoCleanPanel.scss`（新建）

- gitPush 范式：卡片 `surface` 凸出、面板底色 `background`、1px `--b3-border-color` 分隔线代替卡片边框、过渡 0.12s ease、数值 `$vp-mono`、字号 `$font-size-xs`/`$font-size-2xs` 两级、禁 box-shadow/letter-spacing

#### 1.6 i18n（`src/i18n/zh_CN/gitPush.json` + `en_US/gitPush.json`，`gitPush` 嵌套对象内追加，中英同步）

阶段 1 键（~15 个）：`repoCleanView`、`repoCleanNotRun`、`repoCleanNoData`、`repoCleanPackSize`、`repoCleanLooseSize`、`repoCleanObjectCount`、`repoCleanOversized`、`repoCleanTopBlobs`、`repoCleanThreshold`、`repoCleanScanning`、`repoCleanScannedAt`、`repoCleanBlobSize`、`repoCleanBlobPath`、`repoCleanShare`、`repoCleanEmpty`…

### 阶段 2：BFG 清理执行

#### 2.1 `types/meta.ts` — 追加类型

```ts
export interface BfgRuntimeState {
  javaOk: boolean; javaVersion: string; javaPath: string
  jarOk: boolean; jarPath: string; jarVersion: string
}
export interface BfgCleanPlan {
  stripBiggerThanMb: number      // 0 = 不启用 → bfg --strip-blobs-bigger-than
  deleteFileGlobs: string[]      // → bfg --delete-files "{g1,g2}"
  deleteFolderGlobs: string[]    // → bfg --delete-folders "{...}"
  replaceRules: string[]         // "原文" 或 "原文==>替换值" → 临时规则文件 --replace-text
}
export interface BfgCleanResult {
  sizeBefore: number; sizeAfter: number   // count-objects 字节
  backupPath: string                       // 备份 bundle 路径
  durations: Record<string, number>        // 各阶段耗时 ms
}
export interface BfgPrefs { javaPath: string; jarPath: string }  // 路径覆盖（空 = 自动）
```

#### 2.2 `types/storage.ts` — GitPushStorage 追加 2 个槽位

```ts
readonly repoCleanPrefs: TypedStorage<RepoCleanPrefs>   // "git-push-repoclean-prefs"
readonly bfgPrefs: TypedStorage<BfgPrefs>               // "git-push-bfg-prefs"
```

#### 2.3 `managers/BfgOps.ts`（新建，运行时层 ~250 行）

- 常量：`BFG_VERSION = "1.15.0"`；主源 `https://repo1.maven.org/maven2/com/madgag/bfg/1.15.0/bfg-1.15.0.jar`，备源 GitHub Release 同版本
- `detectJava(customPath?)`：解析顺序 `bfgPrefs.javaPath` → `JAVA_HOME/bin/java(.exe)` → PATH `java`；探测 `execFile(java, ["-version"], { timeout: 5000, windowsHide: true })`（**版本串在 stderr**，解析 `openjdk version "x.y.z"`）；返回 `{ ok, version, path }`
- `getJarPath()`：`bfgPrefs.jarPath` 覆盖 → 默认缓存 `<workspace>/data/storage/petal/<plugin.name>/bin/bfg-1.15.0.jar`（工作区根用 `getWorkspaceDir()`，参考 [settingsBackup.ts L56](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/utils/settingsBackup.ts#L56) 的路径拼接）
- `downloadJar(onProgress?)`：`getNodeHttp().https` GET → 跟随 30x 重定向 → 流式写临时文件 → rename 原子落位；content-length 进度回调；主源失败自动切备源，均失败抛错并提示手动下载 + `bfgPrefs.jarPath` 兜底
- `runBfg(jarPath, javaPath, args, cwd, onOutput)`：`execFile(java, ["-jar", jarPath, ...args], { timeout: 600000, maxBuffer: 10MB, windowsHide: true })`，输出流回调（UI 侧 CloneLogPanel 已有截断，无需再节流）

#### 2.4 `managers/RepoCleanOps.ts` — 追加清理编排（阶段 1 的 scan 也在此类）

`cleanRepo(projectPath, plan, callbacks: { onStep, onOutput }): Promise<BfgCleanResult>`，**六步工作流**（全程只读原仓库工作区，回写阶段才动引用）：

1. **前置检查**：`isInRebaseState` 拒绝；`getWorkingTreeStatus().hasChanges` 拒绝（复用 WorktreeOps 现有实现）
2. **备份**：`git bundle create <插件数据目录>/bfg-backups/<项目名>-<时间戳>.bundle --all`（单文件全量备份，可用 `git clone <bundle>` 恢复；**每项目保留最近 3 份**，超出删除）
3. **镜像**：`git clone --mirror <projectPath> <tmpdir>/mirror.git`（本地克隆含全部本地引用；对象 hardlink 共享安全——git 对象不可变，镜像内 gc 只 unlink 镜像侧）
4. **清理**：组装参数（多 glob 合并为单值 `"{g1,g2}"`——BFG fileMatcher 单值语义；replaceRules 写临时规则文件）→ `java -jar bfg.jar <args> mirror.git`（流式输出回调；**保持 BFG 默认 HEAD 保护，不暴露 --no-blob-protection**）
5. **压缩镜像**：mirror 内 `git reflog expire --expire=now --all` + `git gc --prune=now --aggressive`
6. **回写原仓库**：
   - `git fetch <mirror.git> "+refs/heads/*:refs/bfg-clean/heads/*" "+refs/tags/*:refs/bfg-clean/tags/*"`（抓到临时命名空间）
   - 逐分支 `git update-ref refs/heads/<b> refs/bfg-clean/heads/<b> refs/heads/<b>`（**CAS 旧值校验**，复制 rebuildHistoryWithNewMessage 模式）；逐标签同理
   - 当前分支 `git reset --hard`（同步 index/worktree；HEAD 受 BFG 保护，内容理论不变）
   - 删除临时命名空间引用（`update-ref -d`）
   - 原仓库 `git reflog expire --expire=now --all` + `git gc --prune=now`（本地瘦身；不带 --aggressive 提速）
7. `sizeAfter` 统计 + `finally rmSync(tmpdir, { recursive: true, force: true })`（敏感规则文件随临时目录销毁）

`onStep(step)` 上报六步（backup/mirror/bfg/gc/sync/done）供 UI 步骤条；各步记录耗时。

#### 2.5 `GitPushManager.ts` — 接线

```ts
// 构造：this.bfgOps = new BfgOps(plugin, storage); this.repoCleanOps = new RepoCleanOps(executor, bfgOps)
async scanRepoObjects(projectPath, thresholdMb)          // → repoCleanOps.scan
async getBfgRuntime(): Promise<BfgRuntimeState>          // → bfgOps.detectJava + getJarPath 探测
async downloadBfgJar(onProgress?)                        // → bfgOps.downloadJar
async runBfgClean(projectPath, plan, callbacks) {
  // writeLock.runExclusive 包裹 + 完成后 invalidatePushStatusCacheByPath（复制 rewriteCommitMessage L413-419 模式）
}
```

#### 2.6 `CleanWizardDialog.vue`（`components/RepoCleanPanel/` 下，自包含 ~300 行，props 仅 `{ i18n, manager, project }`）

四段式单弹窗（v-if 阶段切换，不复用 ConfirmDialog）：

1. **策略表单**：阈值 Select（含"不启用"）/ 删除文件 glob 输入 / 删除文件夹 glob 输入 / 替换规则 textarea（每行一条，支持 `原文==>替换值`，默认替换 `***REMOVED***`）；至少一项才可继续
2. **前置检查清单**：工作区干净 / 非 rebase / Java 可用 / jar 就绪，各一行状态图标；缺失项内联按钮（下载 jar 带进度）或安装 Java 指引；**破坏性警告**（历史重写、协作者需重新克隆、远端需强推、HEAD 最新提交受保护不清理）+ 红色 danger 确认按钮
3. **执行中**：六步步骤条（含当前/总步骤）+ `CloneLogPanel` 流式日志 + `useStatusBarTask` 状态栏任务
4. **结果**：前后体积对比（`$vp-mono`）+ 备份 bundle 路径 + `[强推远端]` 按钮（触发现有 `forcePushToAll` 流程）+ 提示"远端强推后建议执行 fetch --prune 完成本地瘦身"

表单控件用 shadcn-vue `<Input>`/`<Select>` `size="small"`；模板每个 i18n 键上方加中文注释。

#### 2.7 其余修改

- `styles/RepoCleanPanel.scss` 追加向导样式（遮罩 `rgba(0,0,0,0.5)` 无 backdrop-filter、fade + scale 0.98、`z-index: 10000`）
- i18n 阶段 2 键（~30 个）：`bfgTitle`、`bfgStrategy`、`bfgStripBigger`、`bfgDeleteFiles`、`bfgDeleteFolders`、`bfgReplaceRules`、`bfgCheckWorkspace`、`bfgCheckJava`、`bfgCheckJar`、`bfgDownloadJar`、`bfgWarnDestructive`、`bfgStepBackup`…`bfgStepDone`、`bfgResultBefore`、`bfgResultAfter`、`bfgBackupPath`、`bfgForcePush`、`bfgRunning`、`bfgFailed` 等
- `src/features/gitPush/README.md` 补充仓库清理视图一节
- **图标**：`mdi:broom`（视图按钮）、`mdi:shield-lock-outline`、`mdi:database-remove-outline`（向导）— 三者均已验证存在于本地 `@iconify-json/mdi` 集，内联 Icon 用法与现有按钮一致，无需改 `FEATURE_ICONS`

## Assumptions & Decisions

| 决策 | 选择 | 理由 |
|---|---|---|
| 功能替换 | **无** | BFG 与提交信息规则检查正交，零重叠 |
| 范围 | 两阶段（体检先落地零依赖，BFG 后置） | 用户已确认 |
| jar 获取 | Maven Central 主源自动下载 + GitHub 备源 + `bfgPrefs` 手动路径兜底 | 用户已确认；repo1.maven.org 国内可达性较好 |
| UI 位置 | 新增第 8 个 PanelView `repoclean`，按钮排在 report 之后 | 用户已确认；不动现有按钮顺序 |
| BFG 工作流 | mirror 裸仓库路线（官方推荐），回写用 fetch 命名空间 + CAS update-ref | 复制项目既有 CAS 安全模式；不直接在原仓库跑 BFG |
| 备份策略 | `git bundle --all` 持久化到插件数据目录，每项目保留 3 份 | 单文件全量可恢复，比临时目录删除更安全 |
| HEAD 保护 | 保持 BFG 默认，不暴露 `--no-blob-protection` | 安全优先 |
| 超大仓库 | rev-list 输出超 10MB maxBuffer 时报错并提示 | 个人笔记仓库规模可接受 |
| 本地 gc | 回写后跑一次 `reflog expire + gc --prune=now`（非 aggressive） | 平衡瘦身效果与耗时；远端强推后仍需 fetch --prune 才完全瘦身（UI 提示） |
| Java 输出 | `-version` 版本串在 stderr | 探测实现需注意 |

## Verification

1. `npx vue-tsc --noEmit` — 类型检查（含 `_Registered`/PanelView 联合类型一致性）
2. `pnpm i18n:verify` — 中英键对齐
3. `pnpm validate:icons` — 图标注册有效性（本次无新增注册映射，预期通过）
4. 用户自行执行：`pnpm lint` + 真机验证：
   - 体检：选一个真实项目扫描，核对 Top 大文件与 `git count-objects -vH` 数值
   - 清理：在**测试仓库**跑全流程（建议先只用阈值策略），验证：六步步骤条与日志、前后体积变化、`git clone <bundle>` 可恢复备份、清理后 `git log` 历史完整、当前分支工作区无异常
   - 强推：结果页触发强推远端，确认远端历史已清理
