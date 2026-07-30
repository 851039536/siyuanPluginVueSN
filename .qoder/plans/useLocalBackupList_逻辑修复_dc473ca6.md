# useLocalBackupList 逻辑与冗余修复

## 修改 `src/features/s3Backup/composables/useLocalBackupList.ts`

### 1. 重写 `loadLocalBackupList`（修复 P1 空扫描脏兜底 + P2 刷新闪空 + P7 冗余合并）
- 删除开头的 `localBackupList.value = []`，改为构建局部 `list` 变量，最后一次性赋值
- 分支逻辑调整：
  - `backupManager` 存在 → 以 `scanBackupDir()` 结果为准（**包括空数组**），截取 `MAX_LOCAL_BACKUP_COUNT` 后赋值并持久化（空列表也持久化，保持存储与磁盘同步），不再落入存储兜底
  - `backupManager` 为 null → 才读取 `getStorageHistory()` 兜底
- 将 `isLoadingLocal` 的 try/finally 管理内置到本函数，删除 `refreshLocalBackupList` 薄包装；返回对象中移除 `refreshLocalBackupList`
- 更新文件头注释中关于兜底语义的描述

### 2. `deleteLocalBackup`（修复 P3 假删除成功 + P6 类型）
- 参数类型 `Record<string, any>` → `LocalBackupInfo`
- `backupManager` 为 null 时：`showMessage(i18n.deleteFailed, 3000, "error")` 并 return，不再静默移除列表条目
- 移除 i18n 兜底：`i18n.confirmDelete`、`i18n.deleteSuccess`、`i18n.deleteFailed` 直接访问

### 3. `uploadLocalBackup`（修复 P4 键泄漏 + P5 + P6）
- 参数类型 `Record<string, any>` → `LocalBackupInfo`
- finally 中改为删除键而非置 false：拷贝新对象后 `delete next[backup.path]` 再整体赋值（保持响应式替换风格）
- 移除全部 i18n 兜底：`alreadyUploaded`、`uploadToS3`（2 处）、`uploadSuccess`、`uploadFailed`

## 修改 `src/features/s3Backup/index.vue`
- 解构处（约 L345-356）：移除 `refreshLocalBackupList`
- 刷新绑定（约 L105）：`@refresh="refreshLocalBackupList"` → `@refresh="loadLocalBackupList"`
- 初始加载（约 L742）：`await loadLocalBackupList()` 保持不变（现在自带 loading 态，与 `:disable-refresh="isLoadingLocal"` 一致）

## 不改动项
- `isAlreadyUploaded`、`recordUploadHosts` 逻辑正确且被 `useFullS3Upload` 复用，保持不变
- `!node` 静默返回、`deps.` 前缀风格不一致属次要项，不在本次范围

## 验证（由用户自行执行）
- `npx tsc --noEmit`
- `pnpm lint`
