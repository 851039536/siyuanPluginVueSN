<!-- 批量加载进度条组件：进度条 + 可缩放执行日志 -->
<template>
  <div
    v-if="state.visible"
    class="gp-batch-progress"
  >
    <!-- 进度条区域 -->
    <div class="gp-batch-progress-row">
      <span class="gp-batch-progress-label">{{ state.label }} {{ state.current }}/{{ state.total }}</span>
      <div class="gp-batch-progress-bar">
        <div
          class="gp-batch-progress-fill"
          :style="{ width: progressPercent + '%' }"
        />
      </div>
      <span
        v-if="state.projectName"
        class="gp-batch-progress-name"
      >{{ state.projectName }}</span>
      <span class="gp-batch-progress-time">{{ state.elapsedSeconds.toFixed(1) }}s</span>
      <button
        v-if="logEntries.length > 0"
        class="gp-batch-progress-toggle"
        :class="{ 'is-expanded': logExpanded }"
        @click="logExpanded = !logExpanded"
      >
        <span class="gp-batch-progress-toggle-label">日志</span>
        <Icon
          :icon="logExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
          height="14"
        />
      </button>
    </div>

    <!-- 可缩放日志区域 -->
    <div
      v-show="logExpanded"
      class="gp-batch-log"
      ref="logContainerRef"
    >
      <div
        v-for="(entry, i) in logEntries"
        :key="i"
        class="gp-batch-log-line"
        :class="{
          'gp-batch-log-line--ok': entry.status === 'ok',
          'gp-batch-log-line--fail': entry.status === 'fail',
        }"
      >
        <Icon
          v-if="entry.status === 'ok'"
          icon="mdi:check"
          height="12"
        />
        <Icon
          v-else
          icon="mdi:close"
          height="12"
        />
        <span class="gp-batch-log-name">{{ entry.projectName }}</span>
        <span class="gp-batch-log-time">{{ entry.elapsedSeconds.toFixed(1) }}s</span>
        <span
          v-if="entry.error"
          class="gp-batch-log-error"
        >{{ entry.error }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue"
import { Icon } from "@iconify/vue"
import type { LoadProgress, LogEntry } from "../types/batchProgress"

const props = defineProps<{
  state: LoadProgress
  logEntries: LogEntry[]
}>()

const logExpanded = ref(false)
const logContainerRef = ref<HTMLElement>()

const progressPercent = computed(() => {
  if (props.state.total === 0) return 0
  return (props.state.current / props.state.total) * 100
})

// 首次有日志时自动展开 + 自动滚动到底部
watch(
  () => props.logEntries.length,
  async (len) => {
    if (len > 0 && !logExpanded.value) {
      logExpanded.value = true
    }
    await nextTick()
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  }
)
</script>

<style lang="scss">
@use "../styles/BatchProgressBar.scss";
@use "../styles/index.scss";
</style>
