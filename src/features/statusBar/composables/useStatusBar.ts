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
import { TimerRegistry } from "@/utils/timerRegistry"
import {
  DEFAULT_TOTAL_MEMORY_GB,
  INITIAL_DELAY_MS,
  MONITOR_INTERVAL_MS,

  STATISTICS_INTERVAL_MS,

  THRESHOLDS,
} from "../types/index"

const TOTAL_MEMORY_BYTES = DEFAULT_TOTAL_MEMORY_GB * 1024 * 1024 * 1024
const TOTAL_MEMORY_MB = DEFAULT_TOTAL_MEMORY_GB * 1024

/** i18n 文案（statusBar 分片），由调用方注入；缺省回退空对象（仅影响 tooltip 文案） */
export type StatusBarI18n = Record<string, string>

/** 极简模板替换：把 `{name}` 占位符替换为对应值 */
function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    (key in vars ? String(vars[key]) : whole))
}

function formatUptime(seconds: number): { hours: number, minutes: number } {
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
  }
}

/**
 * 构造 blocks.created/updated 的日期边界串（`YYYYMMDDHHmmss` 形式）。
 * 用于范围谓词（`created >= 'X000000' AND created <= 'X235959'`），
 * 相较 `substr(created,1,8) = 'YYYYMMDD'` 可命中索引。
 */
function toDateBound(date: Date, timeSuffix: string): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}${m}${d}${timeSuffix}`
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

export function useStatusBar(i18n: StatusBarI18n = {}) {
  /** 取文案，缺失时回退到给定默认（仅 tooltip 用，避免空串） */
  const t = (key: string, fallback: string): string => i18n[key] || fallback

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

  // 定时器统一托管（TimerRegistry），clearAll 同时覆盖启动延迟 timeout 与周期 interval
  const timerRegistry = new TimerRegistry()
  let started = false
  let lastCPU: NodeJS.CpuUsage | null = null
  let lastTime: number | null = null
  let lastMemPercent = -1
  let lastUptimeDisplayMinutes = -1 // 缓存 uptime 显示值，仅分钟级变化时更新

  /**
   * 字数缩写阈值（按从大到小）。后缀走 i18n —— 中文「亿/万」与英文「B/k」量级不同，
   * 原先硬编码中文后缀导致英文界面显示「1.2万」。
   */
  const wordCountThresholds = computed<[number, string][]>(() => [
    [100000000, t("countSuffixHundredMillion", "B")],
    [10000, t("countSuffixTenThousand", "0k")],
    [1000, t("countSuffixThousand", "k")],
  ])

  const cpuUsageDisplay = computed(() => `${Math.round(state.cpuPercent)}%`)

  const memoryUsageDisplay = computed(() => {
    const mbs = (state.memPercent / 100) * TOTAL_MEMORY_MB
    return mbs >= 1000 ? `${(mbs / 1024).toFixed(1)}G` : `${Math.round(mbs)}M`
  })

  const uptimeDisplay = computed(() => {
    const {
      hours,
      minutes,
    } = formatUptime(state.uptimeSeconds)
    return hours > 0
      ? interpolate(t("uptimeHoursMinutes", "{hours}h{minutes}m"), { hours, minutes })
      : interpolate(t("uptimeMinutes", "{minutes}m"), { minutes })
  })

  const totalNotesDisplay = computed(() => String(state.totalNotes))

  const totalWordsDisplay = computed(() => formatCount(state.totalWords, wordCountThresholds.value))

  const statisticsTooltip = computed(() =>
    interpolate(t("tipNotesWords", "Documents: {notes}\nWords: {words}"), {
      notes: state.totalNotes,
      words: state.totalWords.toLocaleString(),
    }),
  )

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
    return interpolate(
      t("tipTodayActivity", "Created today: {created} (vs yesterday {createdChange})\nModified today: {modified} (vs yesterday {modifiedChange})"),
      {
        created: state.todayCreated,
        createdChange: cChg,
        modified: state.todayModified,
        modifiedChange: mChg,
      },
    )
  })

  const systemInfoTooltip = computed(() => {
    const platform =
      typeof process !== "undefined"
        ? `${process.platform} ${process.arch}`
        : t("tipUnknownPlatform", "Unknown")
    const {
      hours,
      minutes,
    } = formatUptime(state.uptimeSeconds)
    return interpolate(t("tipSystemInfo", "System: {platform}\nUptime: {hours}h {minutes}m\nMemory limit: {memory}GB"), {
      platform,
      hours,
      minutes,
      memory: DEFAULT_TOTAL_MEMORY_GB,
    })
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
      // 日期谓词用「范围比较」而非 substr(created,1,8)=X —— 后者对列做函数运算无法命中索引，
      // 与 statistics/queries/baseStats.ts 保持同一写法（两个模块的同类统计查询口径一致）
      const today = new Date()
      const todayStr = toDateBound(today, "000000")
      const todayEnd = toDateBound(today, "235959")
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = toDateBound(yesterday, "000000")
      const yesterdayEnd = toDateBound(yesterday, "235959")

      const queryStmt = `
        SELECT
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d') as totalNotes,
          (SELECT SUM(length) FROM blocks WHERE type = 'p' AND length > 0) as totalWords,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND created >= '${todayStr}' AND created <= '${todayEnd}') as todayCreated,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND updated >= '${todayStr}' AND updated <= '${todayEnd}') as todayModified,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND created >= '${yesterdayStr}' AND created <= '${yesterdayEnd}') as yesterdayCreated,
          (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND updated >= '${yesterdayStr}' AND updated <= '${yesterdayEnd}') as yesterdayModified
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
    if (started) return
    started = true
    updateStats()
    fetchStatistics()
    timerRegistry.setInterval(updateStats, MONITOR_INTERVAL_MS)
    timerRegistry.setInterval(fetchStatistics, STATISTICS_INTERVAL_MS)
  }

  onMounted(() => {
    timerRegistry.setTimeout(() => {
      state.showMonitor = true
      start()
    }, INITIAL_DELAY_MS)
  })

  onUnmounted(() => {
    timerRegistry.clearAll()
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
