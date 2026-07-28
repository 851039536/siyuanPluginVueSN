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
      <!-- 进度标签："完成"（done 态）或调用方传入的操作名 -->
      <span class="gp-batch-progress-label">{{ state.done ? i18n.done : state.label }} {{ state.current }}/{{ state.total }}</span>
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
        <!-- 日志展开按钮："日志" -->
        <span class="gp-batch-progress-toggle-label">{{ i18n.batchLogToggle }}</span>
        <Icon
          :icon="logExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
          height="14"
        />
      </button>
      <!-- 关闭按钮，悬浮提示："关闭" -->
      <button
        v-if="state.done"
        class="gp-batch-progress-close"
        :title="i18n.close"
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
        :class="`gp-batch-log-line--${entry.status}`"
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
        <!-- 总耗时：pending 期间无实时计时，完成后才显示，避免恒显 0.0s -->
        <span
          v-if="entry.status !== 'pending'"
          class="gp-batch-log-time"
        >{{ entry.elapsedSeconds.toFixed(1) }}s</span>
        <span
          v-if="entry.error"
          class="gp-batch-log-error"
        >{{ entry.error }}</span>
        <!-- 分步骤耗时标签行（步骤间分隔符由 CSS 兄弟选择器生成） -->
        <div
          v-if="entry.steps?.length"
          class="gp-batch-log-steps"
        >
          <span
            v-for="(step, si) in entry.steps"
            :key="si"
            class="gp-batch-log-step"
          >
            <span class="gp-batch-log-step-name">{{ step.name }}</span>
            <span class="gp-batch-log-step-ms">{{ step.ms }}ms</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { Icon } from "@iconify/vue"
import type { LoadProgress, LogEntry } from "../types/batchProgress"

const props = defineProps<{
  state: LoadProgress
  logEntries: LogEntry[]
  i18n: Record<string, any>
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const logExpanded = ref(false)

// 组件实例常驻（根节点 v-if 控制显隐），新一轮批量操作开始时收起上次遗留的日志区
watch(() => props.state.visible, (visible) => {
  if (visible) logExpanded.value = false
})

const progressPercent = computed(() => {
  if (props.state.total === 0) return 0
  return Math.min(100, (props.state.current / props.state.total) * 100)
})
</script>

<style lang="scss">
@use "../styles/BatchProgressBar.scss";
@use "../styles/index.scss";
</style>
