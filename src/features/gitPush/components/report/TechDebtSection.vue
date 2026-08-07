<!-- gitPush 代码统计报告：技术债务分区（按严重/高/中分组，组内按风险分排序的文件债务表） -->
<template>
  <div class="gpr-section">
    <!-- 区块标题："技术债务" + 问题总数徽章 -->
    <div class="gpr-section-title">
      {{ i18n.reportDebtTitle }}
      <span class="gpr-section-count">{{ totalCount }}</span>
    </div>

    <!-- 空状态：范围内无债务问题 -->
    <EmptyState
      v-if="totalCount === 0"
      icon="mdi:alert-octagon-outline"
      :text="i18n.reportNoDebt"
    />

    <template v-else>
      <!-- 严重度分组（严重/高/中；组内已按风险分升序排序） -->
      <div
        v-for="sev in DEBT_SEVERITY_ORDER"
        :key="sev"
        class="gpr-debt-group"
      >
        <!-- 分组标题：严重度名 + 计数 -->
        <div class="gpr-debt-group-title">
          <span
            class="gpr-debt-dot"
            :style="{ background: DEBT_SEVERITY_META[sev].color }"
          />
          <span>{{ i18n[DEBT_SEVERITY_META[sev].labelKey] }}</span>
          <span class="gpr-debt-count">{{ groupRows(sev).length }}</span>
        </div>

        <!-- 该组文件行（表头 + 数据行） -->
        <div class="gpr-table-wrap">
          <div class="gpr-row gpr-row--head">
            <span class="gpr-cell gpr-cell--name">{{ i18n.reportFileCol }}</span>
            <span class="gpr-cell gpr-cell--type">{{ i18n.reportTypeCol }}</span>
            <span class="gpr-cell gpr-cell--num">{{ i18n.reportScoreCol }}</span>
            <span class="gpr-cell gpr-cell--num">{{ i18n.reportModsCol }}</span>
            <span class="gpr-cell gpr-cell--num">{{ i18n.reportComplexityCol }}</span>
            <span class="gpr-cell gpr-cell--num">{{ i18n.reportLinesCol }}</span>
            <span class="gpr-cell gpr-cell--num">{{ i18n.reportStabilityCol }}</span>
          </div>
          <div
            v-for="row in groupRows(sev)"
            :key="row.path"
            class="gpr-row gpr-row--debt"
          >
            <!-- 文件路径（悬停提示完整路径，主题色强调） -->
            <span
              class="gpr-cell gpr-cell--name gpr-cell--file"
              :title="row.path"
            >
              <Icon
                icon="mdi:file-document-outline"
                height="12"
                class="gpr-file-icon"
              />
              {{ row.path }}
            </span>
            <!-- 问题类型徽章 -->
            <span class="gpr-cell gpr-cell--type">
              <span class="gpr-type-chip">{{ i18n[DEBT_TYPE_META[row.debtType].labelKey] }}</span>
            </span>
            <!-- 风险评分（等宽数字） -->
            <span class="gpr-cell gpr-cell--num">{{ row.riskScore }}</span>
            <!-- 修改次数 / 复杂度 / 代码行数 / 稳定性（暂无数据显示占位符 -） -->
            <span class="gpr-cell gpr-cell--num">{{ row.modCount }}</span>
            <span class="gpr-cell gpr-cell--num">{{ fmtOrDash(row.complexity) }}</span>
            <span class="gpr-cell gpr-cell--num">{{ fmtOrDash(row.loc) }}</span>
            <span class="gpr-cell gpr-cell--num">{{ fmtOrDash(row.stability) }}</span>
          </div>
          <!-- 说明文案行（拼接模板："此文件在过去6个月被修改了 X 次…"） -->
          <div
            v-for="row in groupRows(sev)"
            :key="`${row.path}-desc`"
            class="gpr-row gpr-row--desc"
          >
            <span class="gpr-cell gpr-cell--desc">{{ row.description }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// 技术债务分区：严重度分组文件表（技术指标列 + 模板说明文案）
import type { CodeReportData, DebtFileRow, DebtSeverity } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { DEBT_SEVERITY_META, DEBT_TYPE_META } from "../../types"
import { DEBT_SEVERITY_ORDER } from "../../reportMetrics"
import EmptyState from "../common/EmptyState.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 debtFiles / debtSummary） */
  report: CodeReportData
}>()

/** 问题总数（严重度计数合计，无数据分组为 0） */
const totalCount = computed(() =>
  DEBT_SEVERITY_ORDER.reduce((sum, s) => sum + (props.report.debtSummary[s] || 0), 0),
)

/** 按严重度取组内文件行（已按风险分升序排列） */
function groupRows(sev: DebtSeverity): DebtFileRow[] {
  return props.report.debtFiles.filter((r) => r.severity === sev)
}

/** 数值格式化：null/undefined 显示占位符 -（与参考报告"暂无数据"一致） */
function fmtOrDash(v: number | null | undefined): string {
  return v === null || v === undefined ? "-" : String(v)
}
</script>

<style lang="scss">
@use "../../styles/TechDebtSection.scss";
@use "../../styles/index.scss";
</style>
