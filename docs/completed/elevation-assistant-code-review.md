# 提权助手（elevationAssistant）代码审查报告

> **归档说明（2026-11-28）**：§8 的 Phase A–F 已在 `src/features/elevationAssistant/` 落地
> （诊断竞态、持久化结果检查、操作锁、快捷方式状态机、统一展示、存储校验、删除语义、
> 系统命令绝对路径、manifest 边界、§7 程序扫描均已实现），文档转为历史记录，不再更新。
> 实施后的行为约定见 [`src/features/elevationAssistant/README.md`](../../src/features/elevationAssistant/README.md)。
>
> **状态（2026-11-28 实施后）**：修复与“自动扫描程序”均已执行；`pnpm test`（提权助手 79 passed / 5 skipped）、
> `pnpm exec vue-tsc --noEmit`、`pnpm i18n:verify` 通过。`pnpm lint` 在 feature 目录仍有
> 若干**既有**规则报错（`Buffer`/`process` 全局、控制字符正则等，非本次引入），按仓库约定由用户处理。
>
> 审查基线：提交 `3f46e469 feat(elevationAssistant): 新增提权助手功能，支持创建管理员快捷方式与权限诊断`。
> 审查范围：`src/features/elevationAssistant/` 全部生产文件（19 个 TS/Vue + 6 个 spec + 6 个 SCSS + README），并核对功能注册、i18n、存储注册表、`DESTROYABLE_KEYS`。
> 审查方式：静态走查（逐文件阅读 + 交叉引用检查）；执行 `pnpm exec vitest run src/features/elevationAssistant`，结果 **5 个测试文件 60 passed / 1 个 Windows 集成 spec 5 skipped**。
> 未执行：`pnpm typecheck`、`pnpm lint`、`pnpm build`（按仓库约定由用户执行）。

---

## 0. 结论速览

- **P0 正确性/数据安全 5 项**：诊断竞态与陈旧结果、保存失败被吞、操作未串行、快捷方式状态误报、编辑器与诊断报告结论矛盾。
- **P1 健壮性/安全 10 项**：存储信任边界未校验、删除失败仍移除工具、快捷方式上限静默淘汰、单条删除无确认、系统命令走 PATH、权限检测串行、manifest 解析边界、快捷方式结果盲信、写盘快照乱序、根目录 `dirname` 错误。
- **P2 冗余/死代码/重复类型**：重复类型 5 组、重复逻辑 7 处、死代码/无效状态 13 处（详见 §4）。
- **内存/资源**：未发现无界增长型泄漏；PowerShell 子进程、文件句柄、Map/Set 规模均有界。但存在陈旧 Map 条目与对话框关闭后仍持有对象引用的“有界残留”，建议一并清理（详见 §5）。
- **测试缺口**：`diagnostics.ts` 无独立单测；sanitize、manifest 边界、扫描纯函数均缺测试（详见 §6）。
- **新增能力**：本文 §7 给出“自动扫描本机程序”的完整设计（开始菜单/桌面快捷方式/App Paths/运行中进程），当前未实现。

---

## 1. 功能与数据流（审查基线）

- 注册：`src/features/config.ts` 的 `elevationAssistant` + `DESKTOP_ONLY_FEATURE_IDS`；`src/index.ts` 中 `canRegister` 后调用 `registerElevationAssistant`，实例挂在 `__elevationAssistant` 并由 `DESTROYABLE_KEYS` 统一销毁。
- 入口：`ElevationAssistant.init()` 创建 `WindowsShellService` 与 Dock Vue app；`destroy()` 卸载 Dock 并 `shell.dispose()`。
- 存储：`elevation-assistant-tools` JSON 槽（`ElevationTool[]`，上限 50；诊断/状态不落盘）。
- 诊断：`diagnoseExecutable(path)` 读取 PE 内嵌 `RT_MANIFEST`（`utils/manifest.ts`），失败时回退同目录 `<exe>.manifest`，输出 `PermissionDiagnosis`。
- 快捷方式：PowerShell `-EncodedCommand` + Base64 JSON 参数创建 `.lnk`，直接改写 `LinkFlags` 的 `RunAsUser` 位（偏移 `0x15`、掩码 `0x20`）。
- 权限状态：`whoami /groups` + `whoami` + `reg query EnableLUA`（原生 exe，不走 PowerShell）。

---

## 2. P0 正确性/数据安全

### P0-1 诊断竞态与陈旧结果

**位置**
- [`index.vue`](../src/features/elevationAssistant/index.vue) `handleDiagnoseDraft()` L275-L283、`handleDiagnoseFree()` L464-L475、`handleAddFromPath()` L477-L492
- [`ToolEditorDialog.vue`](../src/features/elevationAssistant/components/ToolEditorDialog.vue) `watch(() => props.diagnosis)` L246-L251
- [`DiagnosticsPanel.vue`](../src/features/elevationAssistant/components/DiagnosticsPanel.vue) `freePath` watch L207-L211

**问题**
1. 编辑器与临时检测都直接 `await diagnoseExecutable(...)` 后写 ref，没有请求序号。连续触发两次检测时，先发出的慢请求可能后返回并覆盖新结果。
2. `ToolEditorDialog` 的 `watch(props.diagnosis)` 一旦收到诊断，就会在用户未手动修改时自动写入 `requireAdmin`、名称、工作目录。若该诊断对应的是**旧路径**（用户在检测期间改了路径），会得到错误的提权意图。
3. 临时检测的路径输入在子组件 `freePath` 中本地维护；父组件 `freeTargetPath` 只在点击“检测”时更新。用户检测后修改输入再点“添加为工具”时，`handleAddFromPath(path)` 用的是新路径，但 `freeDiagnosis` 仍是旧路径的诊断，导致 `requireAdmin` 推荐值错误、编辑器报告张冠李戴。

**影响**
用户可能为错误程序生成带管理员标记的快捷方式；诊断报告与实际目标不一致。

**修复建议**
- composable 增加统一的 `diagnosePath(path)`，所有入口复用；错误统一转成错误诊断。
- 调用方维护递增 token，await 后同时校验“token 最新 + 规范化路径与当前输入一致”才写入。
- `DiagnosticsPanel` 路径输入变化时 emit `update:path`，父组件立即清空 `freeDiagnosis`。
- `handleAddFromPath` 仅在 `freeTargetPath === 目标路径` 时使用 `freeDiagnosis`，否则重新检测或不用推荐值。

---

### P0-2 保存失败被吞，UI 谎报成功

**位置**
- [`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) `persist()` L110-L119
- 调用点：`createTool` L315、`updateTool` L351、`createShortcutFor` L450、`runTool` L477、`deleteTool` L498、`deleteShortcut` L520

**问题**
`persist()` 返回 `Promise<boolean>`，但所有调用方都只 `await persist()`，不检查返回值。`TypedStorage.save()` 失败时只写 `saveError`，业务继续按成功返回：
- `createTool` 仍返回 `{ ok: true, tool }`；
- `createShortcutFor` 仍返回创建成功；
- `deleteTool` 已从内存移除并提示“工具已删除”。

**影响**
内存与磁盘状态分叉：重启后新增工具消失、删除的工具“复活”、快捷方式记录与磁盘文件不一致。

**修复建议**
- `createTool` / `updateTool`：保存失败回滚内存并返回 `{ ok:false, error: saveFailed }`。
- `deleteTool` / `deleteShortcut`：保存失败恢复记录或明确提示“删除未持久化”，不得报成功。
- `createShortcutFor`：保存失败移除刚加入的记录并返回错误；已生成的 `.lnk` 在错误信息中给出路径，便于用户处理。
- `runTool` 的 `lastRunAt` 保存失败不阻断运行结果，但必须设置 `saveError`。

---

### P0-3 删除/更新/创建未按工具串行，异步返回后继续改旧对象

**位置**
- [`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) `createShortcutFor()` L391-L455、`updateTool()` L332-L389、`deleteTool()` L484-L503

**问题**
`busyIds` 只用于 UI 禁用按钮，不是操作锁：
- `deleteTool` 不检查 `busyIds`，可在 `createShortcutFor` / `runTool` 进行中删除工具；
- `createShortcutFor` await 完 PowerShell 后，继续修改开始时捕获的 `tool` 对象（此时工具可能已从 `tools.value` 移除），并 `persist()` 写的是新列表；
- `updateTool` 重建快捷方式循环中同样没有“工具是否仍存在”的复核。

**影响**
生成无人管理的孤儿 `.lnk`；UI 状态与磁盘记录不一致；删除后仍有后台操作写盘。

**修复建议**
- 把 `busyIds` 升级为操作锁：`acquireTool(id)` / `releaseTool(id)`，`createShortcutFor`、`runTool`、`updateTool`、`deleteTool`、`deleteShortcut`、`refreshTool` 进入前获取。
- 每个 `await` 之后重新检查 `tools.value.some(t => t.id === toolId)`；已删除则返回 `toolMissing`，不再修改/落盘。
- `refreshAll` 跳过 `busyIds` 中的工具。

---

### P0-4 快捷方式状态未知被当成“存在”

**位置**
- [`DiagnosticsPanel.vue`](../src/features/elevationAssistant/components/DiagnosticsPanel.vue) L133-L138
- [`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) `shortcutStatusFor()` L98-L100

**问题**
模板只判断 `shortcutStatusFor(record.path)?.exists === false`：
- 尚未检测（`undefined`）落入 `: 'success'`，显示绿色“存在”；
- `inspectShortcut` 对 EACCES/EPERM 也返回 `exists: false`，同样显示“已丢失”。

**影响**
用户误以为快捷方式正常，实际未检测或无权限读取。

**修复建议**
- `types/index.ts` 定义 `ShortcutState = "unknown" | "exists" | "missing" | "invalid" | "error"` 与 `ShortcutStatus`。
- `inspectShortcut` 返回显式 state；UI 分别显示“未检测 / 存在 / 已丢失 / 文件无效 / 无法检测”。
- `refreshShortcutStatuses` 仅在 `state === "exists" && valid` 时同步 `record.runAsAdmin`。

---

### P0-5 编辑器与诊断报告结论口径不一致

**位置**
- [`ToolEditorDialog.vue`](../src/features/elevationAssistant/components/ToolEditorDialog.vue) `diagnosisVariant` / `diagnosisLabel` / `diagnosisReason` L259-L311
- [`DiagnosisReport.vue`](../src/features/elevationAssistant/components/DiagnosisReport.vue) `variant` / `recommendationLabel` / `reasonText` L83-L146
- [`ElevationToolList.vue`](../src/features/elevationAssistant/components/ElevationToolList.vue) `manifestVariant` / `manifestIcon` / `manifestLabel` L193-L218

**问题**
- 编辑器按 `manifestLevel` 推导标签/颜色；报告按 `recommendation` 推导。
- 对 `uiAccess="true"` 且 `level="asInvoker"` 的程序：`recommendFromManifest` 返回 `recommendation: "recommended"`、`reasonCode: "manifestUiAccess"`；编辑器却显示“无需管理员 / 绿色盾牌”，报告显示“建议管理员 / 黄色盾牌”。
- `reasonCode: "unsupportedFile"` 在编辑器和报告中都没有对应分支，落入默认 `reasonReadError`，提示“无法读取目标文件信息”，而实际是“仅支持 .exe”。
- `reasonCode: "externalManifest"` 在类型中声明但 `recommendFromManifest` 从不产生，属死分支。

**影响**
同一程序两处结论矛盾；非 exe 文件的失败原因误导。

**修复建议**
- 新增纯函数 `utils/diagnosisView.ts`：`presentDiagnosis(diagnosis, i18n)` 返回 `{ variant, icon, label, reason }`，标签/颜色/图标统一以 `recommendation` 为准，`kind: missing/error/other` 单独覆盖。
- 三个组件统一消费该函数，删除各自重复的 switch。
- `reasonCode` 增加 `unsupportedFile` 映射，删除 `externalManifest`。
- 新增 i18n `reasonUnsupportedFile`。

---

## 3. P1 健壮性/安全

### P1-1 存储是信任边界但未校验

**位置**：[`utils/tools.ts`](../src/features/elevationAssistant/utils/tools.ts) `sanitizeTool()` L63-L87、`sanitizeTools()` L90-L102。

**问题**
- `path` 只检查非空，不校验是否 Windows 绝对路径、是否 `.exe`。
- `name` 只 `trim()`，不校验非法字符/保留名；`createShortcutFor` 用 `normalizeShortcutName(tool.name)` 作为 `fileName` 传给 PowerShell `Join-Path $dir ($p.fileName + '.lnk')`。被篡改的 JSON 可写入 `..\..\evil`，`Join-Path` 后把 `.lnk` 写到目标目录之外。
- `workingDir` 只 `trim()`，不校验绝对路径。
- `args` 直接 `slice(0, 4096)`，硬编码与 `ARGUMENTS_MAX` 重复。

**修复建议**
- `path` 必须 `isAbsoluteWindowsPath` + `hasExeExtension`，否则丢弃条目。
- `name` 用 `sanitizeShortcutName(name, windowsBasename(path))`，长度 ≤ `SHORTCUT_NAME_MAX`。
- `workingDir` 非空时必须绝对，否则回退 `defaultWorkingDir(path)`。
- `args` 使用 `ARGUMENTS_MAX`；`id` 截断到合理长度。
- `sanitizeShortcut` 改用 `isShortcutLocation`，删除 `LOCATIONS` 重复表。

---

### P1-2 删除失败仍移除工具，失败明细无人展示

**位置**：[`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) `deleteTool()` L484-L503；[`index.vue`](../src/features/elevationAssistant/index.vue) `deleteFailures` L198、L426。

**问题**
逐条删除快捷方式时记录 `failures`，但随后无条件 `tools.value = tools.value.filter(...)` 并 `persist()`。`deleteFailures` 被赋值后从未在模板中使用。

**影响**
删除失败的 `.lnk` 变成孤儿文件，用户无法从工具列表重试。

**修复建议**
- 只从 `tool.shortcuts` 移除删除成功的记录；仍有失败时保留工具并更新 `updatedAt`。
- 返回 `{ failures, retained: true }`；UI 提示“工具已保留，N 个快捷方式删除失败”，并展示失败路径。
- 删除对话框关闭后清空 `deleteTarget`。

---

### P1-3 快捷方式上限静默淘汰

**位置**：[`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) L430-L443；[`utils/tools.ts`](../src/features/elevationAssistant/utils/tools.ts) `sanitizeShortcutList()` L49-L61。

**问题**
`createShortcutFor` 新增记录后 `slice(0, MAX_SHORTCUTS_PER_TOOL)`，被淘汰记录对应的 `.lnk` 文件仍在磁盘上，但已无人管理。`sanitizeShortcutList` 同样静默截断。

**修复建议**
- `createShortcutFor` 在达到 `MAX_SHORTCUTS_PER_TOOL` 时返回 `kind: "limit"`，不创建文件、不淘汰旧记录。
- 加载期截断仅作为损坏数据兜底，并记录日志/提示。
- `ShortcutFailureKind` 增加 `"limit"`。

---

### P1-4 单条快捷方式删除无确认，回收站失败不回退

**位置**：[`DiagnosticsPanel.vue`](../src/features/elevationAssistant/components/DiagnosticsPanel.vue) L156-L162；[`managers/shortcutFiles.ts`](../src/features/elevationAssistant/managers/shortcutFiles.ts) `deleteShortcutFile()` L67-L116。

**问题**
- 删除单条快捷方式直接 emit，没有二次确认；误点即删除。
- `getElectronRemoteShell()?.trashItem` 存在但抛错时直接返回错误，不再尝试 `electron.shell.trashItem` 或 `unlink`。
- `unlink` 回退只校验绝对路径 + `.lnk`，不校验该 `.lnk` 是否由本功能创建（记录来源在调用方保证）。

**修复建议**
- `index.vue` 增加 `ConfirmDialog` 确认单条删除。
- 回收站失败时按 `remoteShell.trashItem` → `electronShell.trashItem` → 严格校验后 `unlink` 的顺序回退。
- 失败信息展示具体路径。

---

### P1-5 系统命令走 PATH/cwd，存在同名程序劫持风险

**位置**：[`managers/WindowsShell.ts`](../src/features/elevationAssistant/managers/WindowsShell.ts) `getPrivilegeStatus()` L109-L133、`readUacEnabled()` L272-L287、`resolvePowerShellPath()` L388-L405。

**问题**
- `execFile("whoami.exe", ...)`、`execFile("reg.exe", ...)` 依赖 Windows 搜索顺序（应用目录/当前目录/System32/PATH）。提权工具不应接受当前目录同名程序。
- `resolvePowerShellPath()` 在 `%SystemRoot%` 缺失或候选不存在时回退 `"powershell.exe"`，同样走 PATH。

**修复建议**
- 统一 `resolveSystemExe(name)`：优先 `%SystemRoot%\System32\name`，32 位进程回退 `Sysnative`。
- PowerShell 只使用绝对候选路径；找不到返回 `env` 错误，不回退 PATH。
- 增加单测/集成测试锁定解析结果（Windows 实机 spec）。

---

### P1-6 权限检测串行，最坏 45s

**位置**：[`managers/WindowsShell.ts`](../src/features/elevationAssistant/managers/WindowsShell.ts) `getPrivilegeStatus()` L100-L146。

**问题**
`whoami /groups` → `whoami` → `reg query` 顺序 await；每步超时 15s，最坏 45s。三者互不依赖。

**修复建议**
`Promise.all` 并行执行，最坏 15s；`groups` 失败时仍可展示用户/UAC 信息（或整体失败，按现有语义）。

---

### P1-7 manifest 解析边界

**位置**：[`utils/manifest.ts`](../src/features/elevationAssistant/utils/manifest.ts) `archFromMachine()` L125-L133、`parseManifestLevel()` L273-L293、`readPeManifest()` L366-L408。

**问题**
1. `<requestedExecutionLevel/>` 存在但缺少 `level` 属性时，`rawLevel` 为 `undefined`，`level` 保持默认 `"asInvoker"`，最终推荐“无需管理员”。`hasRequestedLevel` 计算后仅测试读取，生产未使用。
2. `0x01C4` 是 `IMAGE_FILE_MACHINE_ARMNT`（ARM32），被映射为 `"arm64"`。
3. `readPeManifest()` 先 `readEmbeddedManifest()` 解析 PE 头，再 `readPeArch()` 又解析一次；每次诊断多读一次头。
4. `PeSection.virtualSize` 赋值后从未读取，`mapRvaToOffset()` 只按 `rawSize` 判断。

**修复建议**
- 有 `requestedExecutionLevel` 但 `level` 缺失/非法 → `unknown`，走 `parseError`。
- `0x01C4` → `unknown`（或新增 `arm` 档并同步 UI/i18n）。
- 合并为一次 `readPeHeaders(reader)`，返回 `arch`、`sections`、资源目录；`readEmbeddedManifest` 复用它。
- `mapRvaToOffset` 使用 `Math.min(virtualSize || rawSize, rawSize)`。

---

### P1-8 快捷方式创建结果盲信 PowerShell

**位置**：[`managers/WindowsShell.ts`](../src/features/elevationAssistant/managers/WindowsShell.ts) `createShortcut()` L179-L185。

**问题**
`data.ok === true` 时直接返回 `{ ok:true, path: asString(data.path), ... }`；若 PowerShell 返回空/非绝对/非 `.lnk` 路径，仍被视为成功。

**修复建议**
`ok: true` 时校验 `isAbsoluteWindowsPath(path)` 且 `hasLnkExtension(path)`，否则返回 `{ ok:false, kind:"invalid" }`。

---

### P1-9 写盘队列持有旧快照，可能乱序覆盖

**位置**：[`types/storage.ts`](../src/features/elevationAssistant/types/storage.ts) `saveTools()` L32-L40。

**问题**
`saveTools(tools)` 在调用时立即 `sanitizeTools(tools)` 生成 `next` 并排队。若 A（旧状态）先调用、B（新状态）后调用，但 A 的队列任务后执行，A 写入的是旧快照，覆盖 B。

**修复建议**
- composable 内增加 `persistChain`，排队任务执行时读取最新 `tools.value`（见 §8 Phase B）。
- `ElevationAssistantStorage` 的串行队列保留，作为第二道保护。

---

### P1-10 根目录 `dirname` 返回 `C:`

**位置**：[`utils/validation.ts`](../src/features/elevationAssistant/utils/validation.ts) `windowsDirname()` L34-L39。

**问题**
`windowsDirname("C:\\a.exe")` 的 `index = 2`，返回 `normalized.slice(0, 2) = "C:"`；`defaultWorkingDir("C:\\a.exe")` 得到 `"C:"`，不是合法的绝对目录。

**修复建议**
盘符根路径返回 `C:\`；补 `defaultWorkingDir("C:\\a.exe") === "C:\\"` 与 `windowsDirname` 根路径测试。

---

## 4. P2 冗余、重复类型、死代码

### 4.1 重复类型

| # | 类型 | 重复位置 | 建议 |
|---|---|---|---|
| 1 | `IntegrityLevel` | [`types/index.ts`](../src/features/elevationAssistant/types/index.ts) L24-L31 与 [`utils/commands.ts`](../src/features/elevationAssistant/utils/commands.ts) L10-L17 | 收敛到 `types/index.ts`，`commands.ts` 改 type import |
| 2 | `PeArch` / `ManifestSource` | [`utils/manifest.ts`](../src/features/elevationAssistant/utils/manifest.ts) L12-L13 与 [`types/index.ts`](../src/features/elevationAssistant/types/index.ts) L54-L60 | 同上，`PermissionDiagnosis` 引用共享类型 |
| 3 | `reasonCode` 联合 | [`utils/manifest.ts`](../src/features/elevationAssistant/utils/manifest.ts) L38-L48 与 [`types/index.ts`](../src/features/elevationAssistant/types/index.ts) L66-L75 | 定义 `DiagnosisReasonCode` 单源 |
| 4 | `ShortcutStatus` / `ShortcutInspection` | [`composables/useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) L46-L51 与 [`managers/shortcutFiles.ts`](../src/features/elevationAssistant/managers/shortcutFiles.ts) L12-L17 | 单一定义，manager 返回、composable/组件引用 |
| 5 | 失败 kind 联合 | `PrivilegeResult` L88-L90、`ShortcutFailureKind` L105-L112、`RunOutcome` L118-L124 | 抽出 `ShellFailureKind`，再组合 |

另：`ElevationAssistantI18n = Record<string, string>` 是无意义别名，建议删除。

### 4.2 重复逻辑

| # | 位置 | 问题 | 建议 |
|---|---|---|---|
| 1 | [`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) L202-L227 与 L245-L262 | 错误诊断对象重复两份 | 由 `diagnostics.ts` 导出 `createFailedDiagnosis(error)` |
| 2 | `useElevationAssistant` + [`index.vue`](../src/features/elevationAssistant/index.vue) L275-L283、L464-L475 | 诊断入口三条，错误处理不一致 | composable 统一 `diagnosePath()` |
| 3 | [`ElevationToolList.vue`](../src/features/elevationAssistant/components/ElevationToolList.vue) L193-L218、[`ToolEditorDialog.vue`](../src/features/elevationAssistant/components/ToolEditorDialog.vue) L259-L311、[`DiagnosisReport.vue`](../src/features/elevationAssistant/components/DiagnosisReport.vue) L83-L146 | manifest 展示逻辑三份；reason→i18n 两份 | 统一 `presentDiagnosis()` |
| 4 | [`utils/tools.ts`](../src/features/elevationAssistant/utils/tools.ts) L15 与 [`utils/validation.ts`](../src/features/elevationAssistant/utils/validation.ts) L89-L91 | `LOCATIONS` 与 `isShortcutLocation` 重复 | sanitize 改用 `isShortcutLocation` |
| 5 | [`utils/shortcut.ts`](../src/features/elevationAssistant/utils/shortcut.ts) L106-L111 与 [`utils/validation.ts`](../src/features/elevationAssistant/utils/validation.ts) L27-L31 | `suggestToolName` 手写取 basename 与 `windowsBasename` 重复 | 复用 `windowsBasename` |
| 6 | [`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) L229-L271 | 手写 worker 池 | 复用 `runWithConcurrency`（`src/utils/s3/concurrency.ts`） |
| 7 | [`utils/manifest.ts`](../src/features/elevationAssistant/utils/manifest.ts) L169-L250、L366-L408 | PE 头解析两次 | 合并 `readPeHeaders()` |

### 4.3 死代码 / 无效状态

| # | 位置 | 问题 | 建议 |
|---|---|---|---|
| 1 | [`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) L92、L565-L589 | `hasTools`、`persist`、`busyIds` 返回后无消费方；`loading` 仅内部用 | 缩小返回面 |
| 2 | [`index.vue`](../src/features/elevationAssistant/index.vue) L198 | `deleteFailures` 赋值后从未渲染 | 接入 UI 或删除 |
| 3 | [`utils/shortcut.ts`](../src/features/elevationAssistant/utils/shortcut.ts) L8 | `SHORTCUT_HEADER_SIZE` 未使用 | 删除，或让 `isShortcutHeader` 使用 |
| 4 | [`utils/shortcut.ts`](../src/features/elevationAssistant/utils/shortcut.ts) L53-L62 | `withRunAsAdminFlag` 仅 spec 使用，生产走 PowerShell | 删除函数与对应测试 |
| 5 | [`utils/manifest.ts`](../src/features/elevationAssistant/utils/manifest.ts) L70-L78 | `createBufferPeReader` 仅 spec 使用 | 移到 spec 内 |
| 6 | [`utils/validation.ts`](../src/features/elevationAssistant/utils/validation.ts) L27-L31、L89-L91 | `windowsBasename` / `isShortcutLocation` 仅 spec 使用 | 在生产中复用（见 §4.2） |
| 7 | [`types/index.ts`](../src/features/elevationAssistant/types/index.ts) L98、[`utils/commands.ts`](../src/features/elevationAssistant/utils/commands.ts) L74/L97、[`utils/validation.ts`](../src/features/elevationAssistant/utils/validation.ts) L12/L99-L101 | `description` 全链路所有调用方都传 `""` | 删除字段、常量与 PowerShell 分支 |
| 8 | [`utils/manifest.ts`](../src/features/elevationAssistant/utils/manifest.ts) L31/L274/L291 | `hasRequestedLevel` 计算后生产未用 | 用于 P1-7 的缺 level 判定 |
| 9 | [`utils/manifest.ts`](../src/features/elevationAssistant/utils/manifest.ts) L44、[`types/index.ts`](../src/features/elevationAssistant/types/index.ts) L72 | `externalManifest` reason 从不产生 | 删除 |
| 10 | [`utils/manifest.ts`](../src/features/elevationAssistant/utils/manifest.ts) L59/L204 | `PeSection.virtualSize` 赋值后未读 | 参与 RVA 映射（P1-7） |
| 11 | `src/i18n/{zh_CN,en_US}/elevationAssistant.json` | `shortcutUpdateFailed`、`toolSavedShortcutFailed` 无引用 | 删除或接入 |
| 12 | [`DiagnosisReport.vue`](../src/features/elevationAssistant/components/DiagnosisReport.vue) L157-L163 | `formatTime` 对合法 number 的 try/catch 无实际保护 | 简化 |
| 13 | [`managers/shortcutFiles.ts`](../src/features/elevationAssistant/managers/shortcutFiles.ts) L16 | `ShortcutInspection.error` 产生后 UI 不展示 | 接入状态展示 |

---

## 5. 内存与资源专项

### 5.1 已正确处理的资源

- **PowerShell 子进程**：`WindowsShellService.active: Set<ChildProcess>`，`execRaw` 回调中 `delete`；`cancelActive()` 统一 `kill()` 并 `clear()`；`dispose()` 先置 `disposed` 再 `cancelActive()`。
- **文件句柄**：`diagnoseExecutable` 的 `fs.promises.open` 在 `finally` 关闭；`inspectShortcut` 同理。
- **诊断缓存**：`diagnoses` / `shortcutStatuses` 为 `reactive(Map)`，规模受 `MAX_TOOLS`（50）与 `MAX_SHORTCUTS_PER_TOOL`（10）约束，无定时器/全局监听。
- **PE 读取**：`PeReader` 按需 `readExact`，不整文件载入；外部 manifest 有 1MB 上限。
- **Vue 生命周期**：`onUnmounted` 置 `disposed` 并 `shell.cancelActive()`；Dock 卸载由 `createVueDockApp` 的 `unmount` 负责。

**结论：未发现无界增长型内存泄漏。**

### 5.2 有界残留（建议清理）

| # | 位置 | 残留 | 建议 |
|---|---|---|---|
| 1 | [`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) `load()` L273-L289 | 不清理 `diagnoses`/`shortcutStatuses`，重复加载会留旧条目 | `load()` 开始处 `clear()` |
| 2 | [`index.vue`](../src/features/elevationAssistant/index.vue) L196-L206 | `deleteTarget`、`pendingOverwrite` 在对话框关闭后仍持有对象引用 | 关闭/完成后置 `null` |
| 3 | [`useElevationAssistant.ts`](../src/features/elevationAssistant/composables/useElevationAssistant.ts) L377/L519 | `shortcutStatuses` 对已删除/已转移记录可能短暂残留 | 删除/转移时同步清理 |
| 4 | [`types/storage.ts`](../src/features/elevationAssistant/types/storage.ts) L32-L40 | `writeQueue` 持有旧数组快照直到写盘完成 | 改为执行时取最新（见 P1-9） |

---

## 6. 测试覆盖与缺口

### 6.1 现有测试

`pnpm exec vitest run src/features/elevationAssistant`：

```text
✓ utils/tools.spec.ts (7 tests)
✓ utils/shortcut.spec.ts (14 tests)
✓ utils/commands.spec.ts (12 tests)
✓ utils/validation.spec.ts (12 tests)
✓ utils/manifest.spec.ts (15 tests)
↓ managers/WindowsShell.win.spec.ts (5 tests | 5 skipped)
Test Files 5 passed | 1 skipped
Tests 60 passed | 5 skipped
```

### 6.2 缺口

1. `diagnostics.ts` 无独立单测；错误分支（missing/other/readError/external manifest）只靠默认跳过的集成测试。
2. `sanitizeTools` 未覆盖非法 path/name/workingDir、超长字段、重复 shortcut 路径。
3. `manifest` 未覆盖“有 `requestedExecutionLevel` 但缺 `level`”、ARMNT、无资源目录仍有 arch、根目录 `dirname`。
4. `commands` 未覆盖 `buildCreateShortcutScript` 各错误 kind 的 PowerShell 输出解析、扫描脚本（新增）。
5. 组件层无 Vue 测试设施；建议把可测逻辑抽成纯函数（`presentDiagnosis`、`planProgramAdditions`）后覆盖。
6. `WindowsShell.win.spec.ts` 的权限检测注释说“重试一次”，但 `getPrivilegeStatus` 串行三命令，重试成本高；并行化后需同步调整超时断言。

---

## 7. “自动扫描程序”设计（未实现）

> 需求理解：在提权助手中自动发现本机可加入工具列表的 `.exe`，避免逐个浏览添加。**只读取路径，不执行目标程序，不写盘，不需要管理员权限。**
> 若实际需求是“扫描代码死代码/重复类型”的静态脚本，则本节替换为 `scripts/audit-elevation.mjs`，不按本机程序扫描实施。

### 7.1 扫描来源（v1）

| 来源 | 实现 | 说明 |
|---|---|---|
| 开始菜单 | `[Environment]::GetFolderPath('Programs')` + `CommonPrograms`，递归 `*.lnk`，`WScript.Shell.CreateShortcut` 解析 `TargetPath` | 覆盖大多数已安装应用；当前用户 + 所有用户 |
| 桌面 | `DesktopDirectory` + `CommonDesktopDirectory`，`.lnk` 与直接 `.exe` | 用户常用工具 |
| App Paths | `HKLM/HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths`（含 `WOW6432Node`） | 高信号、条目少 |
| 运行中进程 | `Get-Process` 的 `Path` | 用户正在使用的程序；跳过空路径/受保护进程 |

**不做**：Program Files 全盘递归（噪声大、耗时长）、UWP/Store 应用、Startup 目录。

### 7.2 类型（建议）

```ts
// types/index.ts
export type ProgramScanSource = "startMenu" | "desktop" | "appPaths" | "process"

export interface ProgramCandidate {
  name: string
  path: string
  source: ProgramScanSource
}

export type ProgramScanOutcome =
  | { ok: true, programs: ProgramCandidate[], truncated: boolean, warnings: string[] }
  | { ok: false, kind: "env" | "timeout" | "powershell" | "unknown", message?: string }
```

### 7.3 纯函数（建议新增 `utils/programs.ts`）

- `MAX_SCANNED_PROGRAMS = 500`、`MAX_SCANNED_PROGRAMS_SCRIPT = 800`。
- `sanitizeProgramCandidate(raw)`：`path` 绝对且 `.exe`；`name` 去空白、去“ - 快捷方式”后缀、`sanitizeShortcutName` 兜底；`source` 白名单。
- `normalizeProgramScanPayload(data)`：兼容数组或 `{ programs, truncated, warnings }`；逐项清洗、按小写路径去重、上限裁剪。
- `mergeProgramCandidates(items)`：同路径保留来源优先级 `startMenu > desktop > appPaths > process`，名称优先非空/更友好。
- `planProgramAdditions(existingPaths, candidates, maxTools)`：返回 `accepted`、`duplicateCount`、`overflowCount`。
- `suggestProgramName(candidate, fallback)`：复用 `windowsBasename`。

### 7.4 PowerShell 脚本（建议新增 `buildScanProgramsScript()`）

继续复用 `buildPayloadScript` + Base64 JSON，脚本模板不拼接用户输入：

```powershell
$ErrorActionPreference = 'Stop'
$items = [System.Collections.Generic.List[object]]::new()
$seen = @{}
$warnings = [System.Collections.Generic.List[string]]::new()

function Add-Program([string]$name, [string]$path, [string]$source) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if ($path -notmatch '^[A-Za-z]:\\' -and $path -notmatch '^\\\\') { return }
  if ($path -notmatch '\.exe$') { return }
  $key = $path.ToLowerInvariant()
  if ($seen.ContainsKey($key)) { return }
  $seen[$key] = $true
  $script:items.Add([pscustomobject]@{ name = $name; path = $path; source = $source })
}

# 开始菜单 / 桌面 .lnk → WScript.Shell.CreateShortcut().TargetPath
# App Paths → (Get-Item -LiteralPath $key).GetValue('')
# Get-Process → $_.Path
# 输出：{ programs = @($items); truncated = ($items.Count -ge 800); warnings = @($warnings) }
#      | ConvertTo-Json -Compress -Depth 4
```

要点：
- 每条来源用 `-ErrorAction SilentlyContinue` / `try/catch` 包裹，单个失败只记 `warnings`。
- 脚本内上限 800，JS 侧再裁 500。
- 不写临时文件、不启动进程、不联网。

### 7.5 服务层（建议新增 `WindowsShellService.scanPrograms()`）

```ts
const SCAN_TIMEOUT = 60_000
const SCAN_MAX_OUTPUT = 4 * 1024 * 1024

async scanPrograms(): Promise<ProgramScanOutcome> {
  if (!this.isSupported()) return { ok: false, kind: "env", message: "Windows is required" }
  const executed = await this.execPowerShell(buildScanProgramsScript(), SCAN_TIMEOUT, SCAN_MAX_OUTPUT)
  if (!executed.ok) return { ok: false, kind: executed.kind ?? "unknown", message: executed.message }
  return normalizeProgramScanPayload(executed.data)
}
```

`execRaw` / `execPowerShell` 增加可选 `maxBuffer` 参数（默认仍 1MB）。

### 7.6 composable（建议新增 `scanPrograms()` / `addPrograms()`）

- `scanning` ref 防重入；`scanPrograms()` 调 `shell.scanPrograms()`，卸载后不写状态。
- `addPrograms(candidates)`：
  1. `planProgramAdditions(tools.value.map(t => t.path), candidates, MAX_TOOLS)`；
  2. 对 `accepted` 用 `runWithConcurrency(..., 4)` 调 `diagnoseExecutable`；
  3. 构造工具：`createToolId`、`sanitizeShortcutName`、`normalizeTargetPath`、`defaultWorkingDir`、`requireAdmin = diagnosis?.recommendedElevate ?? false`；
  4. 批量插入 `tools.value`，写入 `diagnoses`；
  5. 一次 `persist()`，失败回滚；
  6. 返回 `{ ok, added, duplicates, overflow }`。
- `addingPrograms` ref 防重入。

### 7.7 UI（建议新增 `components/ProgramScanDialog.vue`）

- `Dialog`（`size="large"`）+ 说明 + `Listbox`：
  - `multiple`、`checkbox`、`filter`、`maxHeight="340px"`；
  - `options`：`value: path`、`label: name + " · " + path`、`keywords: name + path`；
  - 已存在工具的路径 `disabled: true`，后缀“已添加”；
  - 使用 `Listbox` 的 `option` 作用域插槽渲染名称、来源 `Tag`、路径。
- 底部：已选数量、全选/清空、刷新扫描、取消、添加选中。
- 状态：`scanning`、`outcome.ok === false`（env/timeout/powershell/unknown）、`truncated`、`warnings`。
- `ElevationToolList` 工具栏与空态新增“扫描程序”入口；`index.vue` 管理对话框状态与成功/失败提示。

### 7.8 安全/性能/失败模式

- 扫描结果只作为字符串；添加前再次 `isAbsoluteWindowsPath + hasExeExtension` 校验。
- 不自动创建快捷方式（避免一次扫描污染桌面）；由用户后续手动创建。
- 结果不持久化；面板关闭/插件卸载时 `cancelActive()` 终止在途 PowerShell。
- 非 Windows/无 Node：扫描按钮隐藏或提示 `envNotSupported`。
- 失败降级：COM 不可用仍返回 App Paths/进程结果；注册表无权限跳过；超时返回 `timeout`。
- 上限：脚本 800、JS 500、超时 60s、输出 4MB。

### 7.9 新增 i18n（中英同步）

`scanPrograms`、`scanTitle`、`scanDescription`、`scanning`、`scanEmpty`、`scanFailed`、`scanTimeout`、`scanTruncated`、`scanAddSelected`、`scanSelectAll`、`scanClear`、`scanSelected`、`scanExisting`、`scanAdded`、`scanSkipped`、`scanOverflow`、`scanFilterPlaceholder`、`scanRefresh`、`scanSourceStartMenu`、`scanSourceDesktop`、`scanSourceAppPaths`、`scanSourceProcess`。

---

## 8. 修复实施顺序（建议，未执行）

### Phase A：诊断链路与状态机（P0-1/P0-4/P0-5）

1. 新增 `utils/diagnosisView.ts`，三组件改用 `presentDiagnosis()`。
2. composable 增加 `diagnosePath()`；`index.vue` 两个入口加 token + 路径一致性校验。
3. `DiagnosticsPanel` 增加 `update:path`，路径变化清空旧诊断。
4. 新增 `ShortcutState` / `ShortcutStatus`，`inspectShortcut` 返回显式状态，UI 区分“未检测/无效/无法检测”。
5. 增加 `diagnosingIds` 与 `isDiagnosing`，与 `busyIds` 分离。

### Phase B：持久化、并发、删除（P0-2/P0-3、P1-2/P1-3/P1-9）

1. `persistChain` 执行时读最新 `tools.value`；所有调用方检查返回值并回滚。
2. `busyIds` 升级为操作锁；await 后复核工具仍在列表。
3. `deleteTool` 只移除成功项；失败保留工具；`deleteFailures` 接入 UI。
4. 单条快捷方式删除加 `ConfirmDialog`；回收站失败回退顺序。
5. `createShortcutFor` 达上限返回 `kind: "limit"`，不静默淘汰。
6. `load()` 清理 `diagnoses`/`shortcutStatuses`；对话框关闭清理 `pendingOverwrite`/`deleteTarget`。

### Phase C：安全与解析（P1-1/P1-5~P1-8/P1-10）

1. `sanitizeTool` 校验 path/name/workingDir，复用 `ARGUMENTS_MAX` / `isShortcutLocation`。
2. 系统命令绝对路径解析；PowerShell 不回退 PATH；权限检测并行。
3. `createShortcut` 结果校验绝对 `.lnk`；创建前校验目标存在。
4. manifest：合并 PE 头解析、缺 level → unknown、ARMNT → unknown、`virtualSize` 参与映射。
5. `windowsDirname` 根路径修正。

### Phase D：去重与死代码

1. 类型收敛（§4.1）；错误诊断工厂；`runWithConcurrency`。
2. 删除 §4.3 的死代码；`description` 全链路移除；`SHORTCUT_HEADER_SIZE`/`withRunAsAdminFlag`/`createBufferPeReader` 清理。
3. 删除未引用 i18n；`shortcutUpdateFailed` 接入或删除。

### Phase E：自动扫描程序（§7）

按 §7.2-§7.9 新增类型、纯函数、脚本、服务、composable、对话框、i18n、测试。

### Phase F：验证与文档

1. `pnpm test`（AI 可执行）。
2. 用户执行 `pnpm typecheck` / `pnpm lint` / `pnpm i18n:verify` / `pnpm validate:icons` / `pnpm audit:storage`。
3. 更新 `src/features/elevationAssistant/README.md`：新增“程序扫描”章节与存储说明。
4. 本报告在修复完成后 `git mv` 到 `docs/completed/`，并在 `docs/README.md` 归档表登记。

---

## 9. 验收清单（实施后）

- [ ] 编辑器/临时检测连续触发时，只显示最后一次请求对应路径的诊断。
- [ ] 诊断期间修改路径，不会用旧诊断自动改 `requireAdmin`/名称/工作目录。
- [ ] 快捷方式状态未检测显示“未检测”，EACCES 显示“无法检测”，不再绿色“存在”。
- [ ] 编辑器与诊断报告对 `uiAccess` 程序结论一致；非 exe 显示“仅支持 .exe”。
- [ ] 保存失败时新增/更新回滚，UI 明确提示；删除/创建不谎报成功。
- [ ] 删除工具部分快捷方式失败时工具保留，失败路径可见且可重试。
- [ ] 快捷方式达到 10 条时拒绝并提示，不产生孤儿 `.lnk`。
- [ ] 单条快捷方式删除有确认；回收站失败按顺序回退。
- [ ] `whoami`/`reg`/PowerShell 使用绝对系统路径；权限检测并行（最坏 15s）。
- [ ] manifest 缺 level 显示“无法判断”；ARMNT 不显示 arm64；PE 头只解析一次。
- [ ] 根目录 exe 的默认工作目录为 `C:\`。
- [ ] 扫描在 Windows 返回开始菜单/桌面/App Paths/进程候选；无 UAC、无写盘、不执行目标。
- [ ] 扫描结果去重、上限 500、已存在工具禁用；批量添加遵守 50 条上限并一次落盘。
- [ ] 关闭面板/插件卸载后在途 PowerShell 被终止；无残留子进程。
- [ ] `pnpm test` 全绿；用户侧 5 项检查通过。

---

## 10. 明确不做 / 待确认

1. **本次未修改任何源码**，仅新增本审查文档并更新 `docs/README.md` 索引。
2. “自动扫描出程序”按“扫描本机程序加入工具列表”设计；若指代码静态审查脚本，改为 `scripts/audit-elevation.mjs`，本机扫描方案作废。
3. v1 不递归 Program Files，不扫 UWP/Store 应用与 Startup 目录；如需要可作为后续可选项。
4. 部分快捷方式删除失败时保留工具（而非强制移除）；如希望“工具一定删除”，需调整 P1-2 的删除语义。
5. 不校验数字签名（与现有 README 一致）；扫描只提供路径线索，最终由用户确认。
6. 不新增依赖、不新增存储槽、不新增图标；扫描按钮复用现有 `search` 图标。
