<!-- gitPush 行数统计顶部汇总卡片（总新增 / 总删除 / 总净增 / 当前总行数） -->
<template>
  <!-- 顶部汇总卡片：总新增 / 总删除 / 总净增（总净增随正负变色） -->
  <div class="gls-cards">
    <!-- 卡片：总新增（绿色） -->
    <div class="gls-card">
      <div class="gls-card-value gls-card-value--add">{{ summary.added.toLocaleString() }}</div>
      <div class="gls-card-label">{{ i18n.lineStatsTotalAdded }}</div>
    </div>
    <!-- 卡片：总删除（红色） -->
    <div class="gls-card">
      <div class="gls-card-value gls-card-value--del">{{ summary.deleted.toLocaleString() }}</div>
      <div class="gls-card-label">{{ i18n.lineStatsTotalDeleted }}</div>
    </div>
    <!-- 卡片：总净增（正绿负红，与行内净增语义一致） -->
    <div class="gls-card">
      <div
        class="gls-card-value"
        :class="netClass(summary.net)"
      >{{ summary.net.toLocaleString() }}</div>
      <div class="gls-card-label">{{ i18n.lineStatsTotalNet }}</div>
    </div>
    <!-- 卡片：当前总行数（存量，中性色，tooltip 说明与增量指标的区别） -->
    <div class="gls-card">
      <div
        class="gls-card-value gls-card-value--total"
        :title="i18n.lineStatsTotalHint"
      >{{ summary.totalLines.toLocaleString() }}</div>
      <div class="gls-card-label">{{ i18n.lineStatsTotalLines }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 行数统计顶部汇总卡片（总新增/总删除/总净增/当前总行数）
import type { LineStatsSummary } from "../../types"
import { netClass as sharedNetClass } from "../../utils"

defineProps<{
  i18n: Record<string, any>
  /** 全量行数合计（基于全量项目数据独立累加） */
  summary: LineStatsSummary
}>()

/** 净增行语义色（薄委托共享 netClass，前缀 gls-net，保持模板调用点零改动） */
function netClass(net: number): string {
  return sharedNetClass(net, "gls-net")
}
</script>

<style lang="scss">
@use "../../styles/LineStatsPanel.scss";
@use "../../styles/index.scss";
</style>
