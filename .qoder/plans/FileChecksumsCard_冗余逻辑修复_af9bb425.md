# useFullS3Upload 审查修复

## 摘要
发现 3 处逻辑缺陷、4 处规范违规。修改集中于 `src/features/s3Backup/composables/useFullS3Upload.ts`，附带 i18n 分片新增 3 个键、`types/index.ts` 新增 1 个共享常量并替换模块内 5 处重复字符串。

## i18n 分片（zh_CN + en_US 的 s3Backup.json）

- 新增 `s3UploadResult`：`"备份上传完成：上传 {uploaded}、跳过 {skipped}"` / `"Backup upload finished: {uploaded} uploaded, {skipped} skipped"`（仿 `incrementalResult` 模板风格）。
- 新增 `s3UploadFailedPart`：`"，{failed} 个文件读取失败"` / `", {failed} file(s) failed to read"`（failedCount>0 时追加）。
- 新增 `allFilesExist`：`"文件均已存在于 S3，跳过 {skipped} 个"` / `"All files already exist on S3, {skipped} skipped"`（零上传场景专用消息）。

## types/index.ts（s3Backup）

- 新增共享常量 `export const MSG_DESKTOP_ONLY = "无法访问文件系统，请使用桌面版思源笔记"`（模块内部错误消息，5 处文件共用；按分层规则提取到 types，不进 i18n——该消息由 catch 后统一经 getErrorMessage 展示，现有各处同样直接抛中文）。
- 替换 5 处重复字面量为该常量：`useFullS3Upload.ts` L81、`useCloudBackupActions.ts` L30、`BackupManager.ts` L108（保持 `TypeError`）、`useIncrementalBackup.ts` L288、`types/s3Client.ts` L36。

## useFullS3Upload.ts

- 逻辑修复：
  - 新增 `failedCount` 计数：L147-151 读取失败分支 `failedCount++`（保留 console.warn）。
  - 日志 `fileName` 改为 `uploadedCount > 1 ? i18n.filesCount.replace(...) : (uploadedNames[0] || "")`——修复取 `files[0]` 可能是被跳过/失败文件的 bug。
  - 结果消息重写：`uploadedCount > 0` 时用 `s3UploadResult` 模板（`{uploaded}`/`{skipped}` 替换）；`uploadedCount === 0 && skippedCount > 0` 时用 `allFilesExist`；`failedCount > 0` 时追加 `s3UploadFailedPart` 并将 showMessage 类型改为 `"error"`（其余保持 `"info"`）。
  - 日志 `message` 改为模板产物（跳过/失败信息），删除硬编码 `` `跳过 ${skippedCount}` ``；`success` 改为 `failedCount === 0`。
  - 进度口径统一：L139 `filesProcessed` 改为 `processedCount`（与 percent 同口径，跳过分支已是递增后取值，上传分支表示"正在处理第 N+1 个前已完成 N 个"，统一为已完成数）。
- 规范清理：
  - 删除 L183/L191 两处 i18n 兜底 `|| "..."`。
  - 删除 L95-104 调试样例打印块与 L125 逐文件跳过 log；保留 L94 去重汇总 log 与各 console.warn。
  - L86/L88 移除冗余显式类型注解（`= new Set<string>()` 即可）。

## 验证

- `pnpm i18n:merge` + `pnpm i18n:verify`、`npx tsc --noEmit`。
- `pnpm lint` / `pnpm build` 由用户自行执行。

## 假设与不改动项

- 去重 basename 兜底、`listFailed` 兜底刷新、finally 落盘校验值均为正确设计，保留。
- `recordUploadHosts([])` 内部已空数组早退，调用侧不加守卫。
- 跨午夜上传落次日日期文件夹的极端边缘不处理。
- L40 deps 解构风格不一致不改（低价值改动）。