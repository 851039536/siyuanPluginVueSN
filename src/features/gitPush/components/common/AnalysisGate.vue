<!-- gitPush 分析类视图状态门（首次分析中占位 / 未分析提示 / 失败提示，四个分析视图共用） -->
<template>
  <!-- 首次分析中：Loader + 文案（gp-loading 由共享基座提供受限定位容器） -->
  <div
    v-if="running && !done"
    class="gp-loading"
  >
    <Loader />
    <span class="gp-loading-text">{{ runningText }}</span>
  </div>

  <!-- 未分析提示 -->
  <EmptyState
    v-else-if="!done"
    :icon="icon"
    :text="notRunText"
  />

  <template v-else>
    <!-- 失败提示（可选：failedCount > 0 时展示；action 槽承载视图特有的明细入口） -->
    <div
      v-if="failedCount > 0"
      class="gp-analysishint"
    >
      <span>{{ failText }}</span>
      <slot name="failAction" />
    </div>
    <slot />
  </template>
</template>

<script setup lang="ts">
// gitPush 分析类视图状态门：把「分析中占位 / 未分析空态 / 失败提示 / 已就绪内容」四态收敛为一处，
// 消除提交分析、行数统计、规则检查、代码报告四个视图逐字重复的 v-if/v-else-if 骨架。
import Loader from "@/components/Loader.vue"
import EmptyState from "./EmptyState.vue"

withDefaults(defineProps<{
  /** 分析进行中 */
  running: boolean
  /** 是否已完成过至少一轮分析 */
  done: boolean
  /** 未分析提示文案（已渲染的 i18n 文本） */
  notRunText: string
  /** 未分析空态图标 */
  icon: string
  /** 分析中占位文案（默认取 i18n.auditing，由调用方传入） */
  runningText: string
  /** 失败项目数（> 0 时展示失败提示；0 不渲染） */
  failedCount?: number
  /** 失败提示文案（已渲染的 i18n 文本，含计数） */
  failText?: string
}>(), {
  failedCount: 0,
  failText: "",
})
</script>

<style lang="scss">
@use "../../styles/AnalysisGate.scss";
@use "../../styles/index.scss";
</style>
