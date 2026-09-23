<!-- gitPush 提交规则检查违规类型分布区块（紧凑 chips：标题与计数圆片同行折行，替代条形图省空间） -->
<template>
  <div
    v-if="stats.byReason.length > 0"
    class="grc-reason-row"
  >
    <!-- 区块标题："违规类型分布" -->
    <span class="grc-reason-title">{{ i18n.ruleCheckReasonTitle }}</span>
    <!-- 原因计数圆片（stats.byReason 已按数量降序；悬停显示该规则的判定说明与改法） -->
    <span
      v-for="row in stats.byReason"
      :key="row.reason"
      class="grc-reason-chip"
      :title="ruleReasonDesc(row.reason, i18n)"
    >
      {{ ruleReasonText(row.reason, i18n) }}
      <span class="grc-reason-chip-num">{{ row.count }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交规则检查违规类型分布区块（紧凑 chips：标题与计数圆片同行折行）
// 文案经 utils 的 ruleReasonText / ruleReasonDesc 解析（元数据只存 i18n 键，与违规列表/修正弹窗/工作区共用同一口径）
import type { CommitRuleCheckStats } from "../../types"
import { ruleReasonDesc, ruleReasonText } from "../../utils"

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
