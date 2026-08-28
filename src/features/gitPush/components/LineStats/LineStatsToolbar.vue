<!-- gitPush 行数统计顶部工具条（分析状态 + 过滤配置 + 条数选择 + 分析按钮） -->
<template>
  <!-- 顶部工具条：分析状态 + 过滤配置 + 条数选择 + 分析按钮 -->
  <div class="gls-toolbar">
    <!-- 分析状态："分析中…/上次分析 xx/未分析" -->
    <span class="gls-status">{{ analyzing ? i18n.auditing : (analyzed ? i18n.analysisLastRun.replace("{0}", relativeTime(analyzedAt, i18n) || i18n.timeJustNow) : i18n.lineStatsNotRun) }}</span>
    <div class="gls-toolbar-right">
      <!-- 文件格式过滤配置按钮（点击弹出扩展名多选弹窗；选中数徽标随选择变化） -->
      <!-- 按钮提示："文件格式过滤" -->
      <button
        class="gls-ext-btn"
        :class="{ 'gls-ext-btn--active': selectedExtensions.length > 0 }"
        :disabled="analyzing"
        :title="i18n.lineStatsExtFilter"
        @click="emit('openExtDialog')"
      >
        <Icon icon="mdi:filter-variant" />
        <span
          v-if="selectedExtensions.length > 0"
          class="gls-ext-badge"
        >{{ selectedExtensions.length }}</span>
      </button>
      <!-- 条数选择（公共组件：数字直显，"all" 显示「全部」） -->
      <CommitCountSelect
        :i18n="i18n"
        :commit-count="commitCount"
        @update-count="emit('updateCount', $event)"
      />
      <!-- 按钮文案："开始行数分析"/"重新分析"（分析中切换为环形 loading 图标并旋转，业务图标不参与旋转） -->
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm"
        :disabled="analyzing"
        @click="emit('runAnalysis')"
      >
        <Icon
          :icon="analyzing ? 'mdi:loading' : 'mdi:code-tags'"
          height="12"
          :class="{ 'gp-spin': analyzing }"
        />
        {{ analyzed ? i18n.auditRerun : i18n.lineStatsRun }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 行数统计顶部工具条（分析状态 + 过滤配置 + 条数选择 + 分析按钮）
import type { CommitCount } from "../../composables/useCommitAnalysis"
import { Icon } from "@iconify/vue"
import CommitCountSelect from "../common/CommitCountSelect.vue"
import { relativeTime } from "../../utils"

defineProps<{
  i18n: Record<string, any>
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  commitCount: CommitCount
  /** 选中的文件扩展名过滤（空数组 = 不过滤） */
  selectedExtensions: string[]
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: CommitCount]
  openExtDialog: []
}>()
</script>

<style lang="scss">
@use "../../styles/LineStatsPanel.scss";
@use "../../styles/index.scss";
</style>
