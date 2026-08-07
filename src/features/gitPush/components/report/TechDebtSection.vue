<!-- gitPush 代码统计报告：技术债务分区（按严重/高/中分组；每个文件=指标行+说明文案整体一块） -->
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
      <!-- 严重度分组（严重/高/中；组内已按风险分升序排列，groups 由单次过滤预计算） -->
      <div
        v-for="g in groups"
        :key="g.sev"
        class="gpr-debt-group"
      >
        <!-- 分组标题：严重度色点 + 名称 + 计数 -->
        <div class="gpr-debt-group-title">
          <span
            class="gpr-debt-dot"
            :style="{ background: DEBT_SEVERITY_META[g.sev].color }"
          />
          <span>{{ i18n[DEBT_SEVERITY_META[g.sev].labelKey] }}</span>
          <span class="gpr-debt-count">{{ g.rows.length }}</span>
        </div>

        <!-- 该组文件表：表头 + 每文件一块（指标行 + 说明文案紧跟其下） -->
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
            v-for="row in g.rows"
            :key="row.path"
            class="gpr-debt-file"
          >
            <!-- 文件指标行（悬停提示完整路径，主题色强调） -->
            <div class="gpr-row">
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
            <!-- 说明文案行（紧跟文件指标行："此文件在过去6个月被修改了 X 次…"） -->
            <div
              v-if="row.description"
              class="gpr-row gpr-row--desc"
            >
              <span class="gpr-cell gpr-cell--desc">{{ row.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// 技术债务分区：严重度分组文件表（每个文件=指标行+说明文案整体一块；分组行由单次过滤预计算）
import type { CodeReportData } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { DEBT_SEVERITY_META, DEBT_TYPE_META } from "../../types"
import { countDebtFiles, DEBT_SEVERITY_ORDER } from "../../reportMetrics"
import EmptyState from "../common/EmptyState.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 debtFiles / debtSummary） */
  report: CodeReportData
}>()

/** 问题总数（严重度计数合计，与面板 Tab 徽章共用 countDebtFiles） */
const totalCount = computed(() => countDebtFiles(props.report.debtSummary))

/** 按严重度预分组（严重/高/中，组内已按风险分升序排列；单次过滤替代模板中重复 filter 调用） */
const groups = computed(() =>
  DEBT_SEVERITY_ORDER.map((sev) => ({
    sev,
    rows: props.report.debtFiles.filter((r) => r.severity === sev),
  })),
)

/** 数值格式化：null/undefined 显示占位符 -（与参考报告"暂无数据"一致） */
function fmtOrDash(v: number | null | undefined): string {
  return v === null || v === undefined ? "-" : String(v)
}
</script>

<style lang="scss">
@use "../../styles/TechDebtSection.scss";
@use "../../styles/index.scss";
</style>
