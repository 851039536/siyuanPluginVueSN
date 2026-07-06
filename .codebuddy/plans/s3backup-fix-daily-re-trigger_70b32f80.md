---
name: s3backup-fix-daily-re-trigger
overview: 修复 S3Backup 每天只备份一次的设置在程序重启后异常重新触发的 bug。根因是 startAutoBackupTimer() 每次重置 lastExecutedDateStr=""，导致重启后第一 tick 必然触发。同时修复 hourly 模式的同类问题。
todos:
  - id: fix-restart-bug
    content: 在 index.ts 的 startAutoBackupTimer() 第 109 行后插入 lastBackupTimestamp 回填逻辑，修复重启误触发备份 bug
    status: completed
  - id: verify-lint
    content: 运行 ESLint 验证修改无错误
    status: completed
    dependencies:
      - fix-restart-bug
---

## 修复自动备份重启误触发 Bug

用户设置每天备份一次，但每次重启程序后 60 秒就会触发一次备份。

**根因**：`startAutoBackupTimer()` 每次调用都重置 `lastExecutedDateStr = ""` 和 `lastExecutedHour = -1`，导致 daily/hourly 模式的防重复标记丢失。daily 条件下 `"" !== todayDateStr` 恒为 true，三个条件全部满足即触发备份。

**修复策略**：重置标记后，利用已持久化的 `this.lastBackupTimestamp` 回填标记，恢复重启前的执行状态。

## 技术方案

### 修复位置

`src/features/s3Backup/index.ts` — `startAutoBackupTimer()` 方法，第 109 行之后。

### 修复逻辑

在重置标记后插入回填代码：

```ts
// A6 修复：重置实例字段而非闭包局部变量
this.lastExecutedHour = -1
this.lastExecutedDateStr = ""

// 新增：基于已持久化的 lastBackupTimestamp 回填防重复标记
if (this.lastBackupTimestamp > 0) {
  const lastBackupDate = new Date(this.lastBackupTimestamp)
  const todayStr = new Date().toDateString()
  if (lastBackupDate.toDateString() === todayStr) {
    // 今天已经备份过，恢复日期标记防止重复触发
    this.lastExecutedDateStr = todayStr
    // hourly 模式下也恢复小时标记
    if (backupFrequency === "hourly") {
      this.lastExecutedHour = lastBackupDate.getHours()
    }
  }
}
```

### 影响范围

- `daily` 模式：重启后若今天已备份，不会再次触发
- `hourly` 模式：重启后若当前小时已备份，不会在当前小时再次触发
- `minute` 模式：不受影响（依赖 `timeSinceLastBackup >= 60000` 判断，属正确行为）

### 不变项

- 现有定时器 tick 逻辑、条件判断、事件派发均不变
- 手动备份不受影响
- 首次启用自动备份的场景（`lastBackupTimestamp = 0`）不受影响