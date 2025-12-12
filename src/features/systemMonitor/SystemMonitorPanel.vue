<template>
  <div
    v-if="showMonitor"
    ref="monitorElement"
    class="status__resUsage"
    style="font-size:12px;cursor:pointer;"
    @click="toggleMonitor"
  >
    <span class="ft__on-surface">CPU</span>&nbsp;
    <span class="fn__cpu">{{ cpuUsage }}</span>
    <span class="fn__space"></span>
    <span class="ft__on-surface">内存</span>&nbsp;
    <span class="fn__mem">{{ memoryUsage }}</span>
    <span class="fn__space"></span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const showMonitor = ref(false)
const cpuUsage = ref('0%')
const memoryUsage = ref('0M')
const monitorElement = ref<HTMLElement | null>(null)

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
    const cpuPercent = Math.max(0, Math.min(100, (cpuDiff / (timeDiff * 1000)) * 100)) // 限制在0-100%

    const memUsage = process.memoryUsage()

    cpuUsage.value = `${cpuPercent.toFixed(1)}%`
    memoryUsage.value = `${(memUsage.rss / 1024 / 1024).toFixed(1)}M`

    prevCPU = currCPU
    prevTime = currTime
  }, 3000)
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  showMonitor.value = false
}

function toggleMonitor() {
  if (showMonitor.value) {
    stop()
  } else {
    start()
  }
}

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
    }, 1000)
  }, 2000)
})

onUnmounted(() => {
  // 清理所有定时器
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  stop()

  // 清理MutationObserver
  if (observer) {
    observer.disconnect()
    observer = null
  }
})
</script>
