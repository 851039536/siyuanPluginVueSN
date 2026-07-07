<!-- 批量加载进度条组件：进度条 + 可缩放执行日志 -->
<template>
  <div
    v-if="state.visible"
    class="gp-batch-progress"
    :class="{ 'gp-batch-progress--done': state.done }"
  >
    <!-- 进度条区域 -->
    <div class="gp-batch-progress-row">
      <Icon
        v-if="state.done"
        icon="mdi:check-circle-outline"
        height="14"
        class="gp-batch-progress-done-icon"
      />
      <span class="gp-batch-progress-label">{{ state.done ? '完成' : state.label }} {{ state.current }}/{{ state.total }}</span>
      <div class="gp-batch-progress-bar">
        <div
          class="gp-batch-progress-fill"
          :style="{ width: progressPercent + '%' }"
        />
      </div>
      <span
        v-if="state.projectName && !state.done"
        class="gp-batch-progress-name"
      >{{ state.projectName }}</span>
      <span class="gp-batch-progress-time">{{ state.elapsedSeconds.toFixed(1) }}s</span>
      <button
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
      <button
        v-if="state.done"
        class="gp-batch-progress-close"
        title="关闭"
        @click="emit('close')"
      >
        <Icon
          icon="mdi:close"
          height="14"
        />
      </button>
    </div>

    <!-- 可缩放日志区域 -->
    <div
      v-show="logExpanded"
      class="gp-batch-log"
    >
      <div
        v-for="(entry, i) in logEntries"
        :key="i"
        class="gp-batch-log-line"
        :class="{
          'gp-batch-log-line--ok': entry.status === 'ok',
          'gp-batch-log-line--fail': entry.status === 'fail',
          'gp-batch-log-line--pending': entry.status === 'pending',
        }"
      >
        <Icon
          v-if="entry.status === 'ok'"
          icon="mdi:check"
          height="12"
        />
        <Icon
          v-else-if="entry.status === 'fail'"
          icon="mdi:close"
          height="12"
        />
        <Icon
          v-else
          icon="mdi:loading"
          height="12"
          class="gp-batch-log-spin"
        />
        <span class="gp-batch-log-name">{{ entry.projectName }}</span>
        <span class="gp-batch-log-time">{{ entry.elapsedSeconds.toFixed(1) }}s</span>
        <span
          v-if="entry.error"
          class="gp-batch-log-error"
        >{{ entry.error }}</span>
        <!-- 分步骤耗时标签行 -->
        <div
          v-if="entry.steps && entry.steps.length > 0"
          class="gp-batch-log-steps"
        >
          <span
            v-for="(step, si) in entry.steps"
            :key="si"
            class="gp-batch-log-step"
          >
            <span class="gp-batch-log-step-name">{{ step.name }}</span>
            <span class="gp-batch-log-step-ms">{{ step.ms }}ms</span>
            <span
              v-if="si < entry.steps.length - 1"
              class="gp-batch-log-step-sep"
            >·</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { Icon } from "@iconify/vue"
import type { LoadProgress, LogEntry } from "../types/batchProgress"

const props = defineProps<{
  state: LoadProgress
  logEntries: LogEntry[]
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const logExpanded = ref(false)

const progressPercent = computed(() => {
  if (props.state.total === 0) return 0
  return (props.state.current / props.state.total) * 100
})

</script>

<style lang="scss">
@use "../styles/BatchProgressBar.scss";
@use "../styles/index.scss";
</style>
