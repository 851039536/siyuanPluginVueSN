---
name: s3Backup 持久化问题修复与精简
overview: 移除自动备份功能、修复工作区路径选择按钮（Electron dialog 不可用）、修复 S3 配置保存失效（S3ConfigForm 缺少 watch）、清理冗余代码（双 S3Client/BackupManager 实例、死代码）。
todos:
  - id: create-electron-dialog-util
    content: 新建 src/utils/electronDialog.ts，提取 pickDirectory 和 openFolderInExplorer 工具函数
    status: completed
  - id: remove-autobackup-class
    content: 精简 types/index.ts 和 index.ts — 移除自动备份字段/方法/死代码，S3Backup 类瘦身
    status: completed
    dependencies:
      - create-electron-dialog-util
  - id: update-index-vue
    content: 更新 index.vue — 移除自动备份 UI/脚本，改用 electronDialog 工具修复路径选择，适配精简后的 S3Backup API
    status: completed
    dependencies:
      - remove-autobackup-class
  - id: fix-config-form
    content: 修复 S3ConfigForm.vue — 添加 watch(props.config) 替代 onMounted 解决异步加载失效
    status: completed
    dependencies:
      - update-index-vue
  - id: cleanup-i18n-verify
    content: 清理 i18n 中英文自动备份键 + 清理 SCSS 自动备份样式，运行 lint/tsc/i18n:verify/validate:icons 四重验证
    status: completed
    dependencies:
      - fix-config-form
---

## 用户需求

对 `src/features/s3Backup/` 模块进行 4 项审查修复：

1. **移除自动备份** — 删除全部自动备份逻辑（定时器、executeAutoBackup、pruneOldBackups、设置管理），仅保留手动备份
2. **修复工作区路径选择按钮失效** — "选择路径"按钮点击无反应，根因是渲染进程中 `require("electron").dialog` 为 undefined
3. **修复 S3 配置保存失效** — 保存配置后重新打开面板表单显示默认值，根因是 S3ConfigForm 仅在 onMounted 加载 props.config，而父组件异步加载晚于子组件挂载
4. **审查冗余** — 移除自动备份后清理双 S3Client/BackupManager 实例、死代码 refreshCloudBackupList、重复工作区检测、过度膨胀的 S3Backup 类

## 产品概述

S3 备份功能精简为纯手动备份模式：用户配置 S3 连接 → 选择工作区路径 → 一键打包上传 → 管理云端备份列表（下载/恢复/删除）。移除全部自动备份定时器及相关设置 UI，修复路径选择和配置加载两个功能性 Bug，清理因自动备份引入的冗余代码。

## 核心功能

- S3 配置管理（表单填写、连接测试、持久化保存、重新打开后回填）
- 工作区路径选择（原生 Electron 对话框 + 自动检测兜底）
- 手动备份（打包 zip → 上传 S3 → 更新备份时间）
- 云端备份列表管理（刷新、下载、恢复、删除）

## Tech Stack

- 框架：Vue 3 + TypeScript + Vite（思源笔记插件）
- 样式：SCSS（Codex UI 风格，独立 styles/ 目录）
- 存储：PluginStorage + TypedStorage 持久化
- Electron：@electron/remote 对话框 API
- 构建：CJS 库模式，siyuan/node:* 外部化

## Implementation Approach

### 1. 移除自动备份

- **index.ts** `S3Backup` 类：删除 `autoBackupTimer`/`lastBackupTimestamp`/`keepBackupCount`/`backupManager`/`s3Client` 五个字段，删除 `initAutoBackup()`/`startAutoBackupTimer()`/`stopAutoBackupTimer()`/`executeAutoBackup()`/`pruneOldBackups()`/`loadAutoBackupSettings()`/`saveAutoBackupSettings()`/`restartAutoBackupTimer()`/`refreshCloudBackupList()` 九个方法。`init()` 仅保留 `detectAndInitWorkspace()` + 事件监听注册。将 `saveAutoBackupSettings()` 重命名为 `saveWorkspaceSettings()`，仅持久化 workspacePath/workspaceRoot/lastBackupTime
- **types/index.ts** `BackupSettings` 接口精简为 `{ lastBackupTime, workspacePath, workspaceRoot }`，同步更新 `S3BackupStorage` 默认值
- **index.vue** 模板删除 section 5（自动备份设置区块，第 107-165 行），脚本删除 `autoBackupEnabled`/`backupFrequency`/`backupTime`/`keepBackupCount`/`lastBackupTimestamp` 五个状态变量及 `loadAutoBackupSettings()`/`saveAutoBackupSettings()` 两个函数。`performManualBackup` 中备份完成后改为调用 `saveWorkspaceSettings()`
- **styles/index.scss** 删除 `.settings-row`/`.inline-label`/`.form-select`/`.form-input`/`&.narrow` 等仅被自动备份区块使用的样式（需确认 form-input/form-select 未被 S3ConfigForm 复用 — 实际 S3ConfigForm 有自己的 scoped 样式，不依赖 index.scss 的这些类）

### 2. 修复工作区路径选择按钮失效

- **根因**：`require("electron").dialog` 在 Electron 渲染进程中为 undefined（dialog 是主进程模块），需要 `@electron/remote`
- **方案**：新建 `src/utils/electronDialog.ts`，提取 `pickDirectory(title)` 和 `openFolderInExplorer(path)` 两个工具函数。实现参考 `gitPush/composables/useDirectoryPicker.ts`：优先 `window.require("@electron/remote")` → 回退 `window.require("electron").remote` → 降级 webkitdirectory
- **index.vue** `selectWorkspacePath()` 和 `openWorkspaceFolder()` 改用新工具函数，移除内联 `require("electron")` 调用
- **跨功能导入规则**：项目禁止跨功能直接导入，共享工具必须放 `@/utils/`。新建 `electronDialog.ts` 后 s3Backup 和 gitPush 均可使用（gitPush 的后续迁移不在本次范围）

### 3. 修复 S3 配置保存失效

- **根因**：`S3ConfigForm.vue` 仅在 `onMounted` 中执行 `Object.assign(localConfig, props.config)`，但父组件 `index.vue` 的 `onMounted` 是异步的（`await instance.getStorage().s3Config.load()`），子组件挂载时 `props.config` 为 null。后续 `s3ConfigLocal.value` 更新时子组件无 watch 响应
- **修复**：在 `S3ConfigForm.vue` 中添加 `watch(() => props.config, (newConfig) => { if (newConfig) Object.assign(localConfig, newConfig) }, { immediate: true })`，替换原有 `onMounted` 逻辑

### 4. 审查冗余

- 移除自动备份后 `S3Backup` 类不再需要 `backupManager` 和 `s3Client` 字段（双实例问题自动消除）
- 删除 `refreshCloudBackupList()` 死代码（调用 `s3Client.list()` 但丢弃返回值）
- `detectAndInitWorkspace()` 保留在 S3Backup 类中（供 init 使用），`index.vue` 的 `detectWorkspacePath()` 优先从 `instance.getWorkspaceRoot()` 读取（已有逻辑，保留）
- S3Backup 类从 ~400 行精简到 ~100 行，仅保留：modal 管理、工作区路径缓存、存储访问、工作区检测、生命周期

## Implementation Notes

- **性能**：移除 `setInterval(60000)` 定时器后不再有后台轮询开销；S3Client 懒加载改为仅 composable 管理
- **Blast radius**：不修改 `useS3Backup.ts` composable（手动备份逻辑不受影响）；不修改 `BackupManager.ts`（打包逻辑不变）；不修改 `s3Client.ts`（S3 协议层不变）
- **i18n 清理**：删除 `autoBackup`/`disabled`/`enabled`/`backupFrequency`/`everyMinute`/`everyHour`/`everyDay`/`backupTime`/`keepBackups` 共 9 个键（中英文各 9 个），运行 `pnpm i18n:verify` 验证对齐
- **SCSS 清理**：删除自动备份专属样式块，需确认 `.form-input`/`.form-select` 未被其他组件引用 — S3ConfigForm.vue 使用 scoped 样式定义了自己的 `.form-input`，不依赖 index.scss
- **文件头注释**：新增 `electronDialog.ts` 必须包含文件头注释（10-30 字功能说明）

## Architecture Design

### 修改后的模块结构

```
s3Backup/
├── index.ts          # S3Backup 类（精简：modal + 工作区路径 + 存储）
├── index.vue         # 面板 UI（移除自动备份区块，修复路径选择）
├── components/
│   └── S3ConfigForm.vue  # 配置表单（添加 watch 修复异步加载）
├── composables/
│   └── useS3Backup.ts    # 不变（手动备份状态/操作）
├── modules/
│   └── BackupManager.ts  # 不变（打包逻辑）
├── types/
│   ├── index.ts          # BackupSettings 精简
│   └── s3Client.ts       # 不变（S3 协议）
└── styles/
    └── index.scss        # 删除自动备份样式
```

### 数据流（修改后）

```
用户操作 → index.vue → useS3Backup composable → S3Client → S3 存储
                    → S3Backup.getStorage() → TypedStorage → PluginStorage → plugin.saveData
                    → S3Backup.getWorkspaceRoot/Path() → 缓存的工作区路径
```

### 新增共享工具

`src/utils/electronDialog.ts` 提供 `pickDirectory(title)` 和 `openFolderInExplorer(path)`，解决渲染进程中 Electron dialog/shell 的正确调用方式。