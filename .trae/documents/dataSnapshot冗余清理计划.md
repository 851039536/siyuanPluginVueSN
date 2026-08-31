# dataSnapshot 模块冗余清理计划

## Summary

对 `src/features/dataSnapshot/` 做冗余清理：删除全部死代码（未使用的存储类、diff/upload 相关类型与状态字段、约 20 个未用 i18n 键）、消除 i18n 双通道冗余（死 prop）、复用共享格式化工具、移除违反硬规则的 i18n 中文兜底（30+ 处）、补齐「删除云端标签」的确认弹窗与状态反馈，并同步修正 README 与实际功能不符的描述。

用户已确认：① 死代码全部删除（含 i18n 键与 README 描述）；② 删除云端标签补确认 + 反馈。

## Current State Analysis

经探索确认的问题清单：

| # | 类型 | 问题 | 位置 |
|---|------|------|------|
| 1 | 死代码 | `DataSnapshotStorage` 类 + `DataSnapshotSettings` + `STORAGE_KEYS` + `DEFAULT_SNAPSHOT_SETTINGS` 全模块零引用 | `types/index.ts` L38-56 |
| 2 | 死代码 | `SnapshotDetail` / `SnapshotDiffData` / `SnapshotContentFile` 再导出零引用（对应"对比"功能未实现） | `types/index.ts` L11-15, L28-36 |
| 3 | 死代码 | `SnapshotView` 的 `"diff"` 变体、`op.uploading` / `op.loadingContent` 字段无任何使用 | `types/index.ts` L17-26、`composables/useDataSnapshot.ts` L44-47 |
| 4 | 死代码 | i18n 分片约 20 键未使用（upload/diff/杂项系列） | `i18n/{zh_CN,en_US}/dataSnapshot.json` |
| 5 | 冗余 | `index.vue` 的 `i18n` prop 被 composable 的 `computed i18n` 遮蔽，`index.ts` 传入的 `i18n` 选项喂的是死 prop | `index.vue` L284、`index.ts` L16 |
| 6 | 重复 | `formatSize` 与共享 `@/utils/format.ts` 的 `formatFileSize` 重复实现 | `index.vue` L341-350 |
| 7 | 违规 | 30+ 处 `i18n.xxx \|\| "中文兜底"`（AGENTS 硬规则禁止，兜底文案与分片内容重复） | `index.vue` 模板、`composables` |
| 8 | 违规 | 4 处硬编码中文绕过 i18n：`大小:`、`Tag 更新:`、`设备:`、`文件类型分布` | `index.vue` L212/215/218/228 |
| 9 | 交互缺口 | `removeCloudTag` 静默失败（`catch { // ignore }`）且无确认弹窗，与 restore 的二次确认模式不一致 | `composables/useDataSnapshot.ts` L125-136 |
| 10 | 文档失实 | README 声称"对比快照/上传到云端"功能及存储键，实际不存在 | `README.md` |

不在本次范围（仅记录）：
- `api.ts` 中 `uploadCloudSnapshot` / `getRepoSnapshotContent` / `checkoutRepo` 封装无调用方 — 属共享 API 层，保留不动
- 模板中本地/云端列表项的 `ds-item` 结构相似（两处、动作不同）— Rule of Three 不抽取
- `styles/index.scss` 中少量硬编码色值（rgba/hsl）— 非冗余问题，本次不动
- `index.ts` 的 `plugin.addIcons` + dock title 兜底 — 与 docAnalysis 等既有惯例一致，保留

## Proposed Changes

### 1. `src/features/dataSnapshot/types/index.ts` — 删除死代码

删除：`SnapshotDetail`、`SnapshotDiffData`、`SnapshotContentFile` 再导出、`DataSnapshotStorage` 类、`DataSnapshotSettings`、`STORAGE_KEYS`、`DEFAULT_SNAPSHOT_SETTINGS`，及随之不再需要的 `Plugin` / `PluginStorage` / `TypedStorage` 导入。

修改：
```ts
// 仅保留实际使用的视图与操作状态
export type SnapshotView = "local" | "cloud" | "detail"

export interface SnapshotOperationState {
  creating: boolean
  restoring: string | null
  downloading: string | null
  removing: string | null
}
```
保留 `SnapshotInfo` / `CloudSnapshotTag` 再导出。

### 2. 新建 `src/features/dataSnapshot/utils.ts` — 纯函数归位（模块分层规则）

从 `index.vue` 迁出两个格式化函数，消除与 `@/utils/format.ts` 的重复：

```ts
// 快照时间格式化：优先 API 预格式化字段（hCreated/hCreateTime），
// 数值/字符串时间委托共享 formatTime
import { formatFileSize, formatTime } from "@/utils/format"
import type { SnapshotInfo } from "./types"

export function formatSnapshotTime(s: SnapshotInfo): string {
  if (s.hCreated) return s.hCreated
  if (s.hCreateTime) return s.hCreateTime
  if (s.created) return formatTime(s.created)
  if (s.createTime) {
    const num = Number(s.createTime)
    // createTime 可能是 unix 秒
    return formatTime(num > 1000000000 ? num * 1000 : s.createTime)
  }
  return ""
}

export function formatSnapshotSize(s: SnapshotInfo): string {
  if (s.hSize) return s.hSize
  return s.size != null ? formatFileSize(s.size) : ""
}
```
文件头含功能说明注释。

### 3. `src/features/dataSnapshot/composables/useDataSnapshot.ts`

- `op` 初始化移除 `uploading` / `loadingContent`
- `removeCloudTag`：移除静默 catch，补状态栏反馈（与 restore/download 同模式）：
  - `snapshotTask.progress({ label: i18n.value.removeCloudTag })`
  - 成功 `snapshotTask.complete(i18n.value.removeRemove...)` → 用现有键 `removeSuccess`；失败 `snapshotTask.fail(getErrorMessage(e) || i18n.value.removeFailed)`
- `createSnapshotAction`：备忘默认文案改 `i18n.value.createSnapshot`，去掉 `\|\| "快照"` 兜底
- 其余 `i18n.value.xxx || "中文兜底"` 全部去掉兜底（键均已存在于分片）
- `switchTab(tab: "local" | "cloud")` 参数类型收窄

### 4. `src/features/dataSnapshot/index.vue`

- `defineProps` 移除 `i18n`，仅保留 `plugin`
- 引入 `./utils` 的 `formatSnapshotTime` / `formatSnapshotSize`，删除本地 `formatTime` / `formatSize`
- **统一确认弹窗**：将现有 `restoreTarget` 泛化为单一确认状态，同时覆盖"恢复"与"删除云端标签"两种确认（复用现有 `ds-confirm` 标记，避免复制第二份弹窗）：
  ```ts
  const confirmAction = ref<
    | { kind: "restore"; snap: SnapshotInfo }
    | { kind: "removeTag"; tag: string }
    | null
  >(null)
  ```
  模板中确认文案按 kind 分支：恢复沿用 `restoreConfirm`，删除用 `removeCloudTagConfirm`；确认按钮分别调 `restoreSnapshot(id)` / `removeCloudTag(tag)`
- 云端删除按钮补 `:title="i18n.removeCloudTag"`
- 模板所有 `|| "中文兜底"` 兜底移除（`title`、`refresh`、`tabLocal`、`tabCloud`、`memoPlaceholder`、`createSnapshot`、`refreshing`、`noSnapshots`、`noCloudSnapshots`、`snapshotFiles`、`view`、`restore`、`downloading`、`download`、`snapshotDetail`、`memo`、`createdAt`、`restoreConfirm`、`cancel`、`confirmRestore` 等）
- 4 处硬编码中文改 i18n 键：`size`（大小）、`tagUpdated`（Tag 更新）、`device`（设备）、`typesDistribution`（文件类型分布）；详情区 `snapshotFiles` 用作"文件数"标签处改用新键 `fileCount`
- 按硬规则补模板中文区块注释与 i18n 用点中文注释（现有 `<!-- Header -->` 等英文注释改为中文，如 `<!-- 头部：标题 + 刷新 -->`）
- 预计从 351 行降至约 300 行以内

### 5. `src/features/dataSnapshot/index.ts`

- 移除 `createVueDockApp` 的 `i18n: ...` 选项（死 prop 通道）
- 保留 `addIcons`、dock title 兜底（既有惯例）

### 6. i18n 分片 `src/i18n/{zh_CN,en_US}/dataSnapshot.json`（两片对称修改）

**删除**（对应未实现功能/零引用）：
`description`、`localSnapshots`、`cloudSnapshots`、`upload`、`uploadTag`、`uploadTagPlaceholder`、`uploading`、`uploadSuccess`、`uploadFailed`、`snapshotDiff`、`selectSnapshotToCompare`、`compare`、`comparing`、`diffAdded`、`diffRemoved`、`diffModified`、`noChanges`、`loadFailed`、`snapshotId`、`confirm`

**保留并启用**（本次交互修复用到）：`removeCloudTag`、`removeCloudTagConfirm`、`removeSuccess`、`removeFailed`

**新增**：

| 键 | zh_CN | en_US |
|---|---|---|
| `size` | 大小 | Size |
| `tagUpdated` | Tag 更新 | Tag updated |
| `device` | 设备 | Device |
| `typesDistribution` | 文件类型分布 | File type distribution |
| `fileCount` | 文件数 | File count |

**改值**：`snapshotFiles` 当前值"文件列表 / File List"与列表项用法（`· 3 文件`）不符，改为"文件 / files"。

### 7. `src/features/dataSnapshot/README.md` — 与实际功能对齐

- 功能列表移除"对比快照"与"云端同步"中的上传能力，保留：创建、查看详情、恢复（二次确认）、云端下载、云端标签管理（删除含确认）
- 移除"存储键"章节（存储类已删除）
- API 端点表仅保留实际调用：`createSnapshot`、`getRepoSnapshots`、`importRepo`、`getCloudRepoTagSnapshots`、`downloadCloudSnapshot`、`removeCloudRepoTag`

## Assumptions & Decisions

- dock title 的 `\|\| "数据快照"` 兜底保留：与 docAnalysis 等全库惯例一致，且 title 在 i18n 加载前注册时必须有值
- `getErrorMessage(e) || i18n.value.xxx` 模式保留：i18n 键本身就是错误文案兜底，非硬编码中文
- `api.ts` 不动：共享 API 层的未用封装不属于本模块冗余
- 不实现 upload/diff 新功能（用户已确认删除方向）

## Verification

AI 执行（构建/重构生成大文件）：
1. `pnpm i18n:merge` — 重新合并分片生成 `zh_CN.json` / `en_US.json`
2. `pnpm i18n:verify` — 中英键对齐校验
3. `pnpm validate:icons` — 图标注册校验（本次未动图标，确认无回归）

用户自行执行（AGENTS 约定 AI 不运行）：
4. `npx tsc --noEmit` — 类型检查（重点验证 `types/index.ts` 删减后无引用残留）
5. `pnpm lint`
6. `pnpm build` 后在思源中人工验证：本地/云端列表加载、创建/恢复/下载/删除（含确认弹窗与状态栏反馈）、详情页字段显示
