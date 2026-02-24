import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import {
  THRESHOLDS,
  MONITOR_INTERVAL_MS,
  INITIAL_DELAY_MS,
  DEFAULT_TOTAL_MEMORY_GB,
  type ResourceLevel,
  type SystemMonitorState
} from '../types'

const TOTAL_MEMORY_BYTES = DEFAULT_TOTAL_MEMORY_GB * 1024 * 1024 * 1024
const TOTAL_MEMORY_MB = DEFAULT_TOTAL_MEMORY_GB * 1024

function formatUptime(seconds: number): { hours: number; minutes: number } {
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60)
  }
}

export function useSystemMonitor() {
  const state = reactive<SystemMonitorState>({
    cpuPercent: 0,
    memPercent: 0,
    uptimeSeconds: 0,
    showMonitor: false
  })

  const monitorElement = ref<HTMLElement | null>(null)
  let intervalId: ReturnType<typeof setInterval> | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastCPU: NodeJS.CpuUsage | null = null
  let lastTime: number | null = null

  const cpuUsageDisplay = computed(() => `${Math.round(state.cpuPercent)}%`)

  const memoryUsageDisplay = computed(() => {
    const mbs = (state.memPercent / 100) * TOTAL_MEMORY_MB
    return mbs > 1000 ? `${(mbs / 1024).toFixed(1)}G` : `${Math.round(mbs)}M`
  })

  const uptimeDisplay = computed(() => {
    const { hours, minutes } = formatUptime(state.uptimeSeconds)
    return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`
  })

  const systemInfoTooltip = computed(() => {
    const platform = typeof process !== 'undefined' ? `${process.platform} ${process.arch}` : 'Unknown'
    const { hours, minutes } = formatUptime(state.uptimeSeconds)
    return `系统: ${platform}\n运行时间: ${hours}小时 ${minutes}分\n内存限制: ${DEFAULT_TOTAL_MEMORY_GB}GB`
  })

  const getLevel = (percent: number, { HIGH, MEDIUM }: { HIGH: number; MEDIUM: number }): ResourceLevel => {
    if (percent >= HIGH) return 'high'
    if (percent >= MEDIUM) return 'medium'
    return 'normal'
  }

  const cpuLevel = computed(() => getLevel(state.cpuPercent, THRESHOLDS.CPU))
  const memLevel = computed(() => getLevel(state.memPercent, THRESHOLDS.MEM))

  function updateStats() {
    if (typeof process === 'undefined') return

    const currCPU = process.cpuUsage()
    const currTime = Date.now()

    if (lastCPU && lastTime) {
      const timeDiff = currTime - lastTime
      if (timeDiff > 0) {
        const cpuDiff = (currCPU.user + currCPU.system) - (lastCPU.user + lastCPU.system)
        state.cpuPercent = Math.max(0, Math.min(100, (cpuDiff / (timeDiff * 1000)) * 100))
      }
    }

    lastCPU = currCPU
    lastTime = currTime

    const memUsage = process.memoryUsage()
    state.memPercent = Math.min(100, (memUsage.rss / TOTAL_MEMORY_BYTES) * 100)
    state.uptimeSeconds = Math.floor(process.uptime())
  }

  function start() {
    if (intervalId) return
    updateStats()
    intervalId = setInterval(updateStats, MONITOR_INTERVAL_MS)
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function tryInsertToStatusBar() {
    const counter = document.querySelector('#status .status__counter')
    if (!counter || !monitorElement.value) return false

    const existing = document.querySelector('.status__resUsage')
    if (existing && existing !== monitorElement.value) {
      existing.remove()
    }

    counter.parentNode?.insertBefore(monitorElement.value, counter)
    return true
  }

  onMounted(() => {
    timeoutId = setTimeout(() => {
      state.showMonitor = true
      requestAnimationFrame(() => {
        if (tryInsertToStatusBar()) {
          start()
        }
      })
    }, INITIAL_DELAY_MS)
  })

  onUnmounted(() => {
    if (timeoutId) clearTimeout(timeoutId)
    stop()
  })

  return {
    state,
    monitorElement,
    cpuUsageDisplay,
    memoryUsageDisplay,
    uptimeDisplay,
    systemInfoTooltip,
    cpuLevel,
    memLevel
  }
}
