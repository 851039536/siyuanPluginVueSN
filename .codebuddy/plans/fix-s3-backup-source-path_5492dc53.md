---
name: fix-s3-backup-source-path
overview: 修复 S3 备份源路径：将 getWorkspaceFiles() 的扫描目录从 workspaceRoot/data 改为 workspaceRoot/data-backup，使 S3 上传的是本地备份生成的 ZIP 文件，而非 data/ 目录中的原始文件。
todos:
  - id: fix-s3-source-path
    content: 修改 BackupManager.getWorkspaceFiles() 将扫描源从 dataPath 改为 backupDir，并更新相关注释
    status: completed
---

## 用户需求

修正 S3 备份功能的源路径：

- **S3 备份**：当前错误地扫描 `工作空间\data\` 目录逐文件上传，应改为扫描 `工作空间\data-backup\` 目录（即本地 ZIP 备份产出的目录），上传已打包好的 ZIP 文件
- **本地备份**：已正确备份 `工作空间\data\` 目录，打包为 ZIP 保存到 `工作空间\data-backup\`，无需修改

## 核心修改

- `BackupManager.getWorkspaceFiles()`：扫描源从 `this.dataPath` 改为 `this.backupDir`
- 同步更新相关代码注释

## 技术方案

### 修改范围

仅需修改 1 个文件：`src/features/s3Backup/modules/BackupManager.ts`

### 具体变更

#### `getWorkspaceFiles()` 方法（第 111-138 行）

当前逻辑：扫描 `this.dataPath`（即 `workspaceRoot/data`），逐文件列出供 S3 上传。

修改后：扫描 `this.backupDir`（即 `workspaceRoot/data-backup`），列出已打包的 ZIP 文件供 S3 上传。

两处路径引用需变更：

1. `this.validatePath(this.dataPath)` → `this.validatePath(this.backupDir)`
2. `this.scanDirectory(this.dataPath, ...)` → `this.scanDirectory(this.backupDir, ...)`

同步更新方法注释（第 107-110 行），将 `data/` 改为 `data-backup/`。

#### `performFullBackup()` 方法

本地 ZIP 备份逻辑正确（扫描 `this.dataPath`，打包到 `this.backupDir`），无需修改。

### 影响分析

- `index.vue` 中 `performS3Backup()` 无需改动：它调用 `getWorkspaceFiles()` 获取文件列表后逐文件上传，修改扫描源后自然上传 `data-backup/` 下的 ZIP 文件
- `performS3OnlyBackup()` 同样无需改动
- 不影响本地备份、自动备份触发等任何其他流程