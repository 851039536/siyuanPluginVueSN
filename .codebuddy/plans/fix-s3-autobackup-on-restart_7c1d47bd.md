---
name: fix-s3-autobackup-on-restart
overview: 修复 S3 自动备份每次重启都触发的 bug：在 daily 模式中，当程序重启日期不同于上次备份日期且当前时间已过目标时间时，B17 修复无法阻止误触发。
todos:
  - id: fix-daily-guard
    content: 在 src/features/s3Backup/index.ts 的 case "daily" 分支中增加 timeSinceTimerStart >= 60 * 1000 守卫条件，并更新注释
    status: completed
---

## 问题

自动备份每次重开程序就会备份一次，行为不正确。

## 根因

`src/features/s3Backup/index.ts` 的 `startAutoBackupTimer()` 方法中，`minute` 和 `hourly` 模式都有 `timeSinceTimerStart >= 60 * 1000` 守卫条件，确保定时器启动 60 秒后才允许触发备份，防止第一个 tick 立即误触发。但 `daily` 模式缺失此守卫。

**跨日重启场景**：用户昨天 03:00 完成备份后关闭程序，今天 10:56 打开程序。定时器启动后第一次 tick：

1. `currentTotal >= targetTotal`（10:56 已过 03:00）→ true
2. `lastExecutedDateStr !== currentDateStr`（B17 修复只防同日重启，跨日时 `lastExecutedDateStr` 初始为空）→ true
3. `timeSinceLastBackup >= 60*1000`（昨天备份距今远超 1 分钟）→ true
→ 三个条件全部满足，立即误触发备份。

## 修复内容

在 `case "daily"` 的 if 条件中增加第 4 个条件 `&& timeSinceTimerStart >= 60 * 1000`，与 `minute`/`hourly` 模式对齐。

## 技术栈

- TypeScript
- 现有项目架构：S3Backup 类的 `startAutoBackupTimer()` 方法

## 修改文件

仅修改 1 个文件：`src/features/s3Backup/index.ts`

### 修改点

**位置**：`startAutoBackupTimer()` 方法内 `checkAndBackup` 闭包，`case "daily"` 分支（L157-172）

**修改方式**：

- 在 if 条件中增加 `&& timeSinceTimerStart >= 60 * 1000`（与 minute/hourly 模式一致）
- 更新注释说明新增的守卫条件

**改动量**：1 行代码 + 1 行注释调整

### 修复后的 daily 条件逻辑

```typescript
case "daily": {
  const [targetHour, targetMinute] = backupTime.split(":").map(Number)
  // 条件：当前时间已过目标时间、定时器已运行 ≥ 60s（防止启动时误触发）、今天尚未执行、距上次备份 ≥ 1 分钟
  const targetTotal = targetHour * 60 + targetMinute
  const currentTotal = currentHour * 60 + currentMinute
  if (
    currentTotal >= targetTotal
    && timeSinceTimerStart >= 60 * 1000
    && this.lastExecutedDateStr !== currentDateStr
    && timeSinceLastBackup >= 60 * 1000
  ) {
    shouldBackup = true
    this.lastExecutedDateStr = currentDateStr
  }
  break
}
```

## 性能分析

- `timeSinceTimerStart` 已在闭包顶部计算（L132），无额外开销
- 条件顺序优化：建议将 `timeSinceTimerStart >= 60 * 1000` 作为第二个条件（紧跟 `currentTotal >= targetTotal`），利用短路求值快速跳过
- 对正常运行无影响：定时器持续运行超过 60 秒后此条件永远为 true

## 环境影响

- 向后兼容，不影响现有备份逻辑
- minute/hourly 模式已有此守卫，daily 模式对齐后降低心智负担
- 修复后跨日重启需等待 60 秒才会触发当天备份（符合预期行为）