<!-- gitPush 提交分析顶部工具条（分析状态 + 条数选择 + 分析按钮 + 显示设置） -->
<template>
  <!-- 顶部工具条：分析状态 + 条数选择 + 分析按钮 -->
  <div class="gpa-toolbar">
    <!-- 分析状态："分析中…/上次分析 xx/未分析" -->
    <span class="gpa-status">{{ statusText }}</span>
    <div class="gpa-toolbar-right">
      <!-- 条数选择（tooltip："每项目 {0} 条"） -->
      <CommitCountSelect
        :i18n="i18n"
        :commit-count="commitCount"
        @update-count="emit('updateCount', $event)"
      />
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
import type { CommitCount } from "../../composables/useCommitAnalysis"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import CommitAnalysisSettings from "./CommitAnalysisSettings.vue"
import CommitCountSelect from "../common/CommitCountSelect.vue"
import { analysisStatusText } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  commitCount: CommitCount
  viewSettings: CommitAnalysisViewSettings
  /** 数据中的年份列表（供设置弹窗年份选择） */
  yearOptions: number[]
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: CommitCount]
  updateViewSettings: [patch: Partial<CommitAnalysisViewSettings>]
}>()

/** 分析状态文案（与提交规则检查工具条共用统一逻辑，notRunKey 区分未分析提示） */
const statusText = computed(() => analysisStatusText({
  analyzing: props.analyzing,
  analyzed: props.analyzed,
  analyzedAt: props.analyzedAt,
  i18n: props.i18n,
  notRunKey: "analysisNotRun",
}))
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
