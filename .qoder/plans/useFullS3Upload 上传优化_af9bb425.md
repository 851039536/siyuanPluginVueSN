# useFullS3Upload 上传优化

## 摘要
三项优化：上传与哈希并行（消除每文件二次磁盘读的串行等待）、有界并发上传（复用增量备份既有并发池）、单文件失败重试后继续（不再中断整批）。涉及 `useFullS3Upload.ts`、`useIncrementalBackup.ts`（提取共享）、`utils.ts`、`types/index.ts`。

## 共享工具提取（utils.ts + types/index.ts）

- `runWithConcurrency<T>()` 从 `useIncrementalBackup.ts` L59-71 原样移入 `utils.ts`（纯函数，两文件共用，符合分层硬规则）；`useIncrementalBackup.ts` 改为从 `../utils` 导入。
- `TRANSFER_MAX_RETRIES = 2` 从 `useIncrementalBackup.ts` L23 移入 `types/index.ts` 共享常量区；`useIncrementalBackup.ts` 改导入。
- `types/index.ts` 新增 `FULL_UPLOAD_CONCURRENCY = 2`（全量上传对象为大 ZIP，带宽易饱和，用小并发；增量备份保持自身 `UPLOAD_CONCURRENCY = 4` 不动）。

## useFullS3Upload.ts 循环重构

- for 循环改为 `runWithConcurrency(files, FULL_UPLOAD_CONCURRENCY, worker)`；`latestZip` 单文件场景并发池自适应退化为串行，无需特判。
- worker 内流程：
  1. 去重判断（逻辑不变）→ 命中则 `skippedCount++ / processedCount++` 并更新进度后返回。
  2. `fs.readFile` 失败 → `failedCount++ / processedCount++` 返回（现有逻辑）。
  3. 上传与哈希并行：`Promise.allSettled([uploadWithRetry(), backupManager.computeFileHash(file.fullPath)])`——
     - `uploadWithRetry`：`uploadFileContent` 失败后重试，最多 `TRANSFER_MAX_RETRIES` 次（简单循环，与增量备份语义一致）。
     - 上传最终失败 → `failedCount++`，console.warn，**不抛出**（其余文件继续）。
     - 上传成功且哈希成功 → `saveChecksum(..., false)`；哈希失败仅 console.warn（现有降级语义）。
     - 上传成功 → `uploadedNames.push` / `uploadedCount++`。
  4. `processedCount++` 后更新 `backupProgress`（进度以完成数为口径，并发下 JS 单线程递增安全）。
- 删除外层 try/finally 中"上传抛错中断"的兜底语义说明，finally 落盘校验值逻辑保留（并发下仍在 `runWithConcurrency` await 完成后统一执行，改为普通顺序调用亦可——保留 try/finally 以防 worker 意外抛错）。
- `failedCount` 语义扩展为"读取失败 + 上传失败"，注释同步更新；结果消息/日志复用现有 `s3UploadFailedPart` / `success: failedCount === 0` 路径，`performS3Backup` 不再因单文件上传失败向上抛异常（index.vue 的 `markBackupCompleted` 等后续步骤得以执行）。
- 文件头注释补充"并发上传 + 单文件重试"说明。

## 不改动项

- 流式上传（免整包入内存）：SigV4 签名 `payloadHash(body)` 需完整 Buffer，属 s3Client 层重构，不做。
- 复用签名时已计算的 body SHA-256 作为校验值：跨层耦合破坏封装，不做。
- `saveChecksum(persistNow=false)` 内存更新为纯同步操作，并发调用安全，无需加锁。
- 增量备份自身的并发数与重试逻辑行为零变化（仅导入来源变更）。

## 验证

- `npx tsc --noEmit`；`pnpm lint` / `pnpm build` 由用户自行执行。