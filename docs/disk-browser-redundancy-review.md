# 磁盘浏览器模块 —— 冗余重复专项审查报告

审查对象：`src/features/diskBrowser/`（`index.ts` + `index.vue` + 4 个 `.vue` + 1 个 composable + 工具层 + 5 个 `.scss`，重构前**15 个文件 / 2082 行**）
对照范围：`src/components/`（共享组件库）、`src/utils/`（共享工具层）
审查依据：`AGENTS.md § 共享组件库使用规则（强制）`、`AGENTS_ARCH.md § Composable 提取` / `§ 单文件行数上限`、`AGENTS_STYLE.md § SCSS 必须分离到 styles/ 目录` / `§ Dock 面板侧边栏间距`
审查日期：2026-09-21
整改状态：**✅ 已全部实施**

---

## 一、结论摘要

| 类别 | 项数 | 最高严重度 | 说明 |
|---|---|---|---|
| 真实功能缺陷 | 3 项 | **P0** | 磁盘枚举命令已被系统移除（F1）、解析脆弱（F2）、打开路径不判返回值（F3） |
| 自建同类控件 | 2 项 | P1 | 自建进度条（F4）、面包屑原生 button（F5） |
| 自造复杂度 / 冗余机制 | 1 项 | P1 | 缓存状态整套机制（F6） |
| 视图与渲染重复 | 3 项 | P1 | 磁盘/收藏夹双份渲染（F8）、标题与刷新双份（F9）、侧栏未定宽（F10） |
| 规则红线 | 2 项 | P1 | 子组件重复引入整份 `index.scss`（F11）、读取失败与空目录不可区分（F7） |
| 死代码 / 硬编码 | 3 项 | P2 | 11 个无用 i18n 键（F12）、可提取纯函数与重复格式化（F13）、超时常量与中文兜底（F16） |
| 无障碍 | 1 项 | P2 | 可点击行均不可键盘访问（F14） |

**总体判断**：本模块的 **composable 分层与持久化（`TypedStorage` + 收藏夹）是可用的**，`formatDate` 等纯函数也已正确外置。但存在三个层面的问题：

1. **可用性缺陷（最严重）**：磁盘枚举依赖 `wmic`，而该命令**已被 Windows 11 24H2 从系统中移除**（本机实测 `logicaldisk - Alias not found`、`wmic /?` 返回 `Access denied`）。`getDiskInfo()` 因此**恒返回 `null`**，`useDiskBrowser.ts:150/155` 静默回退到 `getDefaultDisks()` —— 用户看到的是 **C:–H: 六个并不存在的盘符**，且全部没有容量。也就是说这块 UI 在当代 Windows 上**已经是坏的**，只是坏得「看起来像在工作」。
2. **自造复杂度**：同文件内已实现 1 小时缓存，却又额外维护一整套「缓存剩余时间」状态机（`computeCacheStatus` / `isCacheValid` / `CacheData` / `CacheStatus` / `CACHE_EXPIRY_TIME`，约 60 行）并渲染两处倒计时标签。这是纯增的复杂度，不带来任何用户价值。
3. **UI 层绕过共享组件库**：磁盘用量条自建（与 `ProgressBar` 职责重合）、面包屑用原生 `<button>`、子组件各自重复引入整份 `index.scss`（含真实选择器的文件被当共享基座用）。

> **强对照证据**：仓库内 `FileUpload.vue` 与 `s3FileManager` 在同类场景均已复用共享组件；`@/utils/format.ts` 早已提供 `formatFileSize`，本模块却自行实现了一份 `formatSize`。属「同一问题已有正解却未复用」，不属 Rule of Three 的「尚未到抽象时机」。

---

## 二、P0：真实功能缺陷

### F1. 磁盘枚举依赖已被系统移除的 `wmic`

`utils/index.ts:15-49` 的 `getDiskInfo()` 执行：

```
wmic logicaldisk get DeviceID,VolumeName,Size,FreeSpace /format:csv
```

**本机实测（Windows 11 / Node 24.15.0）**：

| 命令 | 结果 |
|---|---|
| `wmic logicaldisk ... /format:csv` | `logicaldisk - Alias not found.` |
| `wmic os get Caption` | `os - Alias not found.` |
| `wmic /?` | `ERROR: Description = Access denied` |

结论：**整个 `wmic` 已不可用**（非本机个例：Microsoft 自 Win11 24H2 起将 WMIC 列为弃用并按需移除，新装系统默认不再包含）。

**连锁后果**（`composables/useDiskBrowser.ts`）：

```ts
const info = getDiskInfo()          // → null（catch 吞掉）
if (info && info.length > 0) { ... }
else { disks.value = getDefaultDisks() }   // ← 静默伪造 C:–H: 六个盘符
```

`catch` 分支同样回退到 `getDefaultDisks()`，并弹「获取磁盘列表失败」——但 `getDiskInfo` 内部已把异常吞成 `null`，故实际走的是 `else` 分支：**既不报错，也永远给出假数据**。

**整改**：改用 `fs.statfsSync` 逐盘符探测。选型对比（本机实测）：

| 方案 | 耗时 | 可拿到的数据 | 结论 |
|---|---|---|---|
| `wmic` | — | — | ❌ 命令已移除 |
| `Get-Volume` | 1500ms | 总量/可用/卷标 | ❌ 太慢 |
| `Get-CimInstance Win32_LogicalDisk` | 288ms | 总量/可用/卷标 | ⚠️ 需 PowerShell |
| **`fs.statfsSync` 遍历 C:–Z:** | **0ms** | 总量/可用 | ✅ **采纳**（纯 Node、同步、极快） |
| `cmd /c vol <盘>` | ~100ms/盘 | 卷标 | ✅ 采纳（仅取卷标，装饰性数据） |

实测新实现（本机）：正确返回 `C:(290.4G, 95%)`、`D:(186.3G, 50%)`、`E:(931.5G, 22%)`。

### F2. `getDiskInfo` 解析逻辑脆弱

```ts
const [, deviceId, volumeName, size, freeSpace] = line.split(",").map((s) => s.trim())
```

- 依赖**固定列序**：`/format:csv` 的首列是 `Node` 主机名，其余列按**字母序**排列，而非 `get` 后的书写顺序 —— 一旦列序变动即静默错位。
- `stdout.split("\n").slice(2)` **硬编码跳过 2 行**表头/空行，CSV 首行若为空行则整体偏移。
- 第 33 行与第 45 行两处 `.trim()` 重复调用。

新实现不再解析任何命令行文本（容量直接来自 `statfsSync` 的结构化数值），此问题随之消失。

### F3. `shell.openPath` 未 await，失败也提示「已打开」

```ts
// useDiskBrowser.ts:216（重构前）
electron.shell.openPath(path)        // 未 await、未取返回值
showMessage(i18n.opened!, 2000, "info")   // 无论成败都报成功
```

`shell.openPath` 的契约是**成功返回空串、失败返回错误描述字符串**。不取返回值 ⇒ 路径不存在、无关联程序、权限不足时**全部显示「已打开」**，用户完全无法感知失败。

**整改**：在共享层 `@/utils/electronDialog` 抽出 `openPathInShell(targetPath): Promise<boolean>`（内含 `fs.promises.access` 预检 + `await shell.openPath` + 取反返回值），`useDiskBrowser.openPath` 据其返回值分别提示 `opened` / `openDiskFailed`。

> 注：既有的 `openFolderInExplorer` 已是同一套逻辑。按 `AGENTS.md § 共享组件库使用规则 2`「共享组件缺能力时先扩展共享组件」，本次将其提炼为通用 `openPathInShell`，`openFolderInExplorer` 改为委托调用（签名不变，`resourceManager` / `s3Backup` 的 3 个调用点零改动）。

---

## 三、P1：自建同类控件与自造复杂度

### F4. 磁盘用量条自建，未用共享 `ProgressBar`

`styles/index.scss:261-297` 自建 `.db-all-drive-bar` / `.db-all-drive-fill` + `.tone-normal/-warning/-danger` 三档配色，职责与共享 `ProgressBar.vue` **完全重合**，且缺失其既有的 `role="progressbar"` / `aria-valuenow` 无障碍语义。

**违反规则**：`AGENTS.md:191` 明确列出「**进度条**」为必须使用共享组件的场景。

**整改（遵循「先扩展共享组件」）**：为 `ProgressBar` 新增**可选** `severity?: "primary" | "warning" | "danger"`（默认 `primary`，向后兼容），实现为档位变量 `--si-progressbar-value-bg`，`--warning` / `--danger` 修饰类覆盖为 `--b3-theme-warning` / `--b3-theme-error`。磁盘用量条改用 `ProgressBar :severity="..." size="xsmall" :show-value="false"`，并同步补 `componentPreview/previewData/progressBar.ts` 示例与 `AGENTS.md` 组件清单。

### F5. 面包屑使用原生 `<button>`

`AddressBar.vue:16,32` 两处原生 `<button class="db-crumb">`（根节点 + 每一级路径段），样式文件里另写 `.db-crumb` 的 padding / 圆角 / hover 底色。

**违反规则**：`AGENTS.md:191` 首位即「**按钮**」；例外仅限「纯展示的局部布局容器」与 `.icon-btn` 26×26 固定尺寸图标按钮，面包屑文本按钮不属于任一例外。

**整改**：改用 `Button variant="ghost" text size="xsmall"`（根节点带 `icon="diskBrowser"`），删除 `.db-crumb` 的交互样式，仅保留等宽字体与末级加粗。

### F6. 缓存状态整套机制属自造复杂度

`utils/index.ts:114-157` + `types/index.ts:18-27` 共约 60 行，只为在 `Sidebar.vue` 与 `FolderList.vue` 各渲染一个倒计时标签：

```ts
computeCacheStatus(cacheData, i18n, CACHE_EXPIRY_TIME, "full" | "short")  // 两种文案规格
isCacheValid(cacheData, CACHE_EXPIRY_TIME)
export const CACHE_EXPIRY_TIME = 60 * 60 * 1000
interface CacheData<T> { data: T; timestamp: number }
interface CacheStatus { text: string; isExpired: boolean; tooltip: string }
```

**判定为纯增复杂度**的依据：

1. 缓存的**唯一收益**是「面板存活期间少读一次目录」，而面板关闭即随 Vue 实例销毁 —— 1 小时的过期窗口在这种生命周期下**几乎不可能触发**。
2. 为这个几乎不触发的窗口维护了一整套状态机 + 两种文案规格（`"full"` 给侧栏、`"short"` 给状态栏）+ 两处 UI 渲染 + `pulse` 动画。
3. 倒计时标签对用户无决策价值：用户既不关心缓存还有几分钟，也没有「缓存」这一心智模型。

**整改**：改为**会话内记忆化，无过期**（`cachedDisks: Ref<DiskInfo[] | null>` + `folderCache: Ref<Map<string, FolderInfo[]>>`），删除 `computeCacheStatus` / `isCacheValid` / `CACHE_EXPIRY_TIME` / `CacheData` / `CacheStatus` 及两处倒计时 UI、`.db-cache-tag` / `.db-status-cache` 样式与 `@keyframes pulse`。

---

## 四、P1：视图重复与布局缺陷

### F7. 目录读取失败与空目录不可区分

```ts
// utils/index.ts:93-95（重构前）
} catch {
  items = []          // ← 权限拒绝 / 路径消失 与「空目录」返回同一个值
}
return items
```

`FolderList.vue` 据 `folders.length === 0` 渲染「此文件夹为空」—— 于是**无权限目录、已卸载的网盘、被删除的路径全部伪装成空目录**，用户找不到任何失败线索。

**整改**：`readDirectoryContents` 失败时返回 **`null`**（成功但为空返回 `[]`）；composable 新增 `loadError: Ref<string>`，`FolderList.vue` 据此渲染独立的 `.db-error` 态（`icon="error"` + `i18n.loadFoldersFailed`）。三态（加载中 / 空 / 失败）互斥且可测。

### F8. 磁盘与收藏夹各存在两套渲染

| 内容 | 位置 A（「全部磁盘」视图） | 位置 B（双栏侧栏） |
|---|---|---|
| 磁盘 | `index.vue:58-110` 卡片网格 + 进度条 + 已用/可用 | `Sidebar.vue:23-60` 行式 + 百分比 + 已用/总量 |
| 收藏夹 | `index.vue:130-173` | `Sidebar.vue:62-111` |

两套渲染各自维护样式与交互，且**信息结构不一致**（卡片显示「已用/可用」，侧栏显示「已用/总量」）。F6 的倒计时也因此要在两处分别渲染。

**整改**：删除「全部磁盘」独立视图，面板统一为**单一双栏布局**（导航栏 + 内容区）；磁盘与收藏夹各只有一份渲染（`NavPane.vue`）。聚合容量信息从被删除的 hero 概览下移到导航栏页脚（保留有用信息，去掉装饰性区块）。

### F9. 面板标题与刷新按钮各出现两次

`index.vue:8-26` 与 `Sidebar.vue:4-21` 均为「图标 + `i18n.panelTitle` + refresh 按钮」的同一结构；且 `index.ts:26` 已把标题交给 `addDock` 作为 Dock 标签。

**整改**：删除导航栏头部整块（标题归 Dock 标签，刷新按钮移到导航栏页脚）。刷新职责单一化：**页脚刷新磁盘列表**、**地址栏刷新当前目录**。

### F10. 导航栏未声明宽度

`styles/Sidebar.scss:4-11` 的 `.db-sidebar` 只有 `display: flex; flex-direction: column`，**没有 `width` / `flex-basis`**。在 `.db-layout { display: flex }` 下，该栏按 **max-content** 定宽 —— 一旦出现长卷标或长收藏夹路径，侧栏会横向撑开并**挤压内容区**（内容区虽有 `min-width: 0` 不会溢出，但列宽被压缩、观感失衡）。

**整改**：显式 `flex: 0 0 132px`。

---

## 五、P1/P2：样式与死代码

### F11. 子组件各自重复引入整份 `index.scss`

5 个组件全部写了第二行 `@use "../styles/index.scss"`（`Sidebar.scss` 还写了第一行 `@use "./index.scss" as *`）。但 `index.scss` 的 **379 行**选择器里，`.disk-browser-panel` / `.db-layout` / `.db-all-*` **全部只被 `index.vue` 使用**（重构后该文件仅剩 **48 行**）。

后果：同一批选择器在产物中被**重复发射 5 份**；且把「含真实选择器的文件」当作共享基座，违反 `AGENTS_STYLE.md` 规则 3（`_` 前缀仅限纯 mixins/变量）与规则 4。

> 仓库内已有明确先例与告诫：`componentPreview/README.md:68` 原文「⚠️ 子组件**不要再引 `styles/index.scss`** —— 那会让同一批选择器在产物里重复输出数份」。

**整改**：新增 `styles/_mixins.scss`（**纯 mixin，无顶层选择器**，符合 `_` 前缀语义），各组件改为 `@use "./_mixins.scss" as *`；`index.scss` 瘦身至 48 行，只服务 `index.vue`。另把列头与列表行共用的网格模板提为 `_mixins.scss` 的 `$db-columns`（消除原先两处逐字重复）。

### F12. 11 个 i18n 键无任何引用

逐键统计 `i18n.<key>` 引用，以下 **零命中**（中英各一份）：

| 键 | 原因 |
|---|---|
| `description` / `enable` / `enableDesc` | 功能描述由 `FEATURE_CONFIG` + `superPanel.json` 承担，本分片无需重复 |
| `openFolder` / `diskOpened` | 从未接线（`openFolder` 与 `open` 语义重复） |
| `cacheExpired` / `cacheExpiredTooltip` / `cacheValidTooltip` / `minutesRemaining` / `min` / `expired` | F6 删除缓存状态机制后失去消费者 |

**整改**：中英分片各删 11 键、新增 `noDisks`；`pnpm i18n:merge` 重新生成被 git 跟踪的合并产物。

> ⚠️ `superPanel.json` 中的 `diskBrowser` / `diskBrowserDesc` 属**另一分片**、由超级面板消费，**不在**本次删除范围。

### F13. 死代码与重复实现

| 位置 | 判定 |
|---|---|
| `utils/index.ts:159-162` `buildPath` | 3 行、仅 1 个消费者 → **内联**（`AGENTS_ARCH.md § 二`：≤10 行且单消费者不应提取） |
| `utils/index.ts:109-112` `getFolderName` | 3 行、F8 收敛后仅剩 1 个消费者 → **内联进 NavPane** |
| `utils/index.ts:100-107` `formatSize` + `UNITS` + `K` | 与共享 `@/utils/format.ts:10 formatFileSize` **逐字重复** → **改用共享版** |
| `getDefaultDisks` / `DEFAULT_DISKS` | F1 修复后成为误导性兜底（伪造盘符）→ **删除** |
| `DiskBrowserStorage.settings` 之外的 re-export | 收敛导出面 |

### F14. 可点击行均不可键盘访问

磁盘卡片、磁盘行、收藏夹行、文件行全部是 `<div @click>`，无 `role`、无 `tabindex`、无键盘处理 —— 键盘用户完全无法操作本面板。

**整改**：行元素补 `role`（`listitem` / `button`）、`tabindex="0"`、`@keydown.enter` 与 `@keydown.space.prevent`；`FolderListItem` 的 Enter/Space 与双击同义（文件=打开，文件夹=进入）；补充 `:focus-visible` 与 `:focus-within` 样式（键盘聚焦时暴露行内操作按钮）。

### F15. composable 未使用依赖注入对象

`useDiskBrowser(i18n, storage)` 为**位置参数**，违反 `AGENTS_ARCH.md § Composable 模式要求`（「所有外部依赖必须通过 `deps` 对象传入」）。

**整改**：改为 `useDiskBrowser({ i18n, storage })`。

### F16. 硬编码残留

| 位置 | 内容 | 处理 |
|---|---|---|
| `utils/index.ts:23` | `timeout: 3000` | 提为具名常量（`VOLUME_LABEL_TIMEOUT`），随 wmic 移除而重定位 |
| `index.ts:26` | `i18n.panelTitle \|\| "磁盘浏览器"` | 去掉中文兜底（`docs/hardcode-audit.md` 已列为待修）；兜底值会掩盖「i18n 未加载」的真实 bug |

---

## 六、整改清单

| 文件 | 动作 |
|---|---|
| `utils/index.ts` | 重写：`listDrives`（`statfsSync`）/ `readVolumeLabel`（`vol`）/ `readDirectoryContents`（失败返 `null`）/ `formatDate`；删 5 个死函数。196 → 157 行 |
| `types/index.ts` | 删 `CacheData` / `CacheStatus` + 11 个 i18n 键；新增 `noDisks`。80 → 60 行 |
| `composables/useDiskBrowser.ts` | 依赖注入签名、会话内记忆化、`loadError`、`openPath` await、聚合 computed 上移。347 → 296 行 |
| `index.vue` | 重写为单一双栏。283 → 95 行 |
| `components/NavPane.vue` | **新增**（替代 `Sidebar.vue`）：磁盘行 + 收藏夹 + 容量页脚，复用 `ProgressBar`。171 行 |
| `components/Sidebar.vue` | **删除**（改名并重写为 `NavPane.vue`，消除与共享 `@/components/Sidebar.vue` 的同名冲突） |
| `components/AddressBar.vue` | 面包屑改共享 `Button`；删与状态栏重复的 `itemCount` |
| `components/FolderList.vue` | 新增错误态分支；删缓存标签与重复路径显示 |
| `components/FolderListItem.vue` | 键盘可达 + 共享 `formatFileSize` |
| `styles/_mixins.scss` | **新增**（纯 mixin + `$db-columns`） |
| `styles/index.scss` | 瘦身至 48 行（删全部 `.db-all-*`） |
| `styles/NavPane.scss` | **新增**（替代 `Sidebar.scss`）：显式 `flex: 0 0 132px`，删缓存标签与自建进度条 |
| `styles/{AddressBar,FolderList,FolderListItem}.scss` | 移除重复的 `index.scss` 引入，改用 `_mixins.scss` |
| `src/utils/electronDialog.ts` | 新增 `openPathInShell`，`openFolderInExplorer` 委托之 |
| `src/components/ProgressBar.vue` + `styles/ProgressBar.scss` | 新增可选 `severity` |
| `src/features/componentPreview/previewData/progressBar.ts` | 补 `severity` 示例 + 更新 summary |
| `AGENTS.md` | `ProgressBar` 行补 `severity` |
| `src/i18n/{zh_CN,en_US}/diskBrowser.json` | 删 11 键 + 新增 `noDisks` |
| `src/i18n/{zh_CN,en_US}.json` | `pnpm i18n:merge` 重新生成 |
| `src/features/diskBrowser/README.md` | 更新架构说明与组件结构 |
| `docs/hardcode-audit.md` | 更新引用 diskBrowser 的待修行 |

---

## 七、验证结果

**自动化（既有入口）**

| 命令 | 结果 |
|---|---|
| `pnpm typecheck`（`vue-tsc --noEmit`） | ✅ exit 0，无输出 |
| `pnpm i18n:verify` | ✅ 4530 个叶子键中英对齐（原 4540；−11 +1） |
| `pnpm validate:icons` | ✅ 246 个图标全部有效 |
| `pnpm i18n:merge` | ✅ 已同步合并产物 |

**运行时验证（重构后代码实测）**

| 项 | 结果 |
|---|---|
| `listDrives()` 真实探测 | ✅ 返回 `C:(290.4G,95%)` / `D:(186.3G,50%)` / `E:(931.5G,22%)`，不再出现 C:–H: 假盘符 |
| `usagePercent` 值域 | ✅ 全部落在 0–100 |
| `readDirectoryContents(空目录)` | ✅ `[]`（与失败区分） |
| `readDirectoryContents(不存在路径)` | ✅ `null`（不再伪装成空目录） |
| `formatDate` 六个分支 | ✅ 今天 / 昨天 / 3 天前 / 日期串 / 未来时间 / 非法串 全部正确；空 i18n 时降级为日期串 |
| 5 个 SFC 编译（template + script setup） | ✅ 全部通过 |
| 5 个 SCSS 入口编译 | ✅ 全部通过 |
| `ProgressBar.scss` 编译 | ✅ `--warning` / `--danger` 修饰类与变量生效 |
| `NavPane` SSR 渲染 | ✅ 盘符/卷标/百分比/容量/收藏夹/页脚均正确；空磁盘显示 `noDisks` |
| `FolderList` 三态 SSR 渲染 | ✅ 加载中→Loader；空→「此文件夹为空」；失败→`.db-error` 且**不再误报**空目录 |

**用户待执行**：`pnpm lint`、`pnpm vite build`（按 `AGENTS.md`，AI 不运行）。

**代码量**：15 个文件 / 2082 行 → 16 个文件 / 1648 行（**净减 434 行**，−21%；文件数 +1 是因按 `AGENTS_STYLE.md` 规则 3 拆出纯 mixin 载体 `_mixins.scss`，并新增 `NavPane.vue` 取代 `Sidebar.vue`）。

| 文件 | 重构前 | 重构后 | 变化 |
|---|---|---|---|
| `index.vue` | 283 | 95 | −188 |
| `styles/index.scss` | 379 | 48 | −331 |
| `utils/index.ts` | 196 | 157 | −39 |
| `composables/useDiskBrowser.ts` | 347 | 296 | −51 |
| `types/index.ts` | 80 | 60 | −20 |
| `components/Sidebar.vue` + `styles/Sidebar.scss` | 161 + 217 | **删除** | −378 |
| `components/NavPane.vue` + `styles/NavPane.scss` | **新增** | 171 + 177 | +348 |
| `styles/_mixins.scss` | **新增** | 65 | +65 |
| 其余 4 个组件 + 3 个样式 + `index.ts` + `storage.ts` | 259 | 305 | +46（键盘可达、错误态、面包屑按钮化） |

**遗留风险（已知且接受）**：`vol` 的输出编码随控制台代码页变化，且代码页状态可被外部进程污染（实测同一台机器不同调用可分别产出 UTF-8 与 GBK 字节）。故解析采取**宁缺勿滥**策略：解出的文本含替换字符（U+FFFD）即判定不可信并返回空串 —— 宁可少显示一个卷标，也绝不把乱码呈现给用户。卷标是纯装饰数据，UI 有 `v-if="disk.label"` 兜底，其缺失不影响磁盘列表可用性。
