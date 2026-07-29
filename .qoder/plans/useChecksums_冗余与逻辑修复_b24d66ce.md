# useChecksums 冗余与逻辑修复

## 摘要

`useChecksums.ts` 存在三类问题：saveChecksum 内部未 await 的持久化导致错误静默与写入顺序竞态；增量上传循环中逐文件全量持久化造成 O(N²) 写入；`persist` deps 函数类型在 3 个 composable 中重复定义。

## useChecksums.ts 修改

- `saveChecksum` 改为 `async`，返回 `Promise<void>`，内部 `await saveChecksums()`，消除浮动 Promise。
- 为支持批量场景，给 `saveChecksum` 增加可选参数 `persistNow = true`：传 `false` 时只更新内存不落盘。
- 额外导出 `persistChecksums`（即现有 `saveChecksums`），供批量场景在循环结束后统一落盘一次。
- 同名覆盖时将条目移到列表头部（`splice(idx, 1)` 后 `unshift`），与新增条目的"最近在前"语义保持一致。
- deps 接口改用提取后的共享类型（见下节）。

## types/index.ts 修改

- 新增共享类型 `PersistFn`：
  ```ts
  /** 持久化辅助函数类型：由 index.vue 提供，统一「获取实例 → 存储槽 save」样板 */
  export type PersistFn = (save: (storage: S3BackupStorage) => Promise<unknown>) => Promise<void>
  ```
- 三处替换重复定义：`useChecksums.ts` 的 `ChecksumsDeps`、`useBackupLogs.ts` 的 `BackupLogsDeps`、`useLocalBackupList.ts` 的 deps 接口，均改为 `persist: PersistFn`。

## 调用方适配

- `useFullS3Upload.ts`：
  - deps 中 `saveChecksum` 签名更新为异步 + 可选 persistNow 参数，循环内（L151）调用 `await deps.saveChecksum(..., false)` 只更新内存。
  - deps 新增 `persistChecksums: () => Promise<void>`，上传循环结束后调用一次统一落盘（放在 `recordUploadHosts` 附近）。
- `index.vue`：
  - L616 ZIP 备份处改为 `await saveChecksum(...)`（单文件场景，立即落盘），persist 失败可被现有 catch 捕获记录。
  - L410-418 传给 `useFullS3Upload` 的 deps 补上 `persistChecksums`。

## 不修改的部分

- `useBackupLogs.addLog` 的同类 fire-and-forget 模式本次不动（超出本文件审查范围，且日志丢一条影响小）。
- checksums 列表不加数量上限：校验值需全量保留供验证。

## 验证

- `npx tsc --noEmit` 类型检查通过（用户自行执行 `pnpm lint`）。

## 假设

- `useFullS3Upload` 上传循环是顺序执行的（已确认 L112-158 为串行 for 循环），批量结束后单次落盘不会与其他写入者竞争。