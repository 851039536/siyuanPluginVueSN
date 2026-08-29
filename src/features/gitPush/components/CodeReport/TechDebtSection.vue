<!-- gitPush 技术债务分区：汇总条（严重度分布+Top3治理）+ 严重度分组表（趋势徽章+最后修改+可展开详情） -->
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
      <!-- 汇总条：严重度分布堆叠条 + Top3 优先治理清单 -->
      <DebtSummaryBar
        :i18n="i18n"
        :files="report.debtFiles"
      />

      <!-- 单表格容器：所有严重度分组连续排布，分组标题作为表内跨行分隔行 -->
      <div class="gpr-table-wrap">
        <!-- 表头：文件（含趋势徽章）/ 修改次数 / 参与人数 / 风险评分 / 最后修改 -->
        <div class="gpr-row gpr-row--head">
          <span class="gpr-cell gpr-cell--name">{{ i18n.reportFileCol }}</span>
          <span class="gpr-cell gpr-cell--num">{{ i18n.reportModsCol }}</span>
          <span class="gpr-cell gpr-cell--num">{{ i18n.reportAuthorsCol }}</span>
          <span class="gpr-cell gpr-cell--num">{{ i18n.reportScoreCol }}</span>
          <span class="gpr-cell gpr-cell--date">{{ i18n.reportLastModifiedCol }}</span>
        </div>

        <!-- 严重度分组（仅渲染有数据的分组；组内按风险分降序） -->
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

          <!-- 组内文件块：整行可点击展开详情（手风琴模式，同时只展开一个） -->
          <div
            v-for="row in g.rows"
            :key="row.path"
            class="gpr-debt-file"
            :class="{ 'gpr-debt-file--open': expandedPath === row.path }"
          >
            <!-- 文件指标行（点击切换展开；悬停提示完整路径，主题色强调） -->
            <div
              class="gpr-row gpr-debt-row"
              :title="i18n.reportDebtExpandHint"
              @click="toggleExpand(row.path)"
            >
              <span class="gpr-cell gpr-cell--name gpr-cell--file">
                <Icon
                  icon="mdi:file-document-outline"
                  height="12"
                  class="gpr-file-icon"
                />
                <!-- 文件路径（单行省略，完整路径悬停可见） -->
                <span
                  class="gpr-debt-path"
                  :title="row.path"
                >{{ row.path }}</span>
                <!-- 趋势徽章（箭头 + 方向文案，样式与文案由 groups 预计算，避免逐行重复推断） -->
                <span
                  class="gpr-debt-trend-chip"
                  :style="row.trendStyle"
                >{{ row.trendText }}</span>
                <!-- 展开箭头（展开时旋转） -->
                <Icon
                  icon="mdi:chevron-down"
                  height="12"
                  class="gpr-debt-expand-icon"
                  :class="{ open: expandedPath === row.path }"
                />
              </span>
              <!-- 修改次数 / 参与人数 / 风险评分（等宽数字） -->
              <span class="gpr-cell gpr-cell--num">{{ row.modCount }}</span>
              <span class="gpr-cell gpr-cell--num">{{ row.authorCount }}</span>
              <span class="gpr-cell gpr-cell--num">{{ row.riskScore }}</span>
              <!-- 最后修改时间（相对时间预计算，完整 ISO 悬停可见） -->
              <span
                class="gpr-cell gpr-cell--date"
                :title="row.lastModified"
              >{{ row.lastModifiedText }}</span>
            </div>

            <!-- 展开详情面板：LOC 懒加载 + 趋势解释 + 近期共变文件 -->
            <DebtFileDetail
              v-if="expandedPath === row.path"
              :i18n="i18n"
              :project="project"
              :row="row"
              :trend="row.trend"
              :coupled="coupledIndex.get(row.path)"
            />
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// 技术债务分区：汇总条 + 严重度分组可展开表（趋势徽章/最后修改/详情懒加载；手风琴展开）
import type { CodeReportData, DebtFileRow, DebtSeverity, GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, ref, watch } from "vue"
import { DEBT_SEVERITY_META, DEBT_SEVERITY_ORDER } from "../../types"
import { countDebtFiles } from "../../reportMetrics"
import { createCoupledIndex, DEBT_TREND_META, inferDebtTrend } from "../../debtInsights"
import type { DebtTrend } from "../../debtInsights"
import { relativeTime } from "../../utils"
import EmptyState from "../common/EmptyState.vue"
import DebtSummaryBar from "./DebtSummaryBar.vue"
import DebtFileDetail from "./DebtFileDetail.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 报告聚合数据（仅读取 debtFiles / debtSummary） */
  report: CodeReportData
  /** 当前项目实例（详情面板 LOC 懒加载需要；可为 null 表示无项目） */
  project: GitProject | null
}>()

/** 问题总数（严重度计数合计，与面板 Tab 徽章共用 countDebtFiles） */
const totalCount = computed(() => countDebtFiles(props.report.debtSummary))

/** 分组内的展示行（DebtFileRow + 预计算的派生展示字段） */
interface DebtGroupRow extends DebtFileRow {
  /** 趋势方向（详情面板复用，避免二次推断） */
  trend: DebtTrend
  /** 趋势徽章内联样式（对象引用稳定，避免父组件重渲染时逐行 patch style） */
  trendStyle: Record<string, string>
  /** 趋势徽章文案（箭头 + 方向短文案） */
  trendText: string
  /** 最后修改的相对时间文案（无日期时为 "-"） */
  lastModifiedText: string
}

/** 按严重度预分组（单次遍历分桶替代逐严重度 filter；组内保持父级已排序的风险分降序；空分组不渲染） */
const groups = computed<Array<{ sev: DebtSeverity, rows: DebtGroupRow[] }>>(() => {
  const buckets = new Map<DebtSeverity, DebtFileRow[]>()
  for (const r of props.report.debtFiles) {
    const list = buckets.get(r.severity)
    if (list) list.push(r)
    else buckets.set(r.severity, [r])
  }
  return DEBT_SEVERITY_ORDER
    .map((sev) => ({
      sev,
      // 趋势/相对时间一次性预计算：模板只读字段，不调函数，
      // 消除每行每次渲染的 Date.parse 与新 style 对象分配
      rows: (buckets.get(sev) ?? []).map((row) => {
        const trend = inferDebtTrend(row)
        const meta = DEBT_TREND_META[trend]
        return {
          ...row,
          trend,
          trendStyle: { borderColor: meta.color, color: meta.color },
          trendText: `${meta.arrow} ${props.i18n[meta.labelKey]}`,
          lastModifiedText: row.lastModified ? relativeTime(row.lastModified, props.i18n) : "-",
        }
      }),
    }))
    .filter((g) => g.rows.length > 0)
})

/** 当前展开的文件路径（手风琴模式：同时只展开一个；重复点击收起） */
const expandedPath = ref<string>("")

// 报告重新生成（切换项目/时间范围）后收起展开行，避免残留指向上一份报告的路径
watch(() => props.report, () => {
  expandedPath.value = ""
})

/** 按日期聚类的共变索引（O(n) 建索引；展开行时按需取该文件的共变列表，避免全量预计算） */
const coupledIndex = computed(() => createCoupledIndex(props.report.debtFiles))

/** 切换行展开态（手风琴：展开其他行时自动收起当前行） */
function toggleExpand(path: string) {
  expandedPath.value = expandedPath.value === path ? "" : path
}
</script>

<style lang="scss">
@use "../../styles/TechDebtSection.scss";
@use "../../styles/index.scss";
</style>
