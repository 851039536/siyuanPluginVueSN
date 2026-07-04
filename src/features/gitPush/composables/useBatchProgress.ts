// 批量操作进度状态管理 composable
import { ref, onUnmounted } from "vue"
import type { LoadProgress, LogEntry, LogStep } from "../types/batchProgress"

const DEFAULT_STATE: LoadProgress = {
  visible: false,
  current: 0,
  total: 0,
  label: "",
  elapsedSeconds: 0,
}

export function useBatchProgress() {
  const state = ref<LoadProgress>({ ...DEFAULT_STATE })
  const logEntries = ref<LogEntry[]>([])
  let progressTimer: ReturnType<typeof setInterval> | null = null

  function start(total: number, label: string) {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    logEntries.value = []
    state.value = { visible: true, current: 0, total, label, elapsedSeconds: 0 }
    const startTime = Date.now()
    progressTimer = setInterval(() => {
      state.value.elapsedSeconds = (Date.now() - startTime) / 1000
    }, 100)
  }

  function advance(projectName?: string) {
    state.value.current++
    if (projectName) {
      state.value.projectName = projectName
    }
  }

  function end() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    state.value = { ...DEFAULT_STATE }
  }

  /** 完成批量操作：停止计时器但保持可见，等待用户手动关闭 */
  function finish() {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
    state.value = { ...state.value, done: true }
  }

  /** 手动关闭进度条 */
  function hide() {
    state.value = { ...DEFAULT_STATE }
  }

  /** 创建 pending 状态的日志条目，返回索引供后续 addStep/completeLog 使用 */
  function beginLog(projectName: string): number {
    const entry: LogEntry = {
      projectName,
      status: "pending",
      elapsedSeconds: 0,
      steps: [],
    }
    logEntries.value.push(entry)
    return logEntries.value.length - 1
  }

  /** 向指定日志条目追加一个步骤耗时记录 */
  function addStep(idx: number, step: LogStep) {
    const entry = logEntries.value[idx]
    if (!entry) return
    // 替换整个 entry 对象确保 Vue 响应式更新
    logEntries.value[idx] = {
      ...entry,
      steps: [...(entry.steps || []), step],
    }
  }

  /** 完成指定日志条目，设置最终状态和总耗时 */
  function completeLog(idx: number, status: "ok" | "fail", elapsedSeconds: number, error?: string) {
    const entry = logEntries.value[idx]
    if (!entry) return
    logEntries.value[idx] = {
      ...entry,
      status,
      elapsedSeconds,
      error,
    }
  }

  /** 兼容旧 API：一次性添加完整的日志条目（无步骤明细） */
  function addLog(entry: LogEntry) {
    logEntries.value.push(entry)
  }

  onUnmounted(() => {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  })

  return {
    state,
    logEntries,
    start,
    advance,
    end,
    finish,
    hide,
    beginLog,
    addStep,
    completeLog,
    addLog,
  }
}
