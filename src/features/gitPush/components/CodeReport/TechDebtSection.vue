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
                <!-- 趋势徽章（箭头 + 方向文案，颜色由趋势方向驱动） -->
                <span
                  class="gpr-debt-trend-chip"
                  :style="trendChipStyle(row.path)"
                >{{ trendChipText(row.path) }}</span>
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
              <!-- 最后修改时间（相对时间，完整 ISO 悬停可见） -->
              <span
                class="gpr-cell gpr-cell--date"
                :title="row.lastModified"
              >{{ row.lastModified ? relativeTime(row.lastModified, i18n) : "-" }}</span>
            </div>

            <!-- 展开详情面板：LOC 懒加载 + 趋势解释 + 近期共变文件 -->
            <DebtFileDetail
              v-if="expandedPath === row.path"
              :i18n="i18n"
              :project="project"
              :row="row"
              :coupled="coupledMap.get(row.path) ?? []"
            />
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// 技术债务分区：汇总条 + 严重度分组可展开表（趋势徽章/最后修改/详情懒加载；手风琴展开）
import type { CodeReportData, GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import { DEBT_SEVERITY_META } from "../../types"
import { countDebtFiles, DEBT_SEVERITY_ORDER } from "../../reportMetrics"
import { buildCoupledMap, DEBT_TREND_META, inferDebtTrend } from "../../composables/useDebtInsights"
import type { CoupledFile, DebtTrend } from "../../composables/useDebtInsights"
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

/** 按严重度预分组（严重/高/中/低，组内已按风险分降序；单次过滤替代模板中重复 filter 调用；空分组不渲染） */
const groups = computed(() =>
  DEBT_SEVERITY_ORDER.map((sev) => ({
    sev,
    rows: props.report.debtFiles.filter((r) => r.severity === sev),
  })).filter((g) => g.rows.length > 0),
)

/** 当前展开的文件路径（手风琴模式：同时只展开一个；重复点击收起） */
const expandedPath = ref<string>("")

/** 路径 → 趋势方向 预计算映射（避免模板中每行重复推断） */
const trendMap = computed<Record<string, DebtTrend>>(() => {
  const map: Record<string, DebtTrend> = {}
  for (const row of props.report.debtFiles) {
    map[row.path] = inferDebtTrend(row)
  }
  return map
})

/** 路径 → 近期共变文件 预计算映射（详情面板展开时直接取用，避免展开瞬间重复聚类） */
const coupledMap = computed<Map<string, CoupledFile[]>>(() => buildCoupledMap(props.report.debtFiles))

/** 切换行展开态（手风琴：展开其他行时自动收起当前行） */
function toggleExpand(path: string) {
  expandedPath.value = expandedPath.value === path ? "" : path
}

/** 趋势徽章颜色（边框 + 文字取趋势方向色） */
function trendChipStyle(path: string): Record<string, string> {
  const color = DEBT_TREND_META[trendMap.value[path] ?? "calm"].color
  return { borderColor: color, color }
}

/** 趋势徽章文案（箭头 + 方向短文案） */
function trendChipText(path: string): string {
  const meta = DEBT_TREND_META[trendMap.value[path] ?? "calm"]
  return `${meta.arrow} ${props.i18n[meta.labelKey]}`
}
</script>

<style lang="scss">
@use "../../styles/TechDebtSection.scss";
@use "../../styles/index.scss";
</style>
