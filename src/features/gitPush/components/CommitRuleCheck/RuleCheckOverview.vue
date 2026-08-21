<!-- gitPush 提交规则检查总览区块（检查数/不合规/合规率卡片 + 规则提示） -->
<template>
  <div>
    <!-- 总览卡片 -->
    <div class="grc-cards">
      <div class="grc-card">
        <div class="grc-card-value">{{ stats.totalCommits }}</div>
        <!-- 卡片标签："检查提交数" -->
        <div class="grc-card-label">{{ i18n.ruleCheckTotal }}</div>
      </div>
      <div class="grc-card">
        <div class="grc-card-value grc-card-value--danger">{{ stats.violationCount }}</div>
        <!-- 卡片标签："不合规提交" -->
        <div class="grc-card-label">{{ i18n.ruleCheckViolations }}</div>
      </div>
      <div class="grc-card">
        <div class="grc-card-value">{{ complianceRate }}%</div>
        <!-- 卡片标签："合规率" -->
        <div class="grc-card-label">{{ i18n.ruleCheckCompliant }}</div>
      </div>
    </div>

    <!-- 规则提示 -->
    <div class="grc-hint">
      {{ i18n.ruleCheckHint.replace("{0}", COMMIT_TYPE_VALUES.join(" / ")) }}
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查总览区块（检查数/不合规/合规率卡片 + 规则提示）
import type { CommitRuleCheckStats } from "../../types"
import { computed } from "vue"
import { COMMIT_TYPE_VALUES } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  /** 规则检查聚合视图（取 totalCommits/violationCount/compliantCount） */
  stats: CommitRuleCheckStats
}>()

/** 合规率（保留 1 位小数；0 提交时视为 100%） */
const complianceRate = computed(() => {
  if (props.stats.totalCommits === 0) return 100
  return Number(((props.stats.compliantCount / props.stats.totalCommits) * 100).toFixed(1))
})
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
