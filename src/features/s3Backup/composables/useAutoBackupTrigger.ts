/**
 * 自动备份触发与定时器重启 composable
 *
 * 封装 autoBackupTrigger 事件处理（互斥跳过 + 忙碌日志节流 + 失败回滚防重标记）
 * 与自动备份设置变更后的定时器重启（isInitialLoad 阻塞初始化期误触发）。
 */
import { ref, watch } from "vue"
import type { Ref } from "vue"
import type { BackupLog, BackupFrequency } from "../types"
import { getS3BackupInstance } from "../instance"

/** 依赖注入：备份执行由编排层提供，设置状态来自 useWorkspaceSettings */
export interface AutoBackupTriggerDeps {
  i18n: Record<string, string>
  isAnyTaskRunning: Ref<boolean>
  autoBackupEnabled: Ref<boolean>
  backupFrequency: Ref<BackupFrequency>
  backupTime: Ref<string>
  addLog: (entry: Omit<BackupLog, "id" | "time" | "hostname">) => void
  /** 执行一次无人值守备份（编排层 performManualBackup(true)），返回是否成功 */
  runAutoBackup: () => Promise<boolean>
}

export function useAutoBackupTrigger(deps: AutoBackupTriggerDeps) {
  const { i18n, addLog } = deps

  // 忙碌跳过日志的节流间隔：长任务期间避免每 60s 重复记录并全量落盘
  const BUSY_LOG_THROTTLE_MS = 5 * 60 * 1000
  let lastBusyLogAt = 0

  async function handleAutoBackupTrigger(): Promise<void> {
    // 定时触发不经过 UI 按钮禁用，需自行互斥：另一任务运行中时跳过并记日志
    if (deps.isAnyTaskRunning.value) {
      // 忙碌跳过日志按间隔节流（同类去重），避免长任务期间反复全量重写日志存储
      const now = Date.now()
      if (now - lastBusyLogAt >= BUSY_LOG_THROTTLE_MS) {
        lastBusyLogAt = now
        addLog({
          type: "autoBackup",
          action: i18n.autoBackup,
          fileName: "",
          success: false,
          message: i18n.autoBackupSkippedBusy,
        })
      }
      // 忙碌时不回滚防重标记：任务正在执行，完成后 updateLastBackupTime 会恢复标记；
      // 若在任务进行中回滚，长任务结束后会触发"完成后 1 分钟再次备份"的重复调度。
      return
    }
    // runAutoBackup 内部吞掉所有错误并返回是否成功；失败/跳过时回滚标记，允许下一 tick 重试
    const ok = await deps.runAutoBackup()
    if (!ok) {
      getS3BackupInstance()?.resetExecutionMarks()
    }
  }

  // 初始化完成后才允许 watch 触发定时器重启，避免与 initAutoBackup 重复启动
  const isInitialLoad = ref(true)

  function handleTimerRestart(): void {
    if (isInitialLoad.value) { return }
    getS3BackupInstance()?.restartAutoBackupTimer(
      deps.autoBackupEnabled.value,
      deps.backupFrequency.value,
      deps.backupTime.value,
    )
  }

  watch(
    [deps.backupFrequency, deps.backupTime, deps.autoBackupEnabled],
    () => handleTimerRestart(),
  )

  return { handleAutoBackupTrigger, isInitialLoad }
}
