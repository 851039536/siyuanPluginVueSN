---
name: s3Backup-auto-backup-logic-review
overview: 修复 S3Backup 自动备份功能的 6 个逻辑问题：时间戳丢失、hourly 窗口过窄、重复保存、定时器重复启动、S3 旧备份清理缺失、读/写不对称
todos:
  - id: fix-return-type
    content: 修复 index.ts loadWorkspaceSettings() 返回类型，补充 lastBackupTimestamp 字段
    status: completed
  - id: fix-timestamp-restore
    content: 修复 index.vue loadWorkspaceSettings() 中恢复 lastBackupTimestamp
    status: completed
    dependencies:
      - fix-return-type
  - id: fix-hourly-window
    content: 修复 index.ts hourly 模式触发窗口，移除 strict currentMinute===0 条件
    status: completed
  - id: fix-duplicate-save
    content: 移除 index.vue performManualBackup() finally 块中重复的 saveWorkspaceSettings 调用
    status: completed
  - id: fix-watch-init
    content: 修复 index.vue watch 初始化时不必要触发定时器重启，增加 isInitialLoad 标志位
    status: completed
  - id: fix-s3-cleanup
    content: 新增 performS3Backup() 中 S3 云端旧备份清理逻辑，基于 keepBackupCount 自动删除超量备份
    status: completed
---

## 用户需求

审查 S3 备份功能的自动备份设置，修复其中的逻辑性问题。

## 审查发现的 6 个问题

### 问题 1：lastBackupTimestamp 未在组件加载时恢复（严重）

- **位置**：index.vue `loadWorkspaceSettings()`（第942行）+ index.ts `loadWorkspaceSettings()`（第188行）
- **现象**：组件内的 `lastBackupTimestamp` 初始化为 0，重启后未从持久化存储恢复。index.ts 的返回类型声明也未包含此字段。
- **后果**：重启后定时器用 0 判断 `timeSinceLastBackup`，可能误触发或错过窗口。

### 问题 2：hourly 模式触发窗口过窄（严重）

- **位置**：index.ts `startAutoBackupTimer()` 第131行 `currentMinute === 0`
- **现象**：hourly 要求精确分钟匹配，但 `setInterval(60000)` 精度有限，tick 偏移到 `:01:00.001` 就会错过整小时。
- **对比**：daily 模式第148行已使用 `currentTotal >= targetTotal` 宽松窗口，hourly 应采用类似策略。

### 问题 3：performManualBackup 中 saveWorkspaceSettings 重复调用（中等）

- **位置**：index.vue 第591-607行（try块内保存）+ 第614行（finally块再次保存）
- **现象**：每次备份成功后写入两次持久化存储，造成不必要的 I/O。

### 问题 4：初始化时 watch 触发不必要的定时器重启（中等）

- **位置**：index.vue 第832-835行 watch + index.ts 第87-101行 `initAutoBackup`
- **现象**：`initAutoBackup` 已启动定时器，随后 `loadWorkspaceSettings` 设置值触发 watch → `handleTimerRestart` 又重启一次，浪费资源。

### 问题 5：keepBackupCount 仅清理本地 ZIP，S3 云端无清理（功能缺失）

- **位置**：index.vue 第649行本地清理逻辑
- **现象**：`keepBackupCount` 配置仅对本地 ZIP 生效，S3 云端旧备份永远堆积。

### 问题 6：loadWorkspaceSettings 返回类型不含 lastBackupTimestamp（中等）

- **位置**：index.ts 第188-197行返回类型声明
- **现象**：`saveWorkspaceSettings` 接受并保存 `lastBackupTimestamp`，但 `loadWorkspaceSettings` 不返回它，读/写不对称。

## 技术方案

### 涉及文件

- `src/features/s3Backup/index.ts` — S3Backup 类：修复 #2（hourly窗口）、#6（返回类型）
- `src/features/s3Backup/index.vue` — Vue 面板：修复 #1（时间戳恢复）、#3（重复保存）、#4（初始化watch）、#5（S3清理）

### 修复方案细则

#### 修复 #6 + #1：lastBackupTimestamp 读写对称恢复

**index.ts `loadWorkspaceSettings()`**（第188-212行）：

- 返回类型添加 `lastBackupTimestamp: number` 字段
- 正常返回分支添加 `lastBackupTimestamp: data.lastBackupTimestamp ?? 0`
- catch 兜底分支添加 `lastBackupTimestamp: 0`

**index.vue `loadWorkspaceSettings()`**（第942-971行）：

- 添加行：`lastBackupTimestamp = data.lastBackupTimestamp ?? 0`

#### 修复 #2：hourly 模式宽松窗口

**index.ts `startAutoBackupTimer()`**（第130-139行）：
将 hourly 的 4 个条件简化为 3 个：

```ts
case "hourly":
  if (
    this.lastExecutedHour !== currentHour
    && timeSinceTimerStart >= 60 * 1000
    && timeSinceLastBackup >= 60 * 60 * 1000
  ) {
    shouldBackup = true
    this.lastExecutedHour = currentHour
  }
  break
```

移除 `currentMinute === 0` 条件。因为 `lastExecutedHour !== currentHour` 已确保每小时仅触发一次，`timeSinceTimerStart` 防启动误触发，`timeSinceLastBackup` 防短时间内重复。

#### 修复 #3：移除重复的 saveWorkspaceSettings

**index.vue `performManualBackup()`**（第612-615行）：

- finally 块中删除 `saveWorkspaceSettings()` 调用
- 仅保留 `isBackingUp.value = false`
- try 块中已通过 `instance.saveWorkspaceSettings()` 完成持久化

#### 修复 #4：初始化期间屏蔽 watch 触发

**index.vue**：

- 新增 `const isInitialLoad = ref(true)` 标志位
- `onMounted` 中 `loadWorkspaceSettings()` 调用后设置 `isInitialLoad.value = false`
- `handleTimerRestart()` 开头添加 `if (isInitialLoad.value) return`
- 或在 watch 回调中添加同样判断

#### 修复 #5：S3 云端旧备份自动清理

**index.vue `performS3Backup()`**（第796行 `refreshBackupList()` 之后）：

- 刷新列表后，按 `lastModified` 降序排序
- 若 `backupList.value.length > keepBackupCount.value`，裁剪超出部分
- 逐条调用 `deleteBackup()` 删除旧的 S3 备份
- 用 try-catch 包裹单个删除，避免某一删除失败影响后续清理