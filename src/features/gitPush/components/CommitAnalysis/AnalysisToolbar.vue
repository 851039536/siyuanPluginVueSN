<!-- gitPush 提交分析顶部工具条（分析状态 + 条数选择 + 分析按钮 + 显示设置） -->
<template>
  <!-- 顶部工具条：分析状态 + 条数选择 + 分析按钮 -->
  <div class="gpa-toolbar">
    <!-- 分析状态："分析中…/上次分析 xx/未分析" -->
    <span class="gpa-status">{{ analyzing ? i18n.auditing : (analyzed ? i18n.analysisLastRun.replace("{0}", relativeTime(analyzedAt, i18n)) : i18n.analysisNotRun) }}</span>
    <div class="gpa-toolbar-right">
      <!-- 条数选择（tooltip："每项目 {0} 条"） -->
      <select
        class="gpa-count-select"
        :value="commitCount"
        :title="i18n.analysisCommitsPerProject.replace('{0}', String(commitCount))"
        @change="onCountChange"
      >
        <option
          v-for="n in COMMIT_COUNT_OPTIONS"
          :key="n"
          :value="n"
        >{{ n }}</option>
      </select>
      <!-- 按钮文案："开始分析"/"重新分析"（分析中切换为环形 loading 图标并旋转，业务图标不参与旋转） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :disabled="analyzing"
        @click="emit('runAnalysis')"
      >
        <Icon
          :icon="analyzing ? 'mdi:loading' : 'mdi:chart-timeline-variant'"
          height="12"
          :class="{ 'gp-spin': analyzing }"
        />
        {{ analyzed ? i18n.auditRerun : i18n.auditRun }}
      </button>
      <!-- 显示设置菜单 -->
      <CommitAnalysisSettings
        :i18n="i18n"
        :view-settings="viewSettings"
        :years="yearOptions"
        @update="emit('updateViewSettings', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析顶部工具条（分析状态 + 条数选择 + 分析按钮 + 显示设置）
import type { CommitAnalysisViewSettings } from "../../types"
import { Icon } from "@iconify/vue"
import { COMMIT_COUNT_OPTIONS } from "../../composables/useCommitAnalysis"
import { relativeTime } from "../../utils"
import CommitAnalysisSettings from "./CommitAnalysisSettings.vue"

const props = defineProps<{
  i18n: Record<string, any>
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  commitCount: number
  viewSettings: CommitAnalysisViewSettings
  /** 数据中的年份列表（供设置弹窗年份选择） */
  yearOptions: number[]
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: number]
  updateViewSettings: [patch: Partial<CommitAnalysisViewSettings>]
}>()

function onCountChange(e: Event) {
  emit("updateCount", Number((e.target as HTMLSelectElement).value))
}
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
