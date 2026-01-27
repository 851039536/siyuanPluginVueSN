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
// Constants
// ============================================================================
const CPU_HIGH_THRESHOLD = 80
const CPU_MEDIUM_THRESHOLD = 60
const MEM_HIGH_THRESHOLD = 85
const MEM_MEDIUM_THRESHOLD = 70

const MONITOR_INTERVAL_MS = 3000
const INITIAL_DELAY_MS = 2000
const MOUNT_TIMEOUT_MS = 1000

const DEFAULT_TOTAL_MEMORY_GB = 8

// ============================================================================
// Types
// ============================================================================
type ResourceLevel = 'normal' | 'medium' | 'high'

// ============================================================================
// Component State
// ============================================================================
const showMonitor = ref(false)
const cpuPercent = ref(0)
const memPercent = ref(0)
const monitorElement = ref<HTMLElement | null>(null)

// ============================================================================
// Computed Properties
// ============================================================================
const cpuUsageDisplay = computed(() => `${cpuPercent.value.toFixed(1)}%`)
const memoryUsageDisplay = computed(() => `${((memPercent.value / 100) * DEFAULT_TOTAL_MEMORY_GB * 1024).toFixed(1)}M`)

const cpuLevel = computed<ResourceLevel>(() => {
  if (cpuPercent.value >= CPU_HIGH_THRESHOLD) return 'high'
  if (cpuPercent.value >= CPU_MEDIUM_THRESHOLD) return 'medium'
  return 'normal'
})

const memLevel = computed<ResourceLevel>(() => {
  if (memPercent.value >= MEM_HIGH_THRESHOLD) return 'high'
  if (memPercent.value >= MEM_MEDIUM_THRESHOLD) return 'medium'
  return 'normal'
})

// ============================================================================
// Monitor Logic
// ============================================================================
let intervalId: ReturnType<typeof setInterval> | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null
let observer: MutationObserver | null = null

function start() {
  if (!monitorElement.value || intervalId) return

  showMonitor.value = true

  let prevCPU = process.cpuUsage()
  let prevTime = Date.now()

  intervalId = setInterval(() => {
    const currCPU = process.cpuUsage()
    const currTime = Date.now()
    const timeDiff = currTime - prevTime

    // 防止除零错误
    if (timeDiff === 0) return

    // 计算CPU使用率百分比
    const cpuDiff = (currCPU.user + currCPU.system) - (prevCPU.user + prevCPU.system)
    const cpuPercentValue = Math.max(0, Math.min(100, (cpuDiff / (timeDiff * 1000)) * 100))

    const memUsage = process.memoryUsage()
    const totalMemory = DEFAULT_TOTAL_MEMORY_GB * 1024 * 1024 * 1024
    const memPercentValue = Math.min(100, (memUsage.rss / totalMemory) * 100)

    cpuPercent.value = cpuPercentValue
    memPercent.value = memPercentValue

    prevCPU = currCPU
    prevTime = currTime
  }, MONITOR_INTERVAL_MS)
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  showMonitor.value = false
}

function cleanup() {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  stop()

  if (observer) {
    observer.disconnect()
    observer = null
  }
}

// ============================================================================
// Lifecycle Hooks
// ============================================================================
onMounted(() => {
  timeoutId = setTimeout(() => {
    if (typeof process === 'undefined') return

    const counter = document.querySelector('#status .status__counter')
    if (!counter) return

    // 移除已存在的面板
    const existing = document.querySelector('.status__resUsage')
    if (existing) existing.remove()

    // 使用MutationObserver监听monitorElement是否已挂载
    observer = new MutationObserver(() => {
      if (monitorElement.value && document.body.contains(monitorElement.value)) {
        // 元素已挂载，移动到正确位置
        counter.parentNode?.insertBefore(monitorElement.value, counter)
        observer?.disconnect()
        observer = null
        start()
      }
    })

    // 开始监听
    observer.observe(document.body, { childList: true, subtree: true })

    // 立即显示监控器（触发v-if渲染）
    showMonitor.value = true

    // 1秒后如果还没挂载，强制检查
    setTimeout(() => {
      if (monitorElement.value) {
        counter.parentNode?.insertBefore(monitorElement.value, counter)
        observer?.disconnect()
        observer = null
        start()
      }
    }, MOUNT_TIMEOUT_MS)
  }, INITIAL_DELAY_MS)
})

onUnmounted(cleanup)
</script>
