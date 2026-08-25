// 操作日志持久化 composable（惰性加载 + 防抖写入 + 环形上限）
import type { GitOpLogEntry, GitPushManager } from "../types"
import { MAX_OP_LOG_COUNT } from "../types"
import { onUnmounted, ref } from "vue"

/** 追加日志的输入（id/time 由 appendOpLog 自动补全） */
export type AppendOpLogInput = Omit<GitOpLogEntry, "id" | "time">

export function useOpLog(manager: GitPushManager) {
  const opLogs = ref<GitOpLogEntry[]>([])

  /** 惰性首读缓存（防并发重复加载） */
  let loadPromise: Promise<void> | null = null
  /** 是否已完成首读（无论结果是否为空），避免清空后 append 用空数组覆盖磁盘历史 */
  let loaded = false

  /** 防抖定时器（合并密集写入） */
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  /** 惰性加载首读 */
  async function ensureOpLogsLoaded(): Promise<void> {
    if (loaded) return
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
      try {
        const saved = await manager.storage.opLogs.loadOrDefault()
        if (Array.isArray(saved)) {
          opLogs.value = saved
        }
      } catch (e: any) {
        console.warn("[gitPush] 加载操作日志失败:", e?.message || e)
      } finally {
        loaded = true
      }
    })()
    return loadPromise
  }

  /** 防抖落盘（约 1s，合并批量操作密集写入） */
  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      manager.storage.opLogs.save(opLogs.value).catch((e: any) => {
        console.warn("[gitPush] 保存操作日志失败:", e?.message || e)
      })
    }, 1000)
  }

  /** 追加操作日志（fire-and-forget，失败仅 console.warn，不影响 git 主流程） */
  async function appendOpLog(input: AppendOpLogInput): Promise<void> {
    try {
      // 必须先确保已加载历史，否则防抖 save 会用内存数组覆盖已存历史
      await ensureOpLogsLoaded()
      const entry: GitOpLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toISOString(),
        ...input,
      }
      opLogs.value = [entry, ...opLogs.value]
      // 环形上限截断
      if (opLogs.value.length > MAX_OP_LOG_COUNT) {
        opLogs.value = opLogs.value.slice(0, MAX_OP_LOG_COUNT)
      }
      debouncedSave()
    } catch (e: any) {
      console.warn("[gitPush] 追加操作日志失败:", e?.message || e)
    }
  }

  /** 清空全部日志 */
  async function clearOpLogs(): Promise<void> {
    opLogs.value = []
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    try {
      await manager.storage.opLogs.save([])
    } catch (e: any) {
      console.warn("[gitPush] 清空操作日志失败:", e?.message || e)
    }
  }

  /** 立即落盘未保存缓冲（组件卸载时调用） */
  function flush() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    // 未发生过加载/追加时（loaded=false），内存仍是初始空数组，
    // 无条件 save 会用空数组覆盖磁盘上已有的历史日志 —— 必须跳过
    if (!loaded) return
    manager.storage.opLogs.save(opLogs.value).catch((e: any) => {
      console.warn("[gitPush] flush 操作日志失败:", e?.message || e)
    })
  }

  onUnmounted(() => {
    flush()
  })

  return {
    opLogs,
    ensureOpLogsLoaded,
    appendOpLog,
    clearOpLogs,
    flush,
  }
}
