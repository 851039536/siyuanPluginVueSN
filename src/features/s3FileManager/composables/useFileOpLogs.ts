/**
 * S3 文件管理器操作日志 composable
 *
 * 维护日志列表状态：加载、追加（自动补 id/时间/主机名）、持久化与清空。
 * 持久化走注入的 SQLite 日志仓库（按条写入，见 types/storage.ts），
 * 内存态为唯一展示源，超出上限截断。
 */
import { ref } from "vue"
import { getHostname } from "@/utils/s3/concurrency"
import { MAX_LOG_COUNT } from "@/utils/s3/types"
import type { FileOpLog } from "../types"
import type { S3FileManagerStorage } from "../types/storage"

export function useFileOpLogs(deps: { storage: S3FileManagerStorage }) {
  const logs = ref<FileOpLog[]>([])
  /** 日志 id 自增序号：与时间戳拼用，避免同一毫秒内两条日志 id 碰撞 */
  let idSeq = 0

  /** 启动加载持久化日志 */
  async function loadLogs(): Promise<void> {
    logs.value = deps.storage.logs.load()
  }

  /** 追加一条日志（自动补 id/时间/主机名），按条写入数据库并裁剪内存态 */
  function addLog(entry: Omit<FileOpLog, "id" | "time" | "hostname">): void {
    const log: FileOpLog = {
      ...entry,
      id: `${Date.now()}-${++idSeq}`,
      time: new Date().toISOString(),
      hostname: getHostname(),
    }
    logs.value.unshift(log)
    if (logs.value.length > MAX_LOG_COUNT) {
      logs.value = logs.value.slice(0, MAX_LOG_COUNT)
    }
    deps.storage.logs.append(log)
  }

  async function clearLogs(): Promise<void> {
    logs.value = []
    deps.storage.logs.clear()
  }

  return { logs, loadLogs, addLog, clearLogs }
}
