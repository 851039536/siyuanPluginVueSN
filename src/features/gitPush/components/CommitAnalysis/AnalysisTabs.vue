<!-- gitPush 提交分析三视角切换条（提交概览 / 规则检查 / 行数排行，同一份 runCore 抓取结果的三个切面） -->
<template>
  <div
    class="gpa-tabs"
    role="tablist"
  >
    <Button
      v-for="t in tabs"
      :key="t.id"
      class="gpa-tab"
      variant="ghost"
      size="xsmall"
      dense
      :icon="t.icon"
      :aria-pressed="modelValue === t.id"
      :aria-controls="`gpa-tabpanel-${t.id}`"
      :title="i18n[t.hintKey]"
      @click="modelValue = t.id"
    >
      {{ i18n[t.labelKey] }}
      <span
        v-if="t.count > 0"
        class="gpa-tab-count"
      >{{ t.count }}</span>
    </Button>
  </div>
</template>

<script setup lang="ts">
// 提交分析三视角切换条：三个视图共用同一次 runCore 抓取（entries 供概览/规则检查，numstat 供行数排行），
// 原先各自占一个顶部入口，会让人误以为要分别"开始分析"三次；收敛为 Tab 后运行语义只保留一个。
import type { IconKey } from "@/components/kit/icons"
import { computed } from "vue"
import Button from "@/components/Button.vue"

/** 分析视角 id（与 CommitAnalysis/index.vue 的 activeTab 严格对齐） */
export type AnalysisTabId = "overview" | "rulecheck" | "linestats"

const props = defineProps<{
  i18n: Record<string, any>
  /** 各视角的内容计数（仅 > 0 时显示为角标） */
  counts: Record<AnalysisTabId, number>
}>()

const modelValue = defineModel<AnalysisTabId>({ required: true })

/** Tab 配置（icon 受已注册 IconKey 约束：概览/规则检查/行数排行） */
const tabs = computed<ReadonlyArray<{ id: AnalysisTabId, labelKey: string, hintKey: string, icon: IconKey, count: number }>>(() => [
  { id: "overview", labelKey: "analysisTabOverview", hintKey: "analysisTabOverviewHint", icon: "chartTimelineVariant", count: props.counts.overview },
  { id: "rulecheck", labelKey: "analysisTabRuleCheck", hintKey: "ruleCheckView", icon: "clipboardCheckOutline", count: props.counts.rulecheck },
  { id: "linestats", labelKey: "analysisTabLineStats", hintKey: "lineStatsView", icon: "codeTags", count: props.counts.linestats },
])
</script>

<style lang="scss">
@use "../../styles/AnalysisTabs.scss";
@use "../../styles/index.scss";
</style>
