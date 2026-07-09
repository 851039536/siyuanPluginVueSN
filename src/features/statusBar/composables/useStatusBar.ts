/**
 * 状态栏核心监控逻辑：CPU/内存/运行时间采集、文档统计查询、显示格式化
 */
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

// 字数格式化阈值（按从大到小排列），避免 computed 中重复创建
const WORD_COUNT_THRESHOLDS: [number, string][] = [
  [100000000, "亿"],
  [10000, "万"],
  [1000, "k"],
]

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
  })

  let intervalIds: ReturnType<typeof setInterval>[] = []
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastCPU: NodeJS.CpuUsage | null = null
  let lastTime: number | null = null
  let lastMemPercent = -1
  let lastUptimeDisplayMinutes = -1 // 缓存 uptime 显示值，仅分钟级变化时更新

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

  const totalNotesDisplay = computed(() => String(state.totalNotes))

  const totalWordsDisplay = computed(() =>
    formatCount(state.totalWords, WORD_COUNT_THRESHOLDS),
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
        const rawCpu = Math.max(
          0,
          Math.min(100, (cpuDiff / (timeDiff * 1000)) * 100),
        )
        const roundedCpu = Math.round(rawCpu)
        // 仅 CPU 整数部分变化时写入，避免空闲期无效响应式更新
        if (roundedCpu !== Math.round(state.cpuPercent)) {
          state.cpuPercent = rawCpu
        }
      }
    }

    lastCPU = currCPU
    lastTime = currTime

    const memUsage = process.memoryUsage()
    const rawMem = Math.min(100, (memUsage.rss / TOTAL_MEMORY_BYTES) * 100)
    // 仅内存变化 >= 0.5% 时写入，避免微小波动触发渲染
    if (Math.abs(rawMem - lastMemPercent) >= 0.5) {
      state.memPercent = rawMem
      lastMemPercent = rawMem
    }
    // 仅运行时间分钟级变化时写入，避免每 3 秒无效响应式更新
    const uptime = Math.floor(process.uptime())
    const displayMinutes = Math.floor(uptime / 60)
    if (displayMinutes !== lastUptimeDisplayMinutes) {
      state.uptimeSeconds = uptime
      lastUptimeDisplayMinutes = displayMinutes
    }
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
  }
}
