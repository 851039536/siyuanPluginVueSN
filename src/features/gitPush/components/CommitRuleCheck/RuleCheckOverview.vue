<!-- gitPush 提交规则检查总览区块（检查数/不合规/合规率卡片 + 规则提示） -->
<template>
  <div>
    <!-- 总览卡片（共享 KPI 卡片网格，三列等分） -->
    <StatCardGrid
      :min-width="90"
      :cards="overviewCards"
    />

    <!-- 规则提示（基础规则 + 当前启用的可选规则，随设置变化） -->
    <div class="grc-hint">
      {{ hintText }}
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查总览区块（检查数/不合规/合规率卡片 + 规则提示）
import type { CommitRuleCheckStats, CommitRuleConfig } from "../../types"
import type { StatCardItem } from "../common/StatCardGrid.vue"
import { computed } from "vue"
import { COMMIT_TYPE_VALUES } from "../../types"
import StatCardGrid from "../common/StatCardGrid.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 规则检查聚合视图（取 totalCommits/violationCount/compliantCount） */
  stats: CommitRuleCheckStats
  /** 当前规则配置（用于提示文案随可选规则开关变化） */
  ruleConfig: CommitRuleConfig
}>()

/** 合规率（保留 1 位小数；totalCommits 已排除 merge，空集时按 0 处理） */
const complianceRate = computed(() => {
  const total = props.stats.totalCommits
  if (total <= 0) return 0
  return Number(((props.stats.compliantCount / total) * 100).toFixed(1))
})

/** 总览卡片：检查提交数 / 不合规提交（错误色） / 合规率 */
const overviewCards = computed<StatCardItem[]>(() => [
  { key: "total", value: props.stats.totalCommits, label: props.i18n.ruleCheckTotal },
  { key: "violations", value: props.stats.violationCount, label: props.i18n.ruleCheckViolations, cls: "gp-statgrid-card--danger" },
  { key: "rate", value: `${complianceRate.value}%`, label: props.i18n.ruleCheckCompliant },
])

/**
 * 规则提示文案：基础规则（type/中文/句号/最短字数/scope 条件/正文空行）+ 当前启用的可选规则。
 * 可选规则按配置动态拼接，避免提示与设置不一致。
 */
const hintText = computed(() => {
  const base = String(props.i18n.ruleCheckHint || "")
    .replace("{0}", COMMIT_TYPE_VALUES.join(" / "))
    .replace("{1}", String(props.ruleConfig.minSubjectLength))
  const enabled = [
    props.ruleConfig.requireCapitalizedSubject ? props.i18n.ruleCheckOptCapitalized : "",
    props.ruleConfig.detectWipSubject ? props.i18n.ruleCheckOptWip : "",
    props.ruleConfig.scopeFormatEnabled ? props.i18n.ruleCheckOptScopeFormat : "",
    props.ruleConfig.bodyLineLimitEnabled ? props.i18n.ruleCheckOptBodyLineLimit : "",
  ].filter(Boolean)
  if (enabled.length === 0) return base
  const separator = String(props.i18n.ruleCheckHintSeparator || "、")
  return `${base}${String(props.i18n.ruleCheckHintOptional || "").replace("{0}", enabled.join(separator))}`
})
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
