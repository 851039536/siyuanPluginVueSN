/**
 * S3 备份操作日志管理 composable
 *
 * 维护日志列表状态，提供追加（自动补 id/时间/主机名）、持久化与清空能力。
 * 通过依赖注入的 persist 写入存储槽，不直接接触插件实例。
 */
import { ref } from "vue"
import type { BackupLog, PersistFn } from "../types"
import { MAX_LOG_COUNT } from "../types"
import { getHostname } from "../utils"

export function useBackupLogs(deps: { persist: PersistFn }) {
  const backupLogs = ref<BackupLog[]>([])

  /** 追加一条日志（自动补 id/时间/主机名）并持久化，超出上限截断 */
  function addLog(entry: Omit<BackupLog, "id" | "time" | "hostname">): void {
    const log: BackupLog = {
      ...entry,
      id: Date.now().toString(),
      time: new Date().toISOString(),
      hostname: getHostname(),
    }
    backupLogs.value.unshift(log)
    if (backupLogs.value.length > MAX_LOG_COUNT) {
      backupLogs.value = backupLogs.value.slice(0, MAX_LOG_COUNT)
    }
    saveLogs()
  }

  async function saveLogs(): Promise<void> {
    await deps.persist((s) => s.backupLogs.save({ logs: backupLogs.value }))
  }

  async function clearLogs(): Promise<void> {
    backupLogs.value = []
    await saveLogs()
  }

  return { backupLogs, addLog, clearLogs }
}
