<template>
  <div
    v-if="showMonitor"
    ref="monitorElement"
    class="status__resUsage"
  >
    <span class="ft__on-surface">CPU</span>
    <span class="fn__cpu" :data-level="cpuLevel">{{ cpuUsageDisplay }}</span>
    <span class="ft__on-surface">内存</span>
    <span class="fn__mem" :data-level="memLevel">{{ memoryUsageDisplay }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

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
const monitorElement = ref<HTMLElement | null>(null)

// ============================================================================
// Computed
// ============================================================================
const cpuUsageDisplay = computed(() => `${cpuPercent.value.toFixed(1)}%`)
const memoryUsageDisplay = computed(() => {
  const bytes = (memPercent.value / 100) * DEFAULT_TOTAL_MEMORY_GB * 1024 * 1024 * 1024
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
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
}

let lastCPU: NodeJS.CpuUsage | null = null
let lastTime: number | null = null

function start() {
  if (intervalId) return
  updateStats() // Initial call
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

  // Avoid duplicate insertion
  const existing = document.querySelector('.status__resUsage')
  if (existing && existing !== monitorElement.value) {
    existing.remove()
  }

  counter.parentNode?.insertBefore(monitorElement.value, counter)
  return true
}

onMounted(() => {
  // Wait for SiYuan UI to be ready
  timeoutId = setTimeout(() => {
    showMonitor.value = true // Render the element
    
    // Use nextTick equivalent to wait for ref update
    setTimeout(() => {
      if (tryInsertToStatusBar()) {
        start()
      } else {
        // Fallback or retry if needed, but usually 2s is enough
        console.warn('System Monitor: Status bar counter not found')
      }
    }, 0)
  }, INITIAL_DELAY_MS)
})

onUnmounted(() => {
  if (timeoutId) clearTimeout(timeoutId)
  stop()
})
</script>

