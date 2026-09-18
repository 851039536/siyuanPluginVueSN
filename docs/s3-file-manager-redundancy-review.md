# S3 文件管理模块 —— 冗余重复专项审查报告

审查对象：`src/features/s3FileManager/`（`index.ts` + `index.vue` + 8 个 `.vue` + 13 个 composable/工具 + 9 个 `.scss`，共 32 个文件）
对照范围：`src/components/`（共享组件库）、`src/utils/s3/`（S3 共享层）、`src/features/s3Backup/`（姊妹模块）
审查依据：`AGENTS.md § 共享组件库使用规则（强制）` / `§ 硬规则`、`AGENTS_ARCH.md § 强制规则：模块提取判定标准` / `§ 单文件行数上限`、`AGENTS_STYLE.md § 背景与过渡对齐 gitPush 范式` / `§ SCSS 必须分离到 styles/ 目录`
审查日期：2026-09-11
整改状态：**✅ 已全部实施**（见 § 十一，`pnpm typecheck` / `i18n:verify` / `validate:icons` 全通过）

---

## 一、结论摘要

| 类别 | 项数 | 最高严重度 | 说明 |
|---|---|---|---|
| 自建同类控件（与共享组件重复） | 5 项 | P1 | 5 个模态外壳、1 个工具栏、1 个徽章、1 个菜单、1 个进度条 |
| 模块内逻辑复制粘贴 | 3 项 | P1 | 面包屑段计算、delimiter 降级聚合、双确认 API |
| 与姊妹模块/共享层重复 | 4 项 | P1 | 重试器、并发常量、日志上限、存储键字面量 |
| 死代码 / 冗余载体 | 6 项 | P2 | 13 处注释日志、死 import、死 conflicts、死 prop、死回退分支 |
| 真实功能缺陷（审查附带发现） | 1 项（R23） | P1 | 右键菜单测量失效导致定位溢出 |
| 规则红线 | 2 项 | P1 | `index.vue` 539 行超 500 硬阈值；遮罩 `z-index` 2000 偏离统一 10000 |

**总体判断**：本模块的 **composable 分层与依赖注入是可用的**（8 个 composable 职责清晰、无内部互导、`useEscClose` 的 LIFO 栈设计正确），但 **UI 层几乎完全绕开了共享组件库** —— 5 个弹窗各自手写一整套 modal 外壳（`.fm-dialog-mask` / `.fm-dialog` / `-header` / `-body` / `-footer`），等于在 feature 内复制了一份 `Dialog.vue` 的职责。这是本次审查最大的一块冗余。

> 值得注意的强对照：**同一个仓库的姊妹模块 `s3Backup` 在这些位置全部使用了共享组件**（`Tag` 做成功/失败徽章、`Toolbar`? 否、`ProgressBar` 做进度条），而本模块全部自建。这是「同一问题已有正解却未复用」的直接证据，不属 Rule of Three 的「尚未到抽象时机」。

---

## 二、P1：与共享组件库重复（自建同类控件）

### R1. 5 个弹窗各自手写 modal 外壳 —— 实际是复制了一份 `Dialog.vue`

| 文件 | 行数 | 自建外壳涉及行 |
|---|---|---|
| `components/FmConfigDialog.vue` | 266 | 3-18（mask/header）、107-140（footer） |
| `components/FmNameDialog.vue` | 105 | 3-18、35-54 |
| `components/FmMoveCopyDialog.vue` | 188 | 3-18、84-106 |
| `components/FmLogPanel.vue` | 134 | 3-30 |
| `index.vue`（顶部关闭） | — | 5-15 |

共享基座样式集中在 `styles/index.scss:123-180`，共 8 个类／58 行：`.fm-dialog-mask`、`.fm-dialog`、`.fm-dialog-header`、`.fm-dialog-title`、`.fm-dialog-body`、`.fm-dialog-footer`、`.fm-dialog-footer-right`。

**违反规则**：`AGENTS.md:191` 明确列出「**对话框（模态弹层）**」为必须使用共享组件的场景；`AGENTS.md:303` 硬规则重申。共享 `src/components/Dialog.vue` 在本仓库已有 3 处 feature 在用（`gitPush/LineStats/FetchFailuresDialog.vue`、`ListView/AiErrorAnalysisDialog.vue`、`ListView/WorkingTreeDiffDialog.vue`）。

**自建带来的具体行为差距**（`Dialog.vue` + 私有 `overlay/useOverlay.ts` 已解决，本模块缺失）：

| 能力 | 共享 `Dialog.vue` | 本模块自建 |
|---|---|---|
| 遮罩点关语义 | 「遮罩上按下**并**抬起」才算（`useOverlay.ts:55-66`） | `@click.self`（`FmConfigDialog.vue:5` 等）——弹层内按下、拖到遮罩上抬起会**误关** |
| 焦点接管 / 归还 | 打开时聚焦 `[autofocus]`→容器，关闭归还开启前元素 | **完全没有** —— Esc 关闭后焦点丢失在 `<body>` |
| 无障碍语义 | `role="dialog"` + `aria-modal` + `aria-labelledby` | **完全没有** |
| 位置 / 尺寸档位 | 九档 `position` + 四档 `size` | 各弹窗硬编码 `width: 520px / 360px / 440px / 560px` |
| 过渡动效 | fade + scale 0.98（0.12s ease） | **无过渡** |

**建议**：5 个弹窗改为 `Dialog` + `ConfirmDialog` 承载，删除 `styles/index.scss:121-180` 的弹窗基座（58 行）与 `useEscClose.ts`（48 行，随之外置为组件内建能力）。

> 附带收益：`useEscClose.ts` 之所以存在，正是因为自建外壳没有 Esc 能力。它本身实现正确（LIFO 栈按注册顺序关闭最近且激活的弹层），但属 R1 的衍生文件 —— 迁移后整文件删除。

### R2. `FmToolbar.vue` 未使用共享 `Toolbar`

`components/FmToolbar.vue:3-127` 结构为「左 group → spacer → 右 group」，与共享 `Toolbar.vue` 的 `start` / `center` / `end` 三段式**语义完全对应**。自建样式 `styles/FmToolbar.scss`（30 行）中的 `.fm-toolbar` / `.fm-toolbar-group` / `.fm-toolbar-spacer` 即 Toolbar 的既有职责。

**违反规则**：`AGENTS.md:191` 列出「**工具栏**」为必须使用共享组件的场景。仓库先例：`gitPush/LineStats/LineStatsToolbar.vue:54`、`toolCollection/tools/shortcut/components/PanelHeader.vue:101`。

**建议**：改 `Toolbar`（`start` 放上传/新建文件夹/选中项操作组，`end` 放视图切换 + 日志/配置入口），删除 `styles/FmToolbar.scss` 的布局类，仅保留 `.fm-selected-count`。

### R3. `FmLogPanel.vue` 自建成功/失败徽章，未用共享 `Tag`

`styles/FmLogPanel.scss:42-58` 的 `.fm-log-badge` + `&.success` / `&.error`（`color` + `border-color` 描边胶囊）**与共享 `Tag.vue` 的 `variant="success"|"danger"` 默认外观逐字对应**。

**违反规则**：`AGENTS.md:191` 列出「**标签**」「**徽标**」为必须使用共享组件。

**直接对照证据**：姊妹模块 `s3Backup/components/BackupLogCard.vue:45-52` 在同一场景（日志成功/失败徽章）用的正是 `<Tag :variant="log.success ? 'success' : 'danger'" size="xsmall">`。本模块 `index.vue` 也确实已在用 `ConfirmDialog`，说明作者熟悉共享库 —— 此处属遗漏而非有意偏离。

**建议**：`FmLogPanel.vue:47-50` 改为 `<Tag :variant="log.success ? 'success' : 'danger'" size="xsmall">`，删除 `.fm-log-badge` 样式块。

### R4. 面包屑 + 文件夹项 + 列头共 9 处原生 `<button>`

| 位置 | 处数 | 行号 |
|---|---|---|
| `FmBreadcrumb.vue` | 2 | 17（根节点）、33（路径段） |
| `FmMoveCopyDialog.vue` | 3 | 23（根节点）、38（路径段）、68（子目录项） |
| `FmEntryList.vue` | 3 | 37 / 47 / 57（列头，名称/大小/日期） |
| `FmContextMenu.vue` | 1 | 15（菜单项，见 R5） |

**违反规则**：`AGENTS.md:191` 首位即「**按钮**」；例外仅限「纯展示的局部布局容器」与 `.icon-btn` 26×26 固定尺寸图标按钮（`AGENTS_STYLE.md:188`），面包屑文本按钮不属于任一例外。共享 `Button` 的 `variant="ghost"` + `text` 已覆盖此观感。

**建议**：
- 面包屑 5 处 → `Button variant="ghost" text size="xsmall"`（根节点用 `icon="s3FileManager"`）
- 列头 3 处 → 语义上是**表格列头**而非按钮，可保留原生元素但必须补 `aria-sort="ascending|descending|none"`（当前 3 个按钮均无任何 aria 状态，读屏无法感知排序方向）；或改 `<table>` + `<th aria-sort>` 语义（`gitPush/CodeReport/HotspotSection.vue:29-36` 有 `<th>` 先例）

### R5. `FmContextMenu.vue` 与共享 `TieredMenu` 的 `popup` 模式职责重叠

`components/FmContextMenu.vue`（98 行）+ `styles/FmContextMenu.scss`（43 行）= 141 行，实现内容：

| 自建实现 | 共享 `TieredMenu` `popup` 模式 |
|---|---|
| `Teleport to="body"` + 全屏 mask（`z-index: 2100`） | 不 Teleport，就地 `position: fixed` + 点外部关闭 |
| `nextTick` 后测量 + 视口钳制（63-87） | `tieredMenu/position.ts` 纯函数双向钳制 |
| `useEscClose` 关闭 | 内建 Esc + `update:visible` |
| 自建 `.fm-context-menu-item` 按钮（15-27） | 内建菜单项（图标 + 文案 + roving tabindex + 方向键） |
| 无 `role` / 无键盘导航 | `role="menu"` / `menuitem` + 方向键漫游 |

**违反规则**：`AGENTS.md:189-192`「优先复用，禁止在 feature 内自建同类控件」「共享组件缺能力时：先扩展共享组件…禁止在 feature 内复制一份改改」。`AGENTS.md:191` 列出「**级联菜单（逐级下钻）**」，而 `TieredMenu` 的 `popup: true` 正是「右键菜单形态」（`componentPreview/README.md:25` 原文）。

**另一处范式偏离**：全库 48 个组件一律「不 Teleport，就地 fixed」（`Dialog` / `Select` / `ConfirmPopup` / `TieredMenu` 文档均明示），本组件是全模块唯一的 `Teleport`。

**建议**：改用 `TieredMenu :model popup` + `defineExpose` 的 `show(event)`，`FmMenuItem` 映射为 `TieredMenuItem`（`{ key: action, label, icon, command }`），`danger` 走 `command` 内自行着色或扩展共享组件（按规则「先扩展共享组件」）。可整体删除 141 行自建代码。

---

## 三、P1：模块内逻辑复制粘贴

### R6. 面包屑段计算在 2 处逐字重复

```ts
// composables/useS3Entries.ts:51-57
const pathSegments = computed(() => {
  const root = deps.getRootPrefix()
  const relative = currentPrefix.value.startsWith(root)
    ? currentPrefix.value.slice(root.length)
    : currentPrefix.value
  return splitPrefixSegments(relative)
})
```
```ts
// components/FmMoveCopyDialog.vue:144-149 —— 除变量名外逐字相同
const segments = computed(() => {
  const relative = currentPrefix.value.startsWith(props.rootPrefix)
    ? currentPrefix.value.slice(props.rootPrefix.length)
    : currentPrefix.value
  return splitPrefixSegments(relative)
})
```

**违反规则**：`AGENTS.md:121`「**强制规则**：同一常量/工具函数被 2 个以上文件使用时，必须提取到对应的 `types/` 或 `utils.ts`，禁止复制粘贴」；`AGENTS_ARCH.md:207` 同。

**建议**：在 `utils.ts` 增加纯函数 `relativeSegments(prefix: string, root: string): string[]`，两处改为调用。

### R7. delimiter 降级聚合 + 冲突告警块重复（且注释副本共 3 份）

```ts
// composables/useS3Entries.ts:95-104
const agg = aggregateEntries(listing.files, prefix)
files = agg.files
folders = [...new Set([...listing.folders, ...agg.folders])]
if (agg.conflicts.length > 0) {
  // console.warn("[S3文件管理] 发现同名文件夹/文件冲突:", agg.conflicts.join(", "))
}
...
```
```ts
// components/FmMoveCopyDialog.vue:163-167 —— 同一模式
const agg = aggregateEntries(listing.files, prefix)
folders.value = [...new Set([...listing.folders, ...agg.folders])]
if (agg.conflicts.length > 0) {
  // console.warn("[S3文件管理] 目标目录发现同名文件夹/文件冲突:", agg.conflicts.join(", "))
}
```

同一「取 listing → 聚合 → 合并 folders 去重 → 检查 conflicts」流程出现 **3 次**（`useS3Entries.ts:95`、`useS3Entries.ts:107` 的降级分支、`FmMoveCopyDialog.vue:163`），已达 Rule of Three。

**建议**：提取 `mergeListingFolders(listing: S3DirListing, prefix: string): { files: S3FileInfo[]; folders: string[] }` 到 `utils.ts`。

### R8. 确认框双 API 并存（两个入口做同一件事）

`index.vue` 中同时存在两个构造 `confirmState` 的函数：

| 函数 | 行号 | 形态 | 调用点 |
|---|---|---|---|
| `requestConfirm` | 312-319 | 回调式（`onConfirm: () => void`） | 265（清空日志）、483（删除） |
| `requestConfirmAsync` | 322-332 | Promise 式（`resolve(true/false)`） | 291（注入 `useS3Transfer`） |

两者写入同一个 `confirmState`、共用同一组 `handleConfirmAccept` / `handleConfirmCancel`（334-346），唯一差别是「确认结果如何回传」。

**违反规则**：`AGENTS.md:85` 对同类的「两套模式并存」明令禁止（原文针对实例挂载：「禁止…（两套模式并存）」）；`AGENTS.md` 统一入口原则要求同一操作只有一个入口。

**建议**：只保留 Promise 版，回调调用点改为 `void requestConfirmAsync(...).then((ok) => { if (ok) ... })`；或反之。可删除约 8 行并消除双份语义。

---

## 四、R23（P1，附带发现的真实功能缺陷）：右键菜单定位测量失效

`components/FmContextMenu.vue`：

```vue
<!-- 10-14：模板中 <div class="fm-context-menu"> 没有绑定 ref -->
<div class="fm-context-menu" :style="menuStyle" @click.stop>
```
```ts
// 63-64
const menuRef = ref<HTMLElement | null>(null)
const menuSize = ref({ width: 160, height: 0 })
// 67-77：watch 内 nextTick 后读 menuRef.value —— 恒为 null
// 80-87：menuStyle 用 menuSize.value.height 做垂直钳制
```

`grep menuRef` 全文件仅 2 处（声明 63、读取 72），**模板中没有任何 `ref="menuRef"`**。因此：

1. `menuRef.value` 恒为 `null`，`menuSize` 永远停在初始值 `{ width: 160, height: 0 }`；
2. `maxY = window.innerHeight - 0 - 8`，垂直钳制按「菜单高 0px」计算 → **右下角右键时菜单底部溢出视口**；
3. 整个 `watch` + `nextTick` 测量逻辑（15 行）是死代码。

与文件头注释「点击外部/Esc 关闭」及 79 行注释「避免右下角菜单溢出视口」的声明直接矛盾。

**修复**：模板补 `ref="menuRef"`；或按 R5 迁移到 `TieredMenu`（其定位由 `position.ts` 纯函数承担，天然无此问题）。

---

## 五、P1：与姊妹模块 / 共享层的重复

### R9. 重试执行器与重试次数常量重复

| 位置 | 实现 |
|---|---|
| `s3FileManager/composables/useS3Transfer.ts:68-77` | `withRetries(task)` —— 耗尽后 `throw` |
| `s3Backup/utils.ts:33-45` | `withRetry(task, failLabel)` —— 耗尽后返回 `false` + `console.warn` |
| `s3FileManager/types/index.ts:102` | `TRANSFER_MAX_RETRIES = 2` |
| `s3Backup/types/index.ts:131` | `TRANSFER_MAX_RETRIES = 2` |

同一重试循环（`for (attempt = 0; attempt <= TRANSFER_MAX_RETRIES; attempt++)`）在两个模块各写一份，常量也各定义一份。

**已知正解先例**：`src/utils/s3/concurrency.ts` 的头部注释即写明「**从 s3Backup/utils.ts 提升**的简易并发池与主机名获取…供 s3Backup / s3FileManager 等功能模块共用」—— 本仓库对「两模块共用的 S3 能力」已有明确的提升路径与既定做法。

**建议**：`TRANSFER_MAX_RETRIES` 提升至 `@/utils/s3/types`；重试器提升至 `@/utils/s3/concurrency`（或新增 `retry.ts`），参数化「失败后抛错 / 返回布尔」两种出口以满足两边语义。

### R10. 并发常量与日志上限的跨模块重复

| 常量 | s3FileManager | s3Backup | 值 |
|---|---|---|---|
| 日志条数上限 | `MAX_LOG_COUNT`（types:90） | `MAX_LOG_COUNT`（types:146） | 200 |
| 日志清单上限 | `MAX_LOG_DETAIL_FILES`（types:93） | `MAX_LOG_DETAIL_FILES`（types:149） | 200 |
| 重试次数 | `TRANSFER_MAX_RETRIES`（types:102） | `TRANSFER_MAX_RETRIES`（types:131） | 2 |
| 批量对象并发 | `FILE_OP_CONCURRENCY`（types:96）= 4 | `INCREMENTAL_CONCURRENCY`（types:137）= 4 | 4（异名同值） |
| 传输并发 | `TRANSFER_CONCURRENCY`（types:99）= 2 | `FULL_UPLOAD_CONCURRENCY`（types:134）= 2 | 2（异名同值） |

前 3 项**同名同值**，属明确重复；后 2 项异名同值、语义不同（文件管理批量 vs 备份增量），按 Rule of Three 尚不必强行合并。

**建议**：前 3 项随 R9 一并提升至 `@/utils/s3/types`（跨 feature 禁止互导，共享层是唯一合规出口）。

### R11. `s3-backup-config` 存储键字面量在 2 处硬编码

```ts
// s3Backup/types/index.ts:282（S3BackupStorage 的 STORAGE_KEYS 内）
S3_CONFIG: "s3-backup-config",
```
```ts
// s3FileManager/types/storage.ts:23-24
/** s3Backup 的 S3 配置存储键（跨模块只读共享，禁止写入） */
const S3_BACKUP_CONFIG_KEY = "s3-backup-config"
```

跨模块数据契约靠**字符串字面量**维系：`s3Backup` 侧改键名时，`s3FileManager` 的「从 S3 备份导入」会**静默失效**（`FmConfigDialog.vue:221-225` 的 `backupConfigReadonly.load()` 返回默认值 → 走 `importNoBackupConfig` 提示，不报错）。

**建议**：键名提升为 `@/utils/s3/types` 的导出常量，两侧引用同一来源。

---

## 六、P2：死代码 / 冗余载体

### R12. 13 处被注释掉的 `console.*`（调试期痕迹未清理）

| 文件 | 行号 |
|---|---|
| `useS3FmClient.ts` | 51 |
| `useS3Entries.ts` | 84、99、111 |
| `useS3FileOps.ts` | 81、100 |
| `useS3Transfer.ts` | 176、370 |
| `useFileOpLogs.ts` | 21、44 |
| `FmConfigDialog.vue` | 201 |
| `FmMoveCopyDialog.vue` | 166、170 |

对照姊妹模块 `s3Backup/utils.ts:40` 保留**活跃**的 `console.warn` 记录重试耗尽。本模块把错误可见性整体关掉，且留下 13 行注释噪声。

**其中 1 处已产生副作用**：`composables/useFileOpLogs.ts:19` 的 `import { getErrorMessage } from "@/utils/stringUtils"` 仅在注释（21、44）中被引用 → **死 import**，触发 `eslint.config.mjs:80` 的 `unused-imports/no-unused-imports: warn`。

**另注意**：`useS3FmClient.ts:51` 注释里引用了 `getErrorMessage`，但该文件**并未导入**它（`import` 只有 7-13 行）—— 直接取消注释会编译失败。

**建议**：要么恢复为活跃 `console.warn`（对齐 s3Backup），要么整行删除；删除 `useFileOpLogs.ts` 的死 import。

### R13. `aggregateEntries` 的 `conflicts` 计算结果从未被使用

```ts
// utils.ts:59-82 —— 每次调用都构造 conflicts 数组
const conflicts = [...folderSet].filter((folder) => fileNames.has(nameFromKey(folder)))
return { files: directFiles, folders: [...folderSet], conflicts }
```
3 个消费点（`useS3Entries.ts:98-100`、`useS3Entries.ts:110-112`、`FmMoveCopyDialog.vue:165-167`）全部只做 `if (agg.conflicts.length > 0) { /* 注释 */ }` —— **判断结果被丢弃**。

即：`conflicts` 的计算成本（遍历 + `Set` 查询）与 3 处判断分支均为**纯死逻辑**。

**建议**：随 R12 一并处理 —— 恢复日志则 conflicts 有意义；否则从返回值中移除该字段。

### R14. `FmToolbar` 的 `isConfigured` 是死 prop

```vue
<!-- index.vue:39-41：FmToolbar 只在 v-else 分支（isConfigured === true）渲染 -->
<template v-else>
  <FmToolbar :is-configured="isConfigured" ... />
```
```vue
<!-- FmToolbar.vue:134：prop 声明 -->
isConfigured: boolean
<!-- FmToolbar.vue:10、21：!isConfigured 恒为 false -->
:disabled="!isConfigured || busy"
```

`v-if="!isConfigured"` 的空态（`index.vue:18-36`）已保证 `FmToolbar` 挂载时 `isConfigured` 恒 `true`，该 prop 与两处 `||` 分支都是冗余数据传递 —— 违反 `AGENTS.md:275`「冗余的数据拷贝，所有权混乱」的精神。

**建议**：删除 `isConfigured` prop，两处 `:disabled` 简化为 `:disabled="busy"`。

### R15. 两处原生 `confirm()` 回退分支是死路径

| 位置 | 代码 | 实际 |
|---|---|---|
| `useS3Transfer.ts:48-51` | `if (deps.confirmAction) {...}; return confirm(message)` | `index.vue:291` 恒注入 `confirmAction` → 回退不可达 |
| `FmLogPanel.vue:117-128` | `hasConfirmHost` 为假时 `confirm(props.i18n.confirmClearLogs)` | `index.vue:197` 恒传 `requestClearConfirm` → 回退不可达 |

两处「回退原生 confirm」构成**双实现并存**（同 R8 模式），且原生 `confirm` 在 Electron 下阻塞渲染进程，与共享 `ConfirmDialog` 的统一入口（`index.vue:203-213` 已在用）不一致。

**建议**：删除回退分支，把注入参数改为必填；`FmLogPanel` 不必再自查 `hasConfirmHost`。

### R16. `README.md` 与实现漂移 2 处

| README 声明 | 实际 | 位置 |
|---|---|---|
| 「Vue 3 persistent Modal（**90vw** × 85vh）」 | `width: "72vw"` | README:32 vs `index.ts:28` |
| 「未实现 Multipart 分片上传与**拖拽**（可选二期）」 | **拖拽已完整实现**：外部拖入（`useExternalDrop.ts` + `index.vue:71-77`）、内部拖到文件夹移动（`FmEntryList.vue:178-224`） | README:37 |

Multipart 部分亦需更新口径：共享层 `src/utils/s3/s3Multipart.ts` 已提供 `uploadFileSmart`，`s3Backup` 三条上传路径已在用，本模块是**唯一未接入**的 S3 上传方（`useS3Transfer.ts:170` 走 `client.uploadBuffer` 整包）——README 的「未实现」应写明为「未接入共享层已有的 `uploadFileSmart`」。

---

## 七、P2/P3：规则红线与观察项

### R17. `index.vue` 539 行，超 500 行硬阈值（P1）

`AGENTS.md:299`：「单文件行数上限：300 行警戒线，**500 行硬阈值**」；`AGENTS_ARCH.md:159`：「> 500 行必须拆」。当前 539 行（模板 215 行 + 脚本 320 行）。

其中可外移的独立职责：
- 确认框编排（`confirmState` + `requestConfirm*` + `handleConfirm*`，302-346）→ `composables/useFmConfirm.ts`
- 右键菜单项生成（`contextMenuItems`，372-386）→ 随 R5 迁移到菜单模型
- 视图偏好持久化（`prefs` + `setViewMode` + `savePrefs` + 两个 watch，299/362-368/493-502）→ `composables/useFmPrefs.ts`

### R18. 遮罩 `z-index` 与底色偏离统一范式（P1）

```scss
// styles/index.scss:123-132
.fm-dialog-mask {
  z-index: 2000;                                          // ← 规范：10000
  background: var(--b3-mask-background, $c-fg);            // ← 规范：rgba(0,0,0,0.5)
}
```

`AGENTS_STYLE.md:295` 要求遮罩统一 `rgba(0, 0, 0, 0.5)` 且**禁止 `backdrop-filter`**；`:298` 要求「全屏遮罩统一 `z-index: 10000`」。`gitPush/styles/Dialog.scss:34-35` 是参照实现（`rgba(0,0,0,0.5)` + `10000`）。

另：`$c-fg` 是**深前景色** `hsl(24 10% 5%)`（近纯黑），作为遮罩色 fallback 属**语义错位**（遮挡层应取中性黑，而非「前景文字色」）；`FmContextMenu.scss:9` 的 `2100` 同理偏离。

**建议**：随 R1 迁移到共享 `Dialog` 后自然对齐；若暂时保留自建外壳，至少改为 `rgba(0, 0, 0, 0.5)` + `z-index: 10000`。

### R19. 排序方向与面包屑分隔符用字符代图标（P2）

| 位置 | 字符 | 可用 IconKey |
|---|---|---|
| `FmEntryList.vue:45、55、65` | `▲` / `▼` | `chevronUp` / `chevronDown`（`icons.ts:742-747`）或 `sort`（`:710`） |
| `FmBreadcrumb.vue:32` | `&#9656;`（▸） | `chevronRight`（`icons.ts:603`） |
| `FmMoveCopyDialog.vue:37` | `&#9656;` | 同上 |

`AGENTS.md:296` 硬规则「图标规则：禁止使用 emoji 表情作为图标…使用 `FEATURE_ICONS` / `COMMON_ICONS` 已注册的 Iconify 图标」。仓库既有审查已把「字符代图标」列为违规项（`docs/gitPush-listview-controls-review.md:33`），本模块为同类问题。

**建议**：`▲▼` → `<IconWrapper :name="sortAsc ? 'chevronUp' : 'chevronDown'" :size="10" />`；`▸` → `<IconWrapper name="chevronRight" :size="10" />`。分隔符随后需从 SCSS 的 `font-size` 微调改为容器间距。

### R20. 进度条自建，且同一面板内两次重复（P2）

`index.vue` 有两段结构几乎相同的进度块：

| 块 | 行号 | 数据源 |
|---|---|---|
| 传输进度 | 78-94 | `transferProgress`（`useS3Transfer.TransferProgress`：`label`/`currentFile`/`done`/`total`/`percent`） |
| 批量操作进度 | 96-111 | `opProgress`（`useS3FileOps`：`label`/`done`/`total`）+ `opPercent` computed（`index.vue:359`） |

样式 `styles/index.scss:51-93` 又为二者共用一套 `.fm-progress*`（43 行）。两个进度模型（`TransferProgress` vs 内联对象）也是 R8/R15 同类的「双实现」。

**依据强度说明**：`AGENTS.md:191` 的强制枚举**未逐字包含「进度条」**，因此本项不属该条的强制违规；依据是 `:189` 「优先复用」泛原则 + `:192` 「共享组件缺能力时先扩展共享组件」，且姊妹模块 `s3Backup/components/BackupProgressSection.vue:29` 在同一场景**已使用共享 `ProgressBar`**。

**建议**：统一为一个进度模型（建议 `{ label, currentFile?, done, total }`，百分比由组件算）+ 共享 `ProgressBar`，两处模板合并为一段（可用 `:current-file` 条件渲染）。

### R21. 死折叠用原生 `<details>` / `<summary>`（P2）

`FmLogPanel.vue:63-83` 的失败清单展开用原生 `<details>` + `<summary>`。`AGENTS.md:191` 列出「**可折叠面板**」为必须使用共享组件的场景（共享 `Panel.vue`）。

**建议**：若保留模块弹窗形态，可用 `Panel toggleable`；若迁移到共享 `Dialog`（R1），仍建议 `Panel` 承载折叠。注：`Panel` 折叠为 `v-show` 瞬时收起（不做高度动画），观感与 `<details>` 的瞬时展开一致，无视觉回归。

### R22. 观察项（不建议本轮改动）

| # | 项 | 判定 |
|---|---|---|
| O1 | `useS3Entries.ts:128-130` `navigateTo` 是 `loadDir` 的纯别名（无附加语义） | 可删 3 行；保留亦可（语义化命名） |
| O2 | `index.vue:390-392` `handleItemClick`、`436-438` `handleUpload` 等为纯转发包装 | 轻微；转发层便于模板可读，可留 |
| O3 | `useS3Selection.ts:21` `selectedCount` 是 `selectedEntries.length` 的二次 computed | 冗余间接层，可直接消费 `selectedEntries.length` |
| O4 | 8 个子组件全部 `@use "../styles/index.scss"`，但仅 `index.vue` 真正使用其中的类（已逐一核对：`FmToolbar` / `FmBreadcrumb` / `FmEntryList` / `FmContextMenu` 模板对 index.scss 的 18 个类**零命中**） | ⚠️ **不作为违规** —— `AGENTS_STYLE.md:365-369` 明确要求「子组件导入模式：双行导入」，本模块符合规则。但 R1 迁移后 `index.scss` 弹窗基座（58 行）消失，届时第二行导入可整体去掉，顺带消除 scoped 产物中的重复选择器 |
| O5 | i18n 跨模块文案重复：`s3FileManager.json` 与 `s3Backup.json` 有 **29 个同名 key**，其中 **23 个值逐字相同**（`endpoint` / `accessKey` / `secretKey` / `bucket` / `region` / `pathStyle` / `useSSL` / `testConnection` / `testException` / `prefix` / `refresh` / `delete` …） | 二者共享同一 `S3Config` 接口（`@/utils/s3/types:10-33`），S3 连接字段文案本属共享层。但 i18n 按 feature 分片是**既定架构**（`AGENTS_I18N.md`），跨 feature 共享文案无既有机制；且 `clientNotInitialized` 已开始漂移（fm：「S3 客户端未初始化，请先配置连接」/ bk：「S3 客户端未初始化」）说明**分片比共享文案更容易漂移**。建议列入待办，评估顶层 `s3Common` 命名空间可行性，不在本轮强改 |
| O6 | 跨 feature 导入 `@/features/statusBar/composables/useStatusBarTask`（`useS3Transfer.ts:17`） | ✅ **合规** —— `AGENTS.md:159` 统一入口表明确允许「状态栏任务 \| useStatusBarTask \| `@/features/statusBar/composables/useStatusBarTask`」 |
| O7 | `useStatusBarTask` 的图标传 `"mdi:folder-network"` 字符串（`useS3Transfer.ts:56`） | 该 API 签名为 `(taskId: string, icon: string)`，非 IconKey 约束，属既有接口设计，非本模块问题 |
| O8 | `FmEntryList.vue` 以**函数 prop** 接收 `isSelected`（`index.vue:121`） | 函数体读 `selectedKeys.value`，在渲染中调用可正确收集依赖，功能无误；更干净的做法是传 `selectedKeys` Set 本身。轻微 |

---

## 八、合规项（已核对通过，避免误报）

| 检查项 | 结论 |
|---|---|
| 文件头注释（`AGENTS_ARCH.md:86-116`） | ✅ 32 个 `.ts`/`.vue` **全部具备**功能说明注释（另含 i18n 键中文注释与区块注释，符合 `AGENTS.md:312`） |
| Composable 依赖注入（`AGENTS_ARCH.md:40-73`） | ✅ 8 个 composable 全部为「工厂函数 + `deps` 对象」，**无一个在内部 import 其他 composable** |
| 逻辑未下放子组件（`AGENTS_ARCH.md:18-36`） | ✅ 子组件保持展示角色；`FmConfigDialog` 自包含（自加载 + 自持久化）符合 `AGENTS.md:265-282` 子组件自包含规则 |
| 跨功能联动（`AGENTS.md:135`） | ✅ 模块内**零** `from "@/features/xxx"` 直接导入（唯一命中是 O6 的合规例外） |
| i18n 硬编码兜底（`AGENTS_I18N.md:70-86`） | ✅ 零命中 `i18n.xxx \|\| '中文'` |
| 裸定时器（`AGENTS.md:309`） | ✅ 零命中 `setInterval` / `setTimeout`；状态栏任务自清定时器由 `useStatusBarTask` 内部 `TimerRegistry` 托管 |
| 存储统一入口（`AGENTS.md:147`） | ✅ 全部走 `PluginStorage` + `TypedStorage`，凭证经 `settingsCrypto` 加解密，无裸 `plugin.loadData` |
| 实例挂载与销毁（`AGENTS.md:82-87`） | ✅ `index.ts:71-77` 自挂载 `__s3FileManager`，`DESTROYABLE_KEYS` 已登记（`src/index.ts:117`），`destroy()` 具备且被 `onUnload` 统一循环 |
| SCSS 分离（`AGENTS_STYLE.md:336-372`） | ✅ 9 个 `.scss` 全部独立于 `.vue`，`.vue` 内仅 `@use`，无内联样式 |
| 设计 Token（`AGENTS_STYLE.md:177-191`） | ✅ 无非 Token 硬编码的 `padding`/`font-size`/`border-radius`/`font-weight`/`font-family`；`box-shadow` 零命中；`backdrop-filter` 零命中 |
| 字号两级制（`AGENTS_STYLE.md:193-220`） | ✅ `.fm-panel` 显式声明 `font-size: $t-xs`（`index.scss:13`），各辅助文字为 `$t-2xs`，无 13px/15px 类偏移值 |
| 图标注册（`AGENTS.md:292`） | ✅ 模块使用的 IconKey 均在 `kit/icons.ts` 已注册（`s3FileManager` / `folder` / `folderPlus` / `folderMove` / `upload` / `download` / `copy` / `edit` / `delete` / `list` / `viewGrid` / `textBox` / `settings` / `refresh` / `back` / `close` / `error` / `image` / `code` / `play` / `file`） |
| 功能注册 8 步清单（`AGENTS.md:64-75`） | ✅ 8 处齐全：`index.ts` / `types/index.ts` / `features/index.ts:72,128` / `src/index.ts:258` / `settings.ts:63,135` / i18n 双分片 / `config.ts:324-334` / `kit/icons.ts:250` |
| README 存在（`AGENTS.md:293`） | ✅ 存在（内容漂移见 R16） |
| 子组件文件夹组织（`AGENTS_ARCH.md:215-245`） | ⚠️ 8 个组件平铺于 `components/`。当前模块仅 8 个文件、未达「≥15 时问题突出」的阈值，且无「被 ≥2 视图复用的组件」（`common/` 无内容可放）→ **暂不构成违规**；若 R1 迁移后新增组件宜一并整理 |

---

## 九、建议的整改顺序

| 序 | 内容 | 涉及 | 预估行数变化 |
|---|---|---|---|
| 1 | **R23 先修右键菜单 `ref` 缺失**（R5 迁移的根因，若立即执行第 3 步则可跳过） | `FmContextMenu.vue` | +1 行（或随第 3 步整体删除） |
| 2 | **R1 迁移 5 个弹窗到共享 `Dialog`** | 5 个 `.vue` + `styles/index.scss` + 删除 `useEscClose.ts` | **−约 260 行**（弹窗外壳 markup 约 153 + 基座样式 58 + `useEscClose` 48） |
| 3 | **R5 迁移右键菜单到 `TieredMenu` popup** | `FmContextMenu.vue` + `.scss` | **−约 141 行**（98 + 43） |
| 4 | **R2 迁移工具栏到共享 `Toolbar`** | `FmToolbar.vue` + `.scss` | −约 25 行 |
| 5 | **R3 徽章改 `Tag`、R21 折叠改 `Panel`、R20 进度条改 `ProgressBar`** | `FmLogPanel` / `index.vue` / `index.scss` | −约 105 行（徽章 SCSS 17 + 折叠 15 + 进度条模板 30 与 SCSS 43） |
| 6 | **R6/R7 提取 2 个纯函数到 `utils.ts`** | `useS3Entries` / `FmMoveCopyDialog` / `utils.ts` | −约 20 行，消除 3 处复制 |
| 7 | **R9/R10/R11 提升 4 个共享常量到 `@/utils/s3/`** | 两侧 `types` + `storage.ts` | 净 0 行，消除跨模块字面量耦合 |
| 8 | **R12/R13 清理死代码** | 7 个文件 | −约 20 行 |
| 9 | **R8/R15 统一确认入口为 Promise 单一版本** | `index.vue` / `useS3Transfer` / `FmLogPanel` | −约 15 行 |
| 10 | **R17 拆分 `index.vue` 至 ≤500 行** | `index.vue` → 2-3 个 composable | `index.vue` 539 → 约 380 行（模块总量不变，仅职责外移） |
| 11 | **R18/R19/R16 收尾**（z-index/遮罩色、图标化、README 校准） | `index.scss` / 3 个 `.vue` / README | 净 ±0 |

**整改后预估**：模块代码行数（不含 README，当前 **4141** 行 = ts/vue 3383 + scss 758）净减约 **586 行**至约 **3555 行**，且弹窗/工具栏/菜单/徽章/进度条/折叠 6 类 UI 全部收敛到共享组件，版本升级只需跟随共享组件，无需逐处同步。

---

## 十、验证记录

### 审查轮（2026-09-11）

| 检查 | 命令 | 结果 |
|---|---|---|
| i18n 中英对齐 + 重复键 | `pnpm i18n:verify` | ✅ 4501 个叶子键对齐，无重复键 |
| 图标注册有效性 | `pnpm validate:icons` | ✅ 共验证 235 个图标通过 |
| ESLint | `pnpm lint` | 由用户执行（`AGENTS.md:96,100`：AI 不运行 `pnpm lint`） |
| 类型检查 | `pnpm typecheck` | 由用户执行（本轮未改源码） |
| 构建 | `pnpm vite build` | 由用户执行（`AGENTS.md:96`） |

> 本轮为纯审查，未新增/修改任何源码文件，未新建临时校验脚本（遵循 `AGENTS.md:98-101`）。

---

## 十一、整改实施记录（2026-09-11）

按上表 11 步顺序**全部实施完毕**。

### 实际结果

| 指标 | 整改前 | 整改后 |
|---|---|---|
| 模块代码行数（不含 README） | 4141 | **3904**（净减 237） |
| `index.vue` | 539 行 | **475 行**（低于 500 硬阈值） |
| 自建模态外壳 | 5 套 | **0**（全部走共享 `Dialog`） |
| 模块内被复用的共享组件 | 4 个 | **12 个** |
| 删除的文件 | — | `useEscClose.ts`、`styles/FmContextMenu.scss` |

> 净减行数少于预估的 586，原因是把原先「压在一行」的紧凑写法（如 `label: "…", icon: "…", danger: true` 合并行、模板属性单行）在迁移后按可读性展开为多行 —— 结构冗余消除了，但不是逐行等量替换。**关键收益在「自建实现归零 + 复用组件翻三倍」，而非行数本身。**

### 新增文件（3）

| 文件 | 职责 |
|---|---|
| `composables/useFmConfirm.ts` | 唯一确认入口（Promise 式），替代原回调式 + Promise 式双 API |
| `composables/useFmPrefs.ts` | 视图偏好状态/持久化/排序同步（从 `index.vue` 外移） |
| （无其它）| `utils.ts` 内新增 `relativeSegments` / `normalizeListing` 两个纯函数 |

### 共享组件扩展（按「缺能力时先扩展共享组件」规则）

| 组件 | 扩展 | 向后兼容 |
|---|---|---|
| `TieredMenu` | `TieredMenuItem` 新增可选 `danger?: boolean`（危险项取语义错误色） | ✅ 可选字段，既有调用零影响 |

同步更新：`previewData/tieredMenu.ts`（新增「危险项」示例 + `PreviewMenuItem` 补字段）、`componentPreview/README.md`（说明 `danger` 语义）。

### 共享层提升（跨模块去重）

| 常量 / 函数 | 原位置 | 现位置 |
|---|---|---|
| `TRANSFER_MAX_RETRIES` / `MAX_LOG_COUNT` / `MAX_LOG_DETAIL_FILES` | 两模块各一份 | `@/utils/s3/types`（`s3Backup/types` 再导出，调用点零改动） |
| `S3_BACKUP_CONFIG_KEY` | `s3FileManager` 硬编码字面量 | `@/utils/s3/types`（两侧引用同一来源） |
| `runWithRetries` | 两模块各写一个重试循环 | `@/utils/s3/concurrency`（`s3Backup` 保留「警告 + 布尔出口」语义，`s3FileManager` 保留「抛出」语义） |

### 真实缺陷修复（R23）

`FmContextMenu.vue` 原 `menuRef` 未绑定导致定位钳制恒按「菜单高 0px」计算、右下角溢出视口。该组件整体迁移到共享 `TieredMenu`（定位由 `tieredMenu/position.ts` 纯函数承担）后**问题随之消除**，无需单独补 `ref`。

### 行为变更（需用户目视回归）

| 项 | 变更 | 理由 |
|---|---|---|
| 弹窗遮罩点关 | `@click.self` → 「遮罩上按下**并**抬起」 | 共享 `useOverlay` 语义；原实现弹层内按下、拖到遮罩上抬起会误关 |
| 弹窗焦点 | 无 → 打开时聚焦容器、关闭归还开启前元素 | 共享 `useOverlay` 能力 |
| 弹窗动效 | 无 → fade + scale 0.98（0.12s ease） | 对齐 `AGENTS_STYLE.md` 强制范式 |
| 弹窗尺寸 | 各弹窗硬编码 px → 四档 `size`（320/400/520/680px） | 统一档位阶梯 |
| 遮罩层级/底色 | `z-index: 2000` + `$c-fg` 兜底 → `10000` + `rgba(0,0,0,0.5)` | 对齐规范；原 `$c-fg`（近纯黑前景色）作遮罩属语义错位 |
| 上传/删除/清空确认 | 原生 `confirm` 回退分支删除 | 回退路径不可达（宿主恒注入），且原生 `confirm` 阻塞渲染进程 |
| 失败清单折叠 | `<details>` → 共享 `Panel`（默认收起，逐条记忆展开态） | 复用共享组件；保留原「按需展开控制 DOM 量」意图 |
| 进度条 | 自建 `div` → 共享 `ProgressBar`；传输/批量两段合并为一段 | 复用共享组件；`showValue` 关闭以免与 `N / M` 计数重复 |
| 列头排序 | 无 aria → `role="columnheader"` + `aria-sort` | 读屏可感知排序方向 |
| 列头/面包屑/文件夹项 | 原生 `<button>` → 共享 `Button` | 共享组件优先 |
| 排序箭头/面包屑分隔符 | `▲▼` / `&#9656;` → `chevronUp/Down` / `chevronRight` | 禁止字符代图标 |

### 验证（整改轮，AI 可执行的既有入口）

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `pnpm typecheck`（`vue-tsc`） | ✅ 0 error |
| i18n 中英对齐 + 重复键 | `pnpm i18n:merge` → `pnpm i18n:verify` | ✅ 4504 个叶子键对齐（+3 新增键），无重复键 |
| 图标注册有效性 | `pnpm validate:icons` | ✅ 共验证 235 个图标通过 |
| ESLint / 构建 | `pnpm lint` / `pnpm vite build` | **由用户执行**（`AGENTS.md:96`） |

> 未新建任何临时校验脚本。新增 i18n 键 3 个（`toolbarLabel` / `contextMenuLabel` / `close`），均中英同步。
