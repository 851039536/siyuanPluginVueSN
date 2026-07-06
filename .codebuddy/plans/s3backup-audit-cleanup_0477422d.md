---
name: s3backup-audit-cleanup
overview: 审查 s3Backup 模块的冗余与未使用代码，移除死代码、修正误导性文案，并给出扩展建议。
todos:
  - id: remove-dead-code-composable-s3client
    content: 移除 useS3Backup.performBackup、S3Client.upload、S3Client.updateConfig、error ref 及返回值清理、调试 console.log
    status: completed
  - id: cleanup-backup-manager
    content: 清理 BackupManager：移除 size 字段+fs.stat、拷贝循环、_workspaceRoot 参数
    status: completed
  - id: consolidate-workspace-path
    content: 合并 index.ts 中 cachedWorkspacePath/cachedWorkspaceRoot 为单一字段，同步 index.vue 调用处
    status: completed
    dependencies:
      - cleanup-backup-manager
  - id: fix-i18n-and-readme
    content: 修复 i18n 误导文案、新增缺失键、删除 5 个废弃键，更新 README.md
    status: completed
  - id: verify-all
    content: 运行 lint + i18n:verify + tsc --noEmit 四重验证
    status: completed
    dependencies:
      - remove-dead-code-composable-s3client
      - cleanup-backup-manager
      - consolidate-workspace-path
      - fix-i18n-and-readme
---

## 产品概述

对 `src/features/s3Backup` 模块进行冗余代码审查和清理，移除确认未使用的死代码、修复与实现不符的误导性文案，并给出功能扩展建议。

## 核心功能（本次实施）

- 移除 `useS3Backup.performBackup()` 及其唯一调用链上的 `S3Client.upload()` 死代码
- 移除 `S3Client.updateConfig()` 未使用方法
- 从 composable 返回值中移除 4 个未消费项（`isConnected`/`isConnecting`/`error`/`initClient`），清理内部无意义的 `error` 赋值
- 移除 `BackupManager` 中无用的 `size` 字段 + `fs.stat` 调用、无意义拷贝循环、未使用的 `_workspaceRoot` 参数
- 移除 `s3Client.ts` 中每次请求打印签名参数的调试 `console.log`
- 合并 `index.ts` 中永远相同的 `cachedWorkspacePath`/`cachedWorkspaceRoot` 为单一字段
- 修复 5 个 i18n 误导/缺失/废弃键，同步更新 README.md

## 技术栈

- Vue 3 + TypeScript + SCSS（现有项目，无技术栈变更）
- 清理范围仅限 `src/features/s3Backup/` 内 6 个文件 + 2 个 i18n 文件 + README.md

## 审查发现与移除清单

### A. 死代码移除（`useS3Backup.ts` + `s3Client.ts`）

| 项目 | 文件 | 行号 | 说明 |
| --- | --- | --- | --- |
| `performBackup()` | useS3Backup.ts:83-101 | 整个函数 | 接收 `localZipPath` 上传 zip，但 index.vue 自实现逐文件上传，从未调用此方法 |
| `S3Client.upload()` | s3Client.ts:306-321 | 整个方法 | 唯一调用方是死代码 `performBackup`；`uploadBuffer()` 仍被使用，保留 |
| `S3Client.updateConfig()` | s3Client.ts:217-220 | 整个方法 | 全模块无调用方；composable 每次 `new S3Client(cfg)` 而非 updateConfig |
| 返回值 `isConnected` | useS3Backup.ts:170 | return 块 | index.vue 未解构；仅内部 set 无外部读取 |
| 返回值 `isConnecting` | useS3Backup.ts:171 | return 块 | index.vue 未解构；S3ConfigForm 有自己的本地 `isConnecting` ref |
| 返回值 `error` | useS3Backup.ts:176 | return 块 + 所有 `error.value =` 赋值 | index.vue 未解构；仅内部 set 无外部读取，所有赋值无意义 |
| 返回值 `initClient` | useS3Backup.ts:180 | return 块 | index.vue 未解构；仅被 testConnection/saveConfig/loadConfig 内部调用 |
| 调试 console.log | s3Client.ts:438 | 单行 | 每次请求打印签名参数（含 accessKey 前 6 位），生产噪声 + 安全隐患 |


**注意**：`isConnecting` ref 在 composable 内部仍被 `testConnection()` 使用（控制异步状态），仅从返回值移除；`isConnected` 同理仅从返回值移除，内部赋值保留（不影响逻辑）。`error` ref 的内部赋值也一并移除（无任何读取方）。

### B. BackupManager 冗余清理（`BackupManager.ts`）

| 项目 | 行号 | 说明 |
| --- | --- | --- |
| `_workspaceRoot` 参数 | :32, :44 | 构造函数和 `updateWorkspacePaths` 第二参数前缀 `_`，完全忽略；移除参数 |
| `WorkspaceFile.size` 字段 | :19-23 | index.vue 的 `performManualBackup` 只用 `relativePath` 和 `fullPath`，从不读 `size` |
| `fs.stat` 调用 | :122-128 | 仅为获取 `size` 而调用，移除后每个文件省一次 I/O |
| 无意义拷贝循环 | :68-73 | `rawFiles` 和 `files` 类型完全相同，for 循环逐字段拷贝 = 直接返回 `rawFiles` |


### C. workspacePath/workspaceRoot 二元性合并（`index.ts`）

`cachedWorkspacePath` 和 `cachedWorkspaceRoot` 在 `setWorkspacePaths(root)` 中都被设为 `root`，永远相同。`getWorkspacePath()` 和 `getWorkspaceRoot()` 返回相同值。

**方案**：

- 移除 `cachedWorkspacePath` 字段
- `getWorkspacePath()` 返回 `this.cachedWorkspaceRoot`
- `BackupSettings` 接口保持 `workspacePath` + `workspaceRoot` 双字段（向后兼容已存储数据），但内部只使用 `cachedWorkspaceRoot`
- `BackupManager` 构造函数和 `updateWorkspacePaths` 移除第二参数
- `index.vue` 中 `updateWorkspacePath()` 和 `saveWorkspaceSettings()` 调用处同步调整

### D. i18n 修复（`zh_CN/s3Backup.json` + `en_US/s3Backup.json`）

| 操作 | 键 | 当前值 | 修正 |
| --- | --- | --- | --- |
| 修改 | `backupHint` | "备份将打包为 zip 后上传到 S3" | "备份将逐文件上传到 S3"（实现无 zip） |
| 修改 | `confirmRestore` | "确定要恢复此备份吗？当前数据将被覆盖。" | "确定要下载此备份到本地备份目录吗？如需恢复请手动解压替换。" |
| 新增 | `downloadToLocalSuccess` | （缺失，回退硬编码） | "备份已下载到本地备份目录，请手动解压恢复" |
| 删除 | `packing` | "打包文件" | 未使用（phaseLabel 只映射 scanning/uploading） |
| 删除 | `compressing` | "压缩数据" | 未使用 |
| 删除 | `restoreSuccess` | "恢复完成，备份已下载到本地备份目录" | 未使用（代码用 downloadToLocalSuccess） |
| 删除 | `selectWorkspace` | "选择工作区路径" | 未使用（代码硬编码"选择思源工作区"） |
| 删除 | `loading` | "加载中..." | 未使用（isLoading ref 用于 disabled，不显示文本） |


### E. README.md 更新

- 移除"JSZip 扫描→打包→DEFLATE 压缩→上传"→ 改为"逐文件扫描→上传"
- 移除"自动备份：支持每分钟/每小时/每天的定时自动备份"→ 改为"当前仅支持手动备份"
- 技术实现段落同步更新

## 实施注意事项

1. **`isConnecting`/`isConnected` 保留内部 ref**：仅从 composable 的 return 对象移除，不删除 ref 声明和内部赋值（testConnection 依赖 isConnecting 控制并发）
2. **`error` ref 完全移除**：声明 + 所有 `.value =` 赋值 + return 项全部移除（无任何读取方）
3. **BackupSettings 向后兼容**：不修改接口字段，仅优化内部使用方式。已存储的 `workspacePath`/`workspaceRoot` 数据不受影响
4. **i18n 删除 5 键 + 新增 1 键**：净变化 -4 键，需运行 `pnpm i18n:verify` 确认 zh_CN/en_US 对齐
5. **S3ConfigForm.vue 不改动**：其 scoped scss 中无 vp-btn 定义（依赖父组件穿透），本次不处理此预存问题
6. **`.vp-btn`/`.vp-spin` 局部定义保留**：项目多模块各自定义（scoped 模式），非 s3Backup 独有问题，列为扩展建议

## 目录结构

```
src/features/s3Backup/
├── index.ts                      # [MODIFY] 移除 cachedWorkspacePath 字段，getWorkspacePath 返回 cachedWorkspaceRoot
├── index.vue                     # [MODIFY] BackupManager 调用处移除第二参数；saveWorkspaceSettings 调用同步调整
├── components/S3ConfigForm.vue   # [无改动]
├── composables/
│   └── useS3Backup.ts            # [MODIFY] 移除 performBackup 函数；移除 error ref 及所有赋值；return 移除 isConnected/isConnecting/error/initClient/performBackup
├── modules/
│   └── BackupManager.ts          # [MODIFY] 移除 _workspaceRoot 参数；移除 WorkspaceFile.size + fs.stat；移除拷贝循环直接返回
├── types/
│   ├── index.ts                  # [无改动] BackupSettings 接口保持双字段向后兼容
│   └── s3Client.ts               # [MODIFY] 移除 upload() 方法；移除 updateConfig() 方法；移除 console.log 调试行
├── styles/
│   └── index.scss                # [无改动]
└── README.md                     # [MODIFY] 修正技术实现描述，移除未实现的自动备份

src/i18n/
├── zh_CN/s3Backup.json           # [MODIFY] 改 backupHint/confirmRestore，新增 downloadToLocalSuccess，删 5 键
└── en_US/s3Backup.json           # [MODIFY] 同步英文
```

## 扩展建议（信息性，不在本次实施范围）

1. **自动定时备份**：利用项目现有的"持久化 Modal + CustomEvent + setInterval"模式（参考 `dataBackup`），在 index.ts 中注册定时器，支持每 N 小时/每天自动触发 `performManualBackup`。需新增 `autoBackupInterval` 设置项。
2. **增量备份**：在 `BackupManager` 中记录文件 mtime 哈希表（持久化到 `BackupSettings`），仅上传变化的文件。大工作区可显著减少上传量和时间。
3. **Zip 压缩打包**：README 声称支持但实际未实现。可在 `performManualBackup` 中用 JSZip 将文件打包为单个 zip 再上传，减少 S3 请求数、便于恢复。需权衡内存占用（大工作区可能 OOM）。
4. **备份加密**：上传前用项目已有的 `cryptoPrimitives`（AES-GCM）加密文件内容，密钥由用户设置。保护敏感笔记数据。
5. **保留策略**：新增 `retentionCount` 设置项，备份完成后自动删除超过 N 个的旧备份（调用 `deleteBackup`），避免存储无限增长。
6. **一键恢复**：当前"恢复"仅下载到 `data-backup` 目录。可增加自动解压 + 关闭思源 + 替换 data 目录的引导流程。
7. **配置导入导出**：将 `S3Config` 序列化为 JSON 供跨设备同步，避免重复手动输入 endpoint/key/bucket。
8. **上传校验**：上传后计算远端文件 SHA256 与本地对比，确保传输完整性。
9. **`.vp-btn`/`.vp-spin` 全局化**：将 4 个模块（s3Backup/dataBackup/superPanel/gitPush）重复定义的按钮样式提取到全局 SCSS partial，消除复制粘贴。