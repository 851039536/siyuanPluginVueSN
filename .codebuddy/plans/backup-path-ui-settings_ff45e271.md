---
name: backup-path-ui-settings
overview: 将本地备份目录和 S3 上传子路径从硬编码改为可配置项，在 UI 上单独显示并允许用户自定义。
todos:
  - id: extend-types
    content: 扩展 types/index.ts：BackupSettings 新增 localBackupDir 和 s3SubPrefix 字段及默认值
    status: completed
  - id: update-backup-manager
    content: 改造 BackupManager.ts：backupDir 改读实例变量 _customBackupDir，新增 setBackupDir() 方法
    status: completed
  - id: update-s3backup-class
    content: 更新 index.ts (S3Backup类)：loadWorkspaceSettings/saveWorkspaceSettings 新增 localBackupDir 和 s3SubPrefix
    status: completed
    dependencies:
      - extend-types
  - id: update-ui
    content: 重构 index.vue：新增两个输入框 UI + ref 状态 + performS3Backup 使用 s3SubPrefix + handleDownload 使用 localBackupDir + 加载/持久化逻辑
    status: completed
    dependencies:
      - extend-types
      - update-backup-manager
      - update-s3backup-class
  - id: add-i18n
    content: i18n zh_CN + en_US 各新增 4 个翻译键（localBackupDir/s3SubPath + hint）
    status: completed
  - id: verify
    content: 运行 pnpm i18n:merge && pnpm i18n:verify && pnpm lint && npx tsc --noEmit
    status: completed
    dependencies:
      - update-ui
      - add-i18n
---

## 用户需求

将本地备份目录和 S3 上传子路径从硬编码改为 UI 可配置，在手动备份区域新增两个输入框供用户自定义。

## 核心功能

- 本地备份目录可配置：输入框指定相对于工作区根目录的备份文件夹名称（默认 "data-backup"）
- S3 上传子路径可配置：输入框指定拼在 S3 prefix 之后、时间戳之前的子路径（默认 "data-backup"）
- 两字段持久化到 BackupSettings，重启后保留
- 不影响本地备份历史列表扫描和 S3 云端备份列表显示

## 技术栈

- Vue 3 + TypeScript + Composition API
- SCSS（Codex UI 风格）
- 存储：PluginStorage + TypedStorage

## 实现方案

### 数据模型扩展

`BackupSettings` 接口新增两个字段：

```ts
interface BackupSettings {
  // ...existing fields...
  localBackupDir: string   // 本地备份目录名，默认 "data-backup"
  s3SubPrefix: string      // S3 上传子路径，默认 "data-backup"
}
```

### BackupManager 改造

`backupDir` getter 从硬编码 `path.join(workspaceRoot, "data-backup")` 改为读取实例变量：

```ts
private _customBackupDir = "data-backup"

get backupDir(): string {
  return this.path.join(this.workspaceRoot, this._customBackupDir)
}

setBackupDir(dir: string): void {
  this._customBackupDir = dir || "data-backup"
}
```

### S3 key 构造

`performS3Backup()` 中 `s3Key` 使用 `s3SubPrefix.value` 替换硬编码 `"data-backup"`：

```ts
const s3Key = `${prefix}${s3SubPrefix.value}/${datePath}${file.relativePath}`
```

### UI 布局

在手动备份区域「生成日期子文件夹」复选框下方新增两行：

1. 本地备份目录：label + input（默认 "data-backup"）+ 保存时触发 `setBackupDir()`
2. S3 上传子路径：label + input（默认 "data-backup"）+ 保存时触发 `saveWorkspaceSettings()`

### 持久化流程

- 加载：`loadWorkspaceSettings()` → 读 BackupSettings → 设置 ref
- 保存：input `@change` → `saveWorkspaceSettings()` → 写入 storage
- BackupManager：`initBackupManager()` 后立即 `setBackupDir(localBackupDir.value)`

## 目录结构

```
src/features/s3Backup/
├── types/index.ts          # [MODIFY] BackupSettings 新增 localBackupDir + s3SubPrefix
├── modules/BackupManager.ts # [MODIFY] backupDir 改为可配置，新增 setBackupDir()
├── index.ts                # [MODIFY] loadWorkspaceSettings/saveWorkspaceSettings 新增两字段
├── index.vue               # [MODIFY] 新增两个输入框 + ref + performS3Backup 使用 s3SubPrefix
├── i18n/zh_CN/s3Backup.json # [MODIFY] 新增 localBackupDir/s3SubPath + 提示词（4 keys）
├── i18n/en_US/s3Backup.json # [MODIFY] 同上英文版
```