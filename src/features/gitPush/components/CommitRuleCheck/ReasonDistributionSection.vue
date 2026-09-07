<!-- gitPush 提交规则检查违规类型分布区块（紧凑 chips：标题与计数圆片同行折行，替代条形图省空间） -->
<template>
  <div
    v-if="stats.byReason.length > 0"
    class="grc-reason-row"
  >
    <!-- 区块标题："违规类型分布" -->
    <span class="grc-reason-title">{{ i18n.ruleCheckReasonTitle }}</span>
    <!-- 原因计数圆片（stats.byReason 已按数量降序） -->
    <span
      v-for="row in stats.byReason"
      :key="row.reason"
      class="grc-reason-chip"
    >
      {{ i18n[COMMIT_RULE_REASON_META[row.reason].labelKey] }}
      <span class="grc-reason-chip-num">{{ row.count }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查违规类型分布区块（紧凑 chips：标题与计数圆片同行折行）
import type { CommitRuleCheckStats } from "../../types"
import { COMMIT_RULE_REASON_META } from "../../types"

defineProps<{
  i18n: Record<string, any>
  /** 规则检查聚合视图（取 byReason，已按数量降序） */
  stats: CommitRuleCheckStats
}>()
</script>

<style lang="scss">
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/index.scss";
</style>
