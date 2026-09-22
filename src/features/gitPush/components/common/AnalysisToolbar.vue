<!-- gitPush 分析类视图统一工具条（状态文案 + 视图特有控件插槽 + 运行按钮，提交分析/规则检查/行数统计共用） -->
<template>
  <Toolbar
    class="gp-analysistoolbar"
    variant="borderless"
    :padded="false"
    size="xsmall"
    :aria-label="ariaLabel"
  >
    <!-- 分析状态："分析中…/上次分析 xx/未分析" -->
    <template #start>
      <span class="gp-analysistoolbar-status">{{ statusText }}</span>
    </template>
    <template #end>
      <!-- 视图特有控件（条数选择 / 项目过滤 / 扩展名过滤等） -->
      <slot name="controls" />
      <!-- 运行按钮（loading 态由共享 Button 保宽；文案随是否已分析切换） -->
      <Button
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
// gitPush 分析类视图统一工具条：收敛提交分析 / 规则检查 / 行数统计三份同构工具条
// （状态文案逻辑本已由 utils.analysisStatusText 共享，本次把外壳、按钮与状态样式一并收敛）。
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Toolbar from "@/components/Toolbar.vue"
import type { IconKey } from "@/components/kit/icons"
import { analysisStatusText } from "../../utils"

const props = withDefaults(defineProps<{
  i18n: Record<string, any>
  /** 分析进行中 */
  running: boolean
  /** 是否已完成过至少一轮分析 */
  done: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  /** 未分析提示的 i18n 键（analysisNotRun / ruleCheckNotRun / lineStatsNotRun） */
  notRunKey: string
  /** 相对时间不可用时的兜底文案键（行数统计传 timeJustNow；不传保留空串） */
  fallbackKey?: string
  /** 运行按钮图标（受注册图标集约束） */
  icon: IconKey
  /** 运行按钮文案键（未分析态） */
  runText: string
  /** 运行按钮文案键（已分析态） */
  rerunText: string
  /** 运行按钮是否描边（行数统计为描边样式） */
  outlined?: boolean
  /** 工具条无障碍名称 */
  ariaLabel?: string
}>(), {
  outlined: false,
})

const emit = defineEmits<{
  run: []
}>()

/** 分析状态文案（统一逻辑：分析中 / 上次分析 xx / 未分析） */
const statusText = computed(() => analysisStatusText({
  analyzing: props.running,
  analyzed: props.done,
  analyzedAt: props.analyzedAt,
  i18n: props.i18n,
  notRunKey: props.notRunKey,
  fallbackKey: props.fallbackKey,
}))
</script>

<style lang="scss">
@use "../../styles/AnalysisToolbar.scss";
@use "../../styles/index.scss";
</style>
