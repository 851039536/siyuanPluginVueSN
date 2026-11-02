<!-- gitPush 分析/统计类视图统一工具条（状态文案 + 视图特有控件插槽 + 可选运行按钮） -->
<template>
  <Toolbar
    class="gp-analysistoolbar"
    variant="borderless"
    :padded="false"
    size="xsmall"
    :aria-label="ariaLabel"
  >
    <!-- 视图状态："分析中…/上次分析 xx/未分析" 或统计页的快照状态 -->
    <template #start>
      <span class="gp-analysistoolbar-status">{{ resolvedStatusText }}</span>
    </template>
    <template #end>
      <!-- 视图特有控件（条数选择 / 项目过滤 / 扩展名过滤 / 刷新等） -->
      <slot name="controls" />
      <!-- 运行按钮（统计页无“分析”动作 → showRun=false 不渲染；loading 态由共享 Button 保宽） -->
      <Button
        v-if="showRun"
        variant="ghost"
        :outlined="outlined"
        size="xsmall"
        :icon="running ? 'loading' : icon"
        :loading="running"
        :disabled="running"
        @click="emit('run')"
      >
        {{ done ? rerunText : runText }}
      </Button>
    </template>
  </Toolbar>
</template>

<script setup lang="ts">
// 分析/统计类视图统一工具条：收敛提交分析 / 规则检查 / 行数统计三份同构工具条，
// 统计视图复用同一外壳（直接给 statusText + showRun=false，控件槽放刷新按钮）。
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Toolbar from "@/components/Toolbar.vue"
import type { IconKey } from "@/components/kit/icons"
import { analysisStatusText } from "../../utils"

const props = withDefaults(defineProps<{
  i18n: Record<string, any>
  /** 分析进行中 */
  running?: boolean
  /** 是否已完成过至少一轮分析 */
  done?: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt?: string
  /** 直接给出状态文案（统计页等非“分析”语义视图）；提供时忽略 running/done/analyzedAt/notRunKey */
  statusText?: string
  /** 未分析提示的 i18n 键（analysisNotRun / ruleCheckNotRun / lineStatsNotRun） */
  notRunKey?: string
  /** 相对时间不可用时的兜底文案键（行数统计传 timeJustNow；不传保留空串） */
  fallbackKey?: string
  /** 是否渲染运行按钮（统计页只有刷新动作 → false） */
  showRun?: boolean
  /** 运行按钮图标（受注册图标集约束） */
  icon?: IconKey
  /** 运行按钮文案（未分析态，已渲染的 i18n 文本） */
  runText?: string
  /** 运行按钮文案（已分析态，已渲染的 i18n 文本） */
  rerunText?: string
  /** 运行按钮是否描边（行数统计为描边样式） */
  outlined?: boolean
  /** 工具条无障碍名称 */
  ariaLabel?: string
}>(), {
  running: false,
  done: false,
  analyzedAt: "",
  statusText: "",
  notRunKey: "",
  showRun: true,
  outlined: false,
})

const emit = defineEmits<{
  run: []
}>()

/** 状态文案：调用方直接给出时优先，否则走统一的三态收敛逻辑 */
const resolvedStatusText = computed(() => {
  if (props.statusText) return props.statusText
  return analysisStatusText({
    analyzing: props.running,
    analyzed: props.done,
    analyzedAt: props.analyzedAt,
    i18n: props.i18n,
    notRunKey: props.notRunKey,
    fallbackKey: props.fallbackKey,
  })
})
</script>

<style lang="scss">
@use "../../styles/AnalysisToolbar.scss";
@use "../../styles/index.scss";
</style>
