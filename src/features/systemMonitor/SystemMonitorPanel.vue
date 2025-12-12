<template>
  <div></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

let intervalId: ReturnType<typeof setInterval> | null = null
let started = false

function start(usageBtn: Element, cpu: Element, mem: Element) {
  if (intervalId) clearInterval(intervalId)
  started = true
  usageBtn.classList.remove('ft__secondary')
  intervalId = setInterval(() => {
    const cpuUsage = process.getCPUUsage()
    const memUsage = process.memoryUsage()
    cpu.textContent = `${cpuUsage.percentCPUUsage.toFixed(1)}%`
    mem.textContent = `${(memUsage.rss / 1024 / 1024).toFixed(1)}M`
  }, 3000)
}

function stop(usageBtn: Element) {
  if (intervalId) clearInterval(intervalId)
  started = false
  intervalId = null
  usageBtn.classList.add('ft__secondary')
}

onMounted(() => {
  setTimeout(() => {
    if (typeof process === 'undefined') return

    const counter = document.querySelector('#status .status__counter')
    if (!counter) return

    // 移除已存在的面板
    const existing = document.querySelector('.status__resUsage')
    if (existing) existing.remove()

    const html = `<div class="status__resUsage" style="font-size:12px;cursor:pointer;"><span class="ft__on-surface">CPU</span>&nbsp;<span class="fn__cpu">0%</span><span class="fn__space"></span><span class="ft__on-surface">内存</span>&nbsp;<span class="fn__mem">0M</span><span class="fn__space"></span></div>`
    counter.insertAdjacentHTML('beforebegin', html)

    const usageBtn = counter.previousElementSibling!
    const cpu = usageBtn.querySelector('.fn__cpu')!
    const mem = usageBtn.querySelector('.fn__mem')!

    usageBtn.addEventListener('click', () => {
      started ? stop(usageBtn) : start(usageBtn, cpu, mem)
    })

    start(usageBtn, cpu, mem)
  }, 2000)
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
  const existing = document.querySelector('.status__resUsage')
  if (existing) existing.remove()
})
</script>
