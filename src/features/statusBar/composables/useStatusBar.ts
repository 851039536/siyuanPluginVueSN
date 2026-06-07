import type {
  ResourceLevel,
  StatusBarState,
} from "../types/index"
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
} from "vue"
import { sql } from "@/api"
import {
  DEFAULT_TOTAL_MEMORY_GB,
  INITIAL_DELAY_MS,
  MONITOR_INTERVAL_MS,

  STATISTICS_INTERVAL_MS,

  THRESHOLDS,
} from "../types/index"

const TOTAL_MEMORY_BYTES = DEFAULT_TOTAL_MEMORY_GB * 1024 * 1024 * 1024
const TOTAL_MEMORY_MB = DEFAULT_TOTAL_MEMORY_GB * 1024

function formatUptime(seconds: number): { hours: number, minutes: number } {
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
  }
}

function formatCount(
  count: number,
  thresholds: [number, string][],
): string {
  for (const [threshold, suffix] of thresholds) {
    if (count >= threshold) return `${(count / threshold).toFixed(1)}${suffix}`
  }
  return String(count)
}

export function useStatusBar() {
  const state = reactive<StatusBarState>({
    cpuPercent: 0,
    memPercent: 0,
    uptimeSeconds: 0,
    showMonitor: false,
    totalNotes: 0,
    totalWords: 0,
    todayCreated: 0,
    todayModified: 0,
    yesterdayCreated: 0,
    yesterdayModified: 0,
    backupPercent: 0,
    backupPhase: "",
    backupType: "",
    backupCompleted: false,
    backupFileName: "",
    backupFileCount: 0,
  })

  let intervalIds: ReturnType<typeof setInterval>[] = []
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let backupClearTimer: ReturnType<typeof setTimeout> | null = null
  let lastCPU: NodeJS.CpuUsage | null = null
  let lastTime: number | null = null

  const cpuUsageDisplay = computed(() => `${Math.round(state.cpuPercent)}%`)

  const memoryUsageDisplay = computed(() => {
    const mbs = (state.memPercent / 100) * TOTAL_MEMORY_MB
    return mbs > 1000 ? `${(mbs / 1024).toFixed(1)}G` : `${Math.round(mbs)}M`
  })

  const uptimeDisplay = computed(() => {
    const {
      hours,
      minutes,
    } = formatUptime(state.uptimeSeconds)
    return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`
  })

  const totalNotesDisplay = computed(() =>
    formatCount(state.totalNotes, [
      [10000, "w"],
      [1000, "k"],
    ]),
  )

  const totalWordsDisplay = computed(() =>
    formatCount(state.totalWords, [
      [100000000, "亿"],
      [10000, "万"],
      [1000, "k"],
    ]),
  )

  const statisticsTooltip = computed(() => {
    return `文档数: ${state.totalNotes} 篇\n总字数: ${state.totalWords.toLocaleString()} 字`
  })

  function calcChange(today: number, yesterday: number): string {
    if (yesterday === 0) return today > 0 ? "+∞" : "0"
    const val = ((today - yesterday) / yesterday * 100).toFixed(0)
    return `${Number(val) >= 0 ? "+" : ""}${val}%`
  }

  const todayActivityDisplay = computed(() => {
    const trend = state.yesterdayCreated > 0
      ? (state.todayCreated >= state.yesterdayCreated ? "↑" : "↓")
      : (state.todayCreated > 0 ? "↑" : "")
    return `${state.todayCreated}/${state.todayModified}${trend}`
  })

  const todayTooltip = computed(() => {
    const cChg = calcChange(state.todayCreated, state.yesterdayCreated)
    const mChg = calcChange(state.todayModified, state.yesterdayModified)
    return `今日新增: ${state.todayCreated} (较昨日 ${cChg})\n今日修改: ${state.todayModified} (较昨日 ${mChg})`
  })

  const systemInfoTooltip = computed(() => {
    const platform =
      typeof process !== "undefined"
        ? `${process.platform} ${process.arch}`
        : "Unknown"
    const {
      hours,
      minutes,
    } = formatUptime(state.uptimeSeconds)
    return `系统: ${platform}\n运行时间: ${hours}小时 ${minutes}分\n内存限制: ${DEFAULT_TOTAL_MEMORY_GB}GB`
  })

  const getLevel = (
    percent: number,
    {
      HIGH,
      MEDIUM,
    }: { HIGH: number, MEDIUM: number },
  ): ResourceLevel => {
    if (percent >= HIGH) return "high"
    if (percent >= MEDIUM) return "medium"
    return "normal"
  }

  const cpuLevel = computed(() => getLevel(state.cpuPercent, THRESHOLDS.CPU))
  const memLevel = computed(() => getLevel(state.memPercent, THRESHOLDS.MEM))

  // ── Backup ──

  const backupDisplay = computed(() => {
    if (state.backupCompleted) return "备份完成"
    if (!state.backupPhase) return ""
    const type = state.backupType === "restore" ? "恢复" : "备份"
    if (state.backupPercent >= 99) return `${type}完成`
    return `${type}中 ${Math.round(state.backupPercent)}%`
  })

  const backupLevel = computed<ResourceLevel>(() => {
    if (state.backupCompleted) return "normal"
    if (state.backupPercent > 0) return "medium"
    return "normal"
  })

  const backupTooltip = computed(() => {
    if (state.backupCompleted) {
      return `备份完成: ${state.backupFileName}\n文件数: ${state.backupFileCount}`
    }
    if (!state.backupPhase) return ""
    return `${state.backupType === "restore" ? "恢复" : "备份"}进度: ${Math.round(state.backupPercent)}%\n${state.backupPhase}`
  })

  function onBackupProgress(e: Event) {
    const detail = (e as CustomEvent).detail
    state.backupPercent = detail.percent ?? 0
    state.backupPhase = detail.phase ?? ""
    state.backupType = detail.type ?? ""
    state.backupCompleted = false
    if (backupClearTimer) { clearTimeout(backupClearTimer); backupClearTimer = null }
  }

  function onBackupComplete(e: Event) {
    const detail = (e as CustomEvent).detail
    state.backupCompleted = true
    state.backupFileName = detail.fileName ?? ""
    state.backupFileCount = detail.fileCount ?? 0
    state.backupPercent = 100
    state.backupPhase = ""

    if (backupClearTimer) clearTimeout(backupClearTimer)
    backupClearTimer = setTimeout(() => {
      state.backupCompleted = false
      state.backupPercent = 0
      state.backupPhase = ""
      state.backupType = ""
      state.backupFileName = ""
      state.backupFileCount = 0
      backupClearTimer = null
    }, 5000)
  }

  window.addEventListener("dataBackupProgress", onBackupProgress)
  window.addEventListener("dataBackupComplete", onBackupComplete)

  async function fetchStatistics() {
    try {
      // 优化：使用预存的 length 字段代替 LENGTH(content)，避免对每行数据计算长度
      const today = new Date()
      const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = `${yesterday.getFullYear()}${String(yesterday.getMonth() + 1).padStart(2, "0")}${String(yesterday.getDate()).padStart(2, "0")}`

      const queryStmt = `
        SELECT
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d') as totalNotes,
          (SELECT SUM(length) FROM blocks WHERE type = 'p' AND length > 0) as totalWords,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(created, 1, 8) = '${todayStr}') as todayCreated,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(updated, 1, 8) = '${todayStr}') as todayModified,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(created, 1, 8) = '${yesterdayStr}') as yesterdayCreated,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(updated, 1, 8) = '${yesterdayStr}') as yesterdayModified
      `
      const data = await sql(queryStmt)
      if (data?.[0]) {
        state.totalNotes = Number(data[0].totalNotes || 0)
        state.totalWords = Number(data[0].totalWords || 0)
        state.todayCreated = Number(data[0].todayCreated || 0)
        state.todayModified = Number(data[0].todayModified || 0)
        state.yesterdayCreated = Number(data[0].yesterdayCreated || 0)
        state.yesterdayModified = Number(data[0].yesterdayModified || 0)
      }
    } catch (error) {
      console.error("获取统计数据失败:", error)
    }
  }

  function updateStats() {
    if (typeof process === "undefined") return

    const currCPU = process.cpuUsage()
    const currTime = Date.now()

    if (lastCPU && lastTime) {
      const timeDiff = currTime - lastTime
      if (timeDiff > 0) {
        const cpuDiff =
          currCPU.user + currCPU.system - (lastCPU.user + lastCPU.system)
        state.cpuPercent = Math.max(
          0,
          Math.min(100, (cpuDiff / (timeDiff * 1000)) * 100),
        )
      }
    }

    lastCPU = currCPU
    lastTime = currTime

    const memUsage = process.memoryUsage()
    state.memPercent = Math.min(100, (memUsage.rss / TOTAL_MEMORY_BYTES) * 100)
    state.uptimeSeconds = Math.floor(process.uptime())
  }

  function start() {
    if (intervalIds.length) return
    updateStats()
    fetchStatistics()
    intervalIds = [
      setInterval(updateStats, MONITOR_INTERVAL_MS),
      setInterval(fetchStatistics, STATISTICS_INTERVAL_MS),
    ]
  }

  function stop() {
    intervalIds.forEach(clearInterval)
    intervalIds = []
  }

  onMounted(() => {
    timeoutId = setTimeout(() => {
      state.showMonitor = true
      start()
    }, INITIAL_DELAY_MS)
  })

  onUnmounted(() => {
    if (timeoutId) clearTimeout(timeoutId)
    if (backupClearTimer) clearTimeout(backupClearTimer)
    window.removeEventListener("dataBackupProgress", onBackupProgress)
    window.removeEventListener("dataBackupComplete", onBackupComplete)
    stop()
  })

  return {
    state,
    cpuUsageDisplay,
    memoryUsageDisplay,
    uptimeDisplay,
    systemInfoTooltip,
    cpuLevel,
    memLevel,
    totalNotesDisplay,
    totalWordsDisplay,
    statisticsTooltip,
    todayActivityDisplay,
    todayTooltip,
    backupDisplay,
    backupLevel,
    backupTooltip,
  }
}
