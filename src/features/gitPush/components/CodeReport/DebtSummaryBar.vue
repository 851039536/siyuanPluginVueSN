<!-- gitPush 技术债务汇总条：严重度分布堆叠条 + 占比图例 + Top3 优先治理清单 -->
<template>
  <div class="gpr-debt-summary">
    <!-- 严重度分布区块：堆叠条 + 图例 -->
    <div class="gpr-debt-dist-block">
      <!-- 区块标签："严重度分布" -->
      <div class="gpr-debt-block-label">{{ i18n.reportDebtDistTitle }}</div>
      <!-- 堆叠条（每段宽度 = 占比，颜色 = 严重度色；无数据时隐藏） -->
      <div
        v-if="dist.length > 0"
        class="gpr-debt-dist-bar"
      >
        <span
          v-for="d in dist"
          :key="d.severity"
          class="gpr-debt-dist-seg"
          :style="{ width: `${d.pct}%`, background: DEBT_SEVERITY_META[d.severity].color }"
          :title="`${i18n[DEBT_SEVERITY_META[d.severity].labelKey]} ${d.count} (${d.pct}%)`"
        />
      </div>
      <!-- 图例（仅渲染有数据的严重度项） -->
      <div
        v-if="dist.length > 0"
        class="gpr-debt-dist-legend"
      >
        <span
          v-for="d in dist"
          :key="d.severity"
          class="gpr-debt-dist-legend-item"
        >
          <span
            class="gpr-debt-dist-dot"
            :style="{ background: DEBT_SEVERITY_META[d.severity].color }"
          />
          {{ i18n[DEBT_SEVERITY_META[d.severity].labelKey] }}
          <span class="gpr-debt-dist-num">{{ d.count }} ({{ d.pct }}%)</span>
        </span>
      </div>
    </div>

    <!-- Top3 优先治理区块 -->
    <div
      v-if="top.length > 0"
      class="gpr-debt-top-block"
    >
      <!-- 区块标签："优先治理" + 提示文案 -->
      <div class="gpr-debt-block-label">
        {{ i18n.reportDebtTopTitle }}
        <span class="gpr-debt-block-hint">{{ i18n.reportDebtTopHint }}</span>
      </div>
      <div class="gpr-debt-top-list">
        <div
          v-for="(t, idx) in top"
          :key="t.path"
          class="gpr-debt-top-item"
          :title="t.path"
        >
          <span class="gpr-debt-top-rank">{{ idx + 1 }}</span>
          <span class="gpr-debt-top-path">{{ t.path }}</span>
          <span class="gpr-debt-top-score">{{ t.riskScore }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 技术债务汇总条：严重度分布 + Top3 治理清单（纯展示组件，数据由 deriveDebtInsights 传入）
import type { DebtFileRow } from "../../types"
import { computed } from "vue"
import { DEBT_SEVERITY_META } from "../../types"
import { buildSeverityDist, buildTopDebts } from "../../debtInsights"

const props = defineProps<{
  i18n: Record<string, any>
  /** 债务文件全量列表（汇总条内部派生产出分布与 Top 清单，保持单一数据源） */
  files: DebtFileRow[]
}>()

/** 严重度分布（仅含非空严重度项；computed 保证报告重生成后自动更新） */
const dist = computed(() => buildSeverityDist(props.files))

/** Top3 优先治理清单（按风险分降序；computed 保证报告重生成后自动更新） */
const top = computed(() => buildTopDebts(props.files))
</script>

<style lang="scss">
@use "../../styles/DebtSummaryBar.scss";
@use "../../styles/index.scss";
</style>
