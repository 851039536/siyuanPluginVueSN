// 批量操作进度状态管理 composable
import { ref, onUnmounted } from "vue"
import type { LoadProgress, LogEntry } from "../types/batchProgress"

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

  function addLog(entry: LogEntry) {
    logEntries.value.push(entry)
  }

  onUnmounted(() => {
    if (progressTimer) {
      clearInterval(progressTimer)
      progressTimer = null
    }
  })

  return { state, logEntries, start, advance, end, addLog }
}
