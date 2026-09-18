/**
 * S3 文件管理器操作日志 composable
 *
 * 维护日志列表状态：加载、追加（自动补 id/时间/主机名）、持久化与清空。
 * 直接操作注入的存储槽，超出上限截断。
 */
import { ref } from "vue"
import { getHostname } from "@/utils/s3/concurrency"
import { MAX_LOG_COUNT } from "@/utils/s3/types"
import type { FileOpLog } from "../types"
import type { S3FileManagerStorage } from "../types/storage"

export function useFileOpLogs(deps: { storage: S3FileManagerStorage }) {
  const logs = ref<FileOpLog[]>([])

  /** 启动加载持久化日志 */
  async function loadLogs(): Promise<void> {
    try {
      logs.value = (await deps.storage.logs.loadOrDefault()).logs
    } catch {
      // 读取失败保持空列表（存储层异常不应阻断面板打开）
    }
  }

  /** 追加一条日志（自动补 id/时间/主机名）并持久化，超出上限截断 */
  function addLog(entry: Omit<FileOpLog, "id" | "time" | "hostname">): void {
    const log: FileOpLog = {
      ...entry,
      id: Date.now().toString(),
      time: new Date().toISOString(),
      hostname: getHostname(),
    }
    logs.value.unshift(log)
    if (logs.value.length > MAX_LOG_COUNT) {
      logs.value = logs.value.slice(0, MAX_LOG_COUNT)
    }
    void saveLogs()
  }

  async function saveLogs(): Promise<void> {
    try {
      await deps.storage.logs.save({ logs: logs.value })
    } catch {
      // 落盘失败不阻断当前操作（内存态仍然可用）
    }
  }

  async function clearLogs(): Promise<void> {
    logs.value = []
    await saveLogs()
  }

  return { logs, loadLogs, addLog, clearLogs }
}
