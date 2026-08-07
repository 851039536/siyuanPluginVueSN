<!-- gitPush 代码统计报告：技术债务分区（按严重/高/中分组；每文件一行，展示修改/参与/行数/评分） -->
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
      <!-- 单表格容器：所有严重度分组连续排布，分组标题作为表内跨行分隔行（取代原多表格堆叠） -->
      <div class="gpr-table-wrap">
        <!-- 表头（单表头，全部分组共用）：文件 / 修改次数 / 参与人数 / 代码行数 / 风险评分 -->
        <div class="gpr-row gpr-row--head">
          <span class="gpr-cell gpr-cell--name">{{ i18n.reportFileCol }}</span>
          <span class="gpr-cell gpr-cell--num">{{ i18n.reportModsCol }}</span>
          <span class="gpr-cell gpr-cell--num">{{ i18n.reportAuthorsCol }}</span>
          <span class="gpr-cell gpr-cell--num">{{ i18n.reportLinesCol }}</span>
          <span class="gpr-cell gpr-cell--num">{{ i18n.reportScoreCol }}</span>
        </div>

        <!-- 严重度分组（仅渲染有数据的分组，groups 已过滤空分组；组内按风险分升序） -->
        <template v-for="g in groups" :key="g.sev">
          <!-- 分组标题行：严重度色点 + 名称 + 计数（跨整行，浅色底区分） -->
          <div class="gpr-row gpr-row--group">
            <span class="gpr-cell gpr-cell--group">
              <span
                class="gpr-debt-dot"
                :style="{ background: DEBT_SEVERITY_META[g.sev].color }"
              />
              <span>{{ i18n[DEBT_SEVERITY_META[g.sev].labelKey] }}</span>
              <span class="gpr-debt-count">{{ g.rows.length }}</span>
            </span>
          </div>

          <!-- 组内文件块：单行指标（悬停提示完整路径，主题色强调） -->
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
              <!-- 修改次数 / 参与人数 / 代码行数（暂无数据显示占位符 -）/ 风险评分（等宽数字） -->
              <span class="gpr-cell gpr-cell--num">{{ row.modCount }}</span>
              <span class="gpr-cell gpr-cell--num">{{ row.authorCount }}</span>
              <span class="gpr-cell gpr-cell--num">{{ fmtOrDash(row.loc) }}</span>
              <span class="gpr-cell gpr-cell--num">{{ row.riskScore }}</span>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// 技术债务分区：严重度分组文件表（每个文件=指标行+说明文案整体一块；分组行由单次过滤预计算）
import type { CodeReportData } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { DEBT_SEVERITY_META } from "../../types"
import { countDebtFiles, DEBT_SEVERITY_ORDER } from "../../reportMetrics"
import EmptyState from "../common/EmptyState.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 debtFiles / debtSummary） */
  report: CodeReportData
}>()

/** 问题总数（严重度计数合计，与面板 Tab 徽章共用 countDebtFiles） */
const totalCount = computed(() => countDebtFiles(props.report.debtSummary))

/** 按严重度预分组（严重/高/中，组内已按风险分升序排列；单次过滤替代模板中重复 filter 调用；空分组不渲染） */
const groups = computed(() =>
  DEBT_SEVERITY_ORDER.map((sev) => ({
    sev,
    rows: props.report.debtFiles.filter((r) => r.severity === sev),
  })).filter((g) => g.rows.length > 0),
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
