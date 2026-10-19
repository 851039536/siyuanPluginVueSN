/**
 * S3 文件管理器操作日志 composable
 *
 * 维护日志列表状态：加载、追加（自动补 id/时间/主机名）、持久化与清空。
 * 直接操作注入的存储槽，超出上限截断。落盘按序串行（同一时刻至多一次写盘），
 * 并以写入瞬间的快照落盘，避免异步序列化期间数组被 unshift 改出混合状态。
 */
import { ref } from "vue"
import { getHostname } from "@/utils/s3/concurrency"
import { MAX_LOG_COUNT } from "@/utils/s3/types"
import type { FileOpLog } from "../types"
import type { S3FileManagerStorage } from "../types/storage"

export function useFileOpLogs(deps: { storage: S3FileManagerStorage }) {
  const logs = ref<FileOpLog[]>([])
  /** 落盘串行链：后一次写盘等待前一次完成，保证最终落盘为最新状态 */
  let writeChain: Promise<void> = Promise.resolve()
  /** 日志 id 自增序号：与时间戳拼用，避免同一毫秒内两条日志 id 碰撞 */
  let idSeq = 0

  /** 启动加载持久化日志 */
  async function loadLogs(): Promise<void> {
    logs.value = (await deps.storage.logs.loadOrDefault()).logs
  }

  /** 追加一条日志（自动补 id/时间/主机名）并持久化，超出上限截断 */
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
    void saveLogs()
  }

  function saveLogs(): Promise<void> {
    const snapshot = [...logs.value]
    const write = deps.storage.logs.save({ logs: snapshot }).then((ok) => {
      if (!ok) { console.warn("[S3文件管理] 操作日志落盘失败") }
    })
    // 失败不阻断链路：后续写盘仍要继续
    writeChain = writeChain.then(() => write, () => write)
    return write
  }

  async function clearLogs(): Promise<void> {
    logs.value = []
    await saveLogs()
  }

  return { logs, loadLogs, addLog, clearLogs }
}
