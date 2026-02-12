<template>
  <div
    v-if="showMonitor"
    ref="monitorElement"
    class="status__resUsage"
    :title="systemInfoTooltip"
  >
    <div class="monitor-item" :data-level="cpuLevel">
      <Icon icon="ph:cpu" class="monitor-icon" />
      <span class="monitor-value">{{ cpuUsageDisplay }}</span>
    </div>
    
    <div class="monitor-item" :data-level="memLevel">
      <Icon icon="ph:memory" class="monitor-icon" />
      <span class="monitor-value">{{ memoryUsageDisplay }}</span>
    </div>

    <div class="monitor-item uptime-item">
      <Icon icon="ph:timer" class="monitor-icon" />
      <span class="monitor-value">{{ uptimeDisplay }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'

// ============================================================================
// Constants & Types
// ============================================================================
const THRESHOLDS = {
  CPU: { HIGH: 80, MEDIUM: 60 },
  MEM: { HIGH: 85, MEDIUM: 70 }
}

const MONITOR_INTERVAL_MS = 3000
const INITIAL_DELAY_MS = 2000
const DEFAULT_TOTAL_MEMORY_GB = 8

type ResourceLevel = 'normal' | 'medium' | 'high'

// ============================================================================
// State
// ============================================================================
const showMonitor = ref(false)
const cpuPercent = ref(0)
const memPercent = ref(0)
const uptimeSeconds = ref(0)
const monitorElement = ref<HTMLElement | null>(null)

// ============================================================================
// Computed
// ============================================================================
const cpuUsageDisplay = computed(() => `${Math.round(cpuPercent.value)}%`)
const memoryUsageDisplay = computed(() => {
  const mbs = (memPercent.value / 100) * DEFAULT_TOTAL_MEMORY_GB * 1024
  return mbs > 1000 ? `${(mbs / 1024).toFixed(1)}G` : `${Math.round(mbs)}M`
})

const uptimeDisplay = computed(() => {
  const h = Math.floor(uptimeSeconds.value / 3600)
  const m = Math.floor((uptimeSeconds.value % 3600) / 60)
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
})

const systemInfoTooltip = computed(() => {
  const platform = typeof process !== 'undefined' ? `${process.platform} ${process.arch}` : 'Unknown'
  return `系统: ${platform}\n运行时间: ${Math.floor(uptimeSeconds.value / 3600)}小时 ${Math.floor((uptimeSeconds.value % 3600) / 60)}分\n内存限制: ${DEFAULT_TOTAL_MEMORY_GB}GB`
})

const getLevel = (percent: number, { HIGH, MEDIUM }: { HIGH: number, MEDIUM: number }): ResourceLevel => {
  if (percent >= HIGH) return 'high'
  if (percent >= MEDIUM) return 'medium'
  return 'normal'
}

const cpuLevel = computed(() => getLevel(cpuPercent.value, THRESHOLDS.CPU))
const memLevel = computed(() => getLevel(memPercent.value, THRESHOLDS.MEM))

// ============================================================================
// Logic
// ============================================================================
let intervalId: ReturnType<typeof setInterval> | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null
let lastCPU: NodeJS.CpuUsage | null = null
let lastTime: number | null = null


function updateStats() {
  if (typeof process === 'undefined') return

  // CPU
  const currCPU = process.cpuUsage()
  const currTime = Date.now()
  
  if (lastCPU && lastTime) {
    const timeDiff = currTime - lastTime
    if (timeDiff > 0) {
      const cpuDiff = (currCPU.user + currCPU.system) - (lastCPU.user + lastCPU.system)
      cpuPercent.value = Math.max(0, Math.min(100, (cpuDiff / (timeDiff * 1000)) * 100))
    }
  }
  
  lastCPU = currCPU
  lastTime = currTime

  // Memory
  const memUsage = process.memoryUsage()
  const totalMemory = DEFAULT_TOTAL_MEMORY_GB * 1024 * 1024 * 1024
  memPercent.value = Math.min(100, (memUsage.rss / totalMemory) * 100)

  // Uptime
  uptimeSeconds.value = Math.floor(process.uptime())
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
    showMonitor.value = true
    
    setTimeout(() => {
      if (tryInsertToStatusBar()) {
        start()
      }
    }, 0)
  }, INITIAL_DELAY_MS)
})

onUnmounted(() => {
  if (timeoutId) clearTimeout(timeoutId)
  stop()
})
</script>


