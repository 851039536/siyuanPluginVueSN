<!-- gitPush 提交分析视图入口容器（三视角 Tab：提交概览 / 规则检查 / 行数排行，共用一次 git 抓取） -->
<template>
  <div class="gpa-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="projectCount === 0"
      icon="mdi:chart-timeline-variant"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 三视角切换条（三个视角同属一次 runCore 抓取，各占一个顶部入口会误以为要分别分析三次） -->
      <SectionTabs
        v-model="activeTab"
        :items="tabItems"
        :aria-label="i18n.analysisView"
      />

      <!-- 顶部工具条：状态文案 + 视角特有控件 + 分析按钮（三视角共用同一个运行入口） -->
      <AnalysisToolbar
        :i18n="i18n"
        :running="tabRunning"
        :done="tabDone"
        :analyzed-at="tabAnalyzedAt"
        :not-run-key="toolbarNotRunKey"
        icon="chartTimelineVariant"
        :outlined="activeTab === 'linestats'"
        :run-text="i18n.auditRun"
        :rerun-text="i18n.auditRerun"
        :aria-label="i18n.analysisView"
        @run="runCurrentTab"
      >
        <template #controls>
          <!-- 提交概览视角：显示范围（最近一年 / 全部 / 年份；KPI、排行、趋势与热力图同源） -->
          <Select
            v-if="activeTab === 'overview'"
            class="gpa-toolbar-range"
            :model-value="String(viewSettings.range)"
            size="xsmall"
            :options="rangeOptions"
            :aria-label="i18n.analysisRangeLabel"
            @change="onRangeChange"
          />
          <!-- 规则检查视角：项目过滤下拉（"全部项目"/单个项目，切换即过滤统计结果） -->
          <Select
            v-if="activeTab === 'rulecheck'"
            :model-value="ruleCheckProjectId"
            class="grc-project-select"
            size="xsmall"
            :options="projectOptions"
            :placeholder="i18n.ruleCheckSelectProject"
            :max-height="200"
            :filterable="projects.length >= 10"
            :filter-placeholder="i18n.searchPlaceholder"
            @change="onProjectChange"
          />
          <!-- 行数排行视角：文件格式过滤（已选数量走共享 Badge 角标；有生效过滤时描边转主题色） -->
          <Badge
            v-if="activeTab === 'linestats'"
            :content="selectedExtensions.length"
            :hidden="selectedExtensions.length === 0"
            variant="primary"
            size="xsmall"
          >
            <Button
              icon="filterVariant"
              size="xsmall"
              variant="ghost"
              :outlined="true"
              :severity="selectedExtensions.length > 0 ? 'primary' : undefined"
              :disabled="tabRunning"
              :title="i18n.lineStatsExtFilter"
              @click="showExtDialog = true"
            />
          </Badge>
          <!-- 提交概览 / 规则检查视角：条数选择（行数排行按全量 numstat，与条数无关故不显示） -->
          <CommitCountSelect
            v-if="activeTab !== 'linestats'"
            :i18n="i18n"
            :commit-count="commitCount"
            @update-count="emit('updateCount', $event)"
          />
          <!-- 提交概览视角：热力图显示设置 -->
          <CommitAnalysisSettings
            v-if="activeTab === 'overview'"
            :i18n="i18n"
            :view-settings="viewSettings"
            :years="yearOptions"
            @update="emit('updateViewSettings', $event)"
          />
        </template>
      </AnalysisToolbar>

      <!-- 四态门：分析中占位 / 未分析提示 / 失败提示 / 已就绪内容（三视角共用） -->
      <AnalysisGate
        :running="tabRunning"
        :done="tabDone"
        :not-run-text="i18n[toolbarNotRunKey]"
        :running-text="i18n.auditing"
        icon="mdi:chart-timeline-variant"
        :failed-count="failedCount"
        :fail-text="i18n.analysisFailedCount.replace('{0}', String(failedCount))"
      >
        <!-- 失败明细入口（仅行数排行视角有 per-project 失败原因） -->
        <template #failAction>
          <Button
            v-if="activeTab === 'linestats' && fetchFailures.length > 0"
            variant="ghost"
            :text="true"
            size="xsmall"
            icon="alertCircleOutline"
            @click="showFailDialog = true"
          >{{ i18n.lineStatsFailureShow }}</Button>
        </template>

        <!-- ═══ 视角 1：提交概览 ═══ -->
        <template v-if="activeTab === 'overview'">
          <!-- 总览卡片：范围内提交数 / 已分析项目 / 活跃天数 / 日均提交 -->
          <StatCardGrid
            :min-width="110"
            :cards="overviewCards"
          />

          <!-- 范围口径：排行、趋势图与 KPI 共用同一份范围内条目 -->
          <p class="gpa-scope-note">
            {{ rangeScopeText }}
          </p>

          <!-- 空状态：所选范围内无提交数据 -->
          <EmptyState
            v-if="rangeEntries.length === 0"
            icon="mdi:source-commit"
            :text="i18n.analysisTrendNoData"
          />

          <template v-else>
            <!-- 每日项目提交趋势：与热力图同粒度的桶 × 项目堆叠柱（点击柱子联动下方明细） -->
            <ProjectCommitTrend
              :i18n="i18n"
              :entries="rangeEntries"
              :start="rangeBounds.start"
              :end="rangeBounds.end"
              :granularity="rangeGranularity"
              :week-start="viewSettings.weekStart"
              @pick="onTrendPick"
            />

            <!-- 项目提交排行：横向进度条（范围内口径，与趋势图同源） -->
            <ProjectRankingSection
              :i18n="i18n"
              :entries="rangeEntries"
              @view-project="emit('viewProject', $event)"
            />

            <!-- 提交热力图（日/周/月粒度提交分布的唯一出口：范围/周起始/颜色/分档/密度可配；点击格子展开当日明细） -->
            <div ref="heatmapWrapRef">
              <HeatmapSection
                :i18n="i18n"
                :stats="stats"
                :view-settings="viewSettings"
                :focus-request="focusRequest"
                @view-project="emit('viewProject', $event)"
                @update-view-settings="emit('updateViewSettings', $event)"
              />
            </div>
          </template>
        </template>

        <!-- ═══ 视角 2：规则检查 ═══ -->
        <template v-else-if="activeTab === 'rulecheck'">
          <!-- 空状态：分析完成但无可检查提交（无条目 / 所选项目无提交 / 仅有 merge 提交） -->
          <EmptyState
            v-if="stats.entries.length === 0 || ruleCheckStats.totalCommits === 0"
            icon="mdi:source-commit"
            :text="i18n.ruleCheckNoData"
          />

          <template v-else>
            <!-- 总览卡片 + 规则提示 -->
            <RuleCheckOverview
              :i18n="i18n"
              :stats="ruleCheckStats"
              :rule-config="ruleConfig"
            />

            <!-- 违规类型分布 -->
            <ReasonDistributionSection
              :i18n="i18n"
              :stats="ruleCheckStats"
            />

            <!-- 空状态：全部合规 -->
            <EmptyState
              v-if="ruleCheckStats.violationCount === 0"
              icon="mdi:check-decagram"
              :text="i18n.ruleCheckAllCompliant"
            />

            <!-- 不合规提交列表 -->
            <ViolationListSection
              v-else
              :i18n="i18n"
              :stats="ruleCheckStats"
              :scoped="scoped"
              @view-project="emit('viewProject', $event)"
              @open-fix="openFix"
              @open-drop="openDrop"
              @open-batch-fix="openBatchFix"
            />
          </template>
        </template>

        <!-- ═══ 视角 3：行数排行 ═══ -->
        <template v-else>
          <!-- 空状态：分析完成但无行数数据 -->
          <EmptyState
            v-if="projectRanking.length === 0"
            icon="mdi:source-commit"
            :text="i18n.lineStatsNoData"
          />

          <!-- 单栏堆叠：汇总卡片 + 项目代码行数排行 -->
          <div
            v-else
            class="gls-pair"
          >
            <StatCardGrid
              :min-width="96"
              :cards="summaryCards"
            />

            <LineRankingSection
              :i18n="i18n"
              :project-ranking="projectRanking"
              @open-detail="emit('openLineDetail', $event)"
            />
          </div>
        </template>
      </AnalysisGate>
    </template>

    <!-- 文件格式过滤配置弹窗（行数排行视角） -->
    <ExtFilterDialog
      v-if="showExtDialog"
      :i18n="i18n"
      :selected="selectedExtensions"
      @close="showExtDialog = false"
      @apply="onApplyExt"
    />

    <!-- 项目行数详情弹窗（点击项目行打开，展示该项目的文件存量行数明细） -->
    <ProjectLineDetail
      v-if="lineDetailProjectId"
      :i18n="i18n"
      :project-id="lineDetailProjectId"
      :project-name="lineDetailProjectName"
      :total-lines="lineDetailTotalLines"
      :get-file-lines="getProjectFileLines"
      :extensions="selectedExtensions"
      :refresh-project="refreshProject"
      :refreshing="lineDetailRefreshing"
      @close="emit('closeLineDetail')"
    />

    <!-- 项目抓取失败明细弹窗（行数排行视角的失败提示入口） -->
    <FetchFailuresDialog
      v-if="showFailDialog"
      :i18n="i18n"
      :failures="fetchFailures"
      @close="showFailDialog = false"
    />

    <!-- 提交信息修正弹窗（自包含：内部校验 HEAD/工作区并执行 amend） -->
    <CommitFixDialog
      v-if="editingViolation"
      :i18n="i18n"
      :target="editingViolation"
      @close="editingViolation = null"
      @saved="handleFixSaved"
    />

    <!-- 删除历史提交弹窗（自包含：校验 HEAD/merge/祖先/rebase + bundle 备份 + commit-tree 删除） -->
    <DropCommitDialog
      v-if="droppingViolation"
      :i18n="i18n"
      :target="droppingViolation"
      @close="droppingViolation = null"
      @saved="handleDropSaved"
    />

    <!-- 提交信息批量修正弹窗（自包含：多项目/多条违规校验、AI 批量生成、批量保存） -->
    <BatchFixDialog
      v-if="editingBatch"
      :i18n="i18n"
      :targets="editingBatch"
      @close="editingBatch = null"
      @saved="handleBatchSaved"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析视图入口容器：三视角 Tab（提交概览 / 规则检查 / 行数排行）。
// 三者同属一次 runCore 抓取（entries 供概览与规则检查，numstat/totalLines 供行数排行），
// 故合并为一个视图 + 内部 Tab：运行按钮只有一个，Tab 切换只切视角不重跑 git。
import type { CommitAnalysisStats, CommitAnalysisViewSettings, CommitRuleCheckStats, CommitRuleConfig, CommitRuleViolation, GitProject, LineStatsSummary, ProjectFetchFailure, ProjectLineRankItem } from "../../types"
import type { CommitCount } from "../../composables/useCommitAnalysis"
import type { HeatBucketSpan } from "../../utils"
import type { StatCardItem } from "../common/StatCardGrid.vue"
import type { SectionTabItem } from "../common/sectionTabs"
import { computed, nextTick, ref } from "vue"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import Select from "@/components/Select.vue"
import EmptyState from "../common/EmptyState.vue"
import AnalysisGate from "../common/AnalysisGate.vue"
import AnalysisToolbar from "../common/AnalysisToolbar.vue"
import CommitCountSelect from "../common/CommitCountSelect.vue"
import SectionTabs from "../common/SectionTabs.vue"
import StatCardGrid from "../common/StatCardGrid.vue"
import BatchFixDialog from "../common/BatchFixDialog.vue"
import CommitFixDialog from "../common/CommitFixDialog.vue"
import DropCommitDialog from "../common/DropCommitDialog.vue"
import { buildAnalysisRangeOptions } from "./analysisRangeOptions"
import {
  buildYearOptions,
  filterEntriesByRange,
  formatLocalDate,
  inclusiveDays,
  resolveAnalysisRange,
  resolveTrendGranularity,
} from "../../utils"
import CommitAnalysisSettings from "./CommitAnalysisSettings.vue"
import HeatmapSection from "./HeatmapSection.vue"
import ProjectCommitTrend from "./ProjectCommitTrend.vue"
import ProjectRankingSection from "./ProjectRankingSection.vue"
import ExtFilterDialog from "../LineStats/ExtFilterDialog.vue"
import FetchFailuresDialog from "../LineStats/FetchFailuresDialog.vue"
import LineRankingSection from "../LineStats/LineRankingSection.vue"
import ProjectLineDetail from "../LineStats/ProjectLineDetail.vue"
import ReasonDistributionSection from "../CommitRuleCheck/ReasonDistributionSection.vue"
import RuleCheckOverview from "../CommitRuleCheck/RuleCheckOverview.vue"
import ViolationListSection from "../CommitRuleCheck/ViolationListSection.vue"

/** 提交分析内部视角 id（概览 / 规则检查 / 行数排行） */
type AnalysisTabId = "overview" | "rulecheck" | "linestats"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全部项目（空态判断 + 规则检查项目过滤下拉） */
  projects: GitProject[]
  // ── 提交概览 / 规则检查域 ──
  stats: CommitAnalysisStats
  /** 规则检查聚合统计（与 stats 同源 entries 派生） */
  ruleCheckStats: CommitRuleCheckStats
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO，提交域） */
  analyzedAt: string
  /** 上次行数抓取完成时间（ISO，行数域与提交域独立维护） */
  lineAnalyzedAt: string
  commitCount: CommitCount
  viewSettings: CommitAnalysisViewSettings
  /** 提交规则配置（规则提示文案随可选规则开关变化） */
  ruleConfig: CommitRuleConfig
  /** 规则检查的项目过滤（"" = 全部项目） */
  ruleCheckProjectId: string
  // ── 行数排行域（独立进度/时间戳/失败计数） ──
  projectRanking: ProjectLineRankItem[]
  lineStatsSummary: LineStatsSummary
  lineAnalyzing: boolean
  lineAnalyzed: boolean
  /** 行数抓取失败的项目数 */
  lineFailedCount: number
  fetchFailures: ProjectFetchFailure[]
  selectedExtensions: string[]
  lineDetailProjectId: string
  lineDetailRefreshing: boolean
  getProjectFileLines: (projectId: string) => Map<string, number | null>
  refreshProject: (projectId: string) => void
}>()

const emit = defineEmits<{
  runAnalysis: [projectIds?: string | string[]]
  runLineStats: []
  updateCount: [n: CommitCount]
  updateViewSettings: [patch: Record<string, any>]
  updateSelectedExtensions: [exts: string[]]
  updateProject: [projectId: string]
  viewProject: [projectId: string]
  /** 打开某项目的行数详情弹窗（行数排行行点击；由 index.vue 设置 lineDetailProjectId） */
  openLineDetail: [projectId: string]
  /** 历史重写完成（修正/删除/批量修正）：父层据此重查受影响项目的推送状态 */
  commitsRewritten: [projectIds: string[]]
  closeLineDetail: []
}>()

/** 当前视角（切换只切渲染分支，不触发 git） */
const activeTab = ref<AnalysisTabId>("overview")

/** 项目总数 */
const projectCount = computed(() => props.projects.length)

/** 当前视角是否已完成过至少一轮（三视角进度独立，故分别取） */
const tabDone = computed(() =>
  activeTab.value === "linestats" ? props.lineAnalyzed : props.analyzed,
)

/** 当前视角的上次完成时间（行数域与提交域各自维护时间戳，避免串台显示） */
const tabAnalyzedAt = computed(() =>
  activeTab.value === "linestats" ? props.lineAnalyzedAt : props.analyzedAt,
)

/** 未运行提示的 i18n 键（随视角切换文案） */
const toolbarNotRunKey = computed(() => {
  if (activeTab.value === "rulecheck") return "ruleCheckNotRun"
  if (activeTab.value === "linestats") return "lineStatsNotRun"
  return "analysisNotRun"
})

/** 当前视角的失败计数（提交域与行数域各自维护） */
const failedCount = computed(() =>
  activeTab.value === "linestats" ? props.lineFailedCount : props.stats.failedCount,
)

/** 当前视角的运行状态（提交域与行数域各自维护进度，避免另一域在跑时误显示本域转圈） */
const tabRunning = computed(() =>
  activeTab.value === "linestats" ? props.lineAnalyzing : props.analyzing,
)

/**
 * 三视角配置（label 已渲染为 i18n 文案，hint 为悬停说明）。
 * 刻意不显示角标：三个视角的主计数均已由各自面板内的 KPI 卡 / 汇总卡 / 列表承担，
 * Tab 角标与之同屏重复（同一数字渲染两次）。
 */
const tabItems = computed<SectionTabItem<AnalysisTabId>[]>(() => [
  { id: "overview", label: props.i18n.analysisTabOverview, hint: props.i18n.analysisTabOverviewHint, icon: "chartTimelineVariant" },
  { id: "rulecheck", label: props.i18n.analysisTabRuleCheck, hint: props.i18n.ruleCheckView, icon: "clipboardCheckOutline" },
  { id: "linestats", label: props.i18n.analysisTabLineStats, hint: props.i18n.lineStatsView, icon: "codeTags" },
])

/** 运行按钮：按当前视角触发对应的抓取（行数排行抓 numstat，其余抓 commit log） */
function runCurrentTab() {
  if (activeTab.value === "linestats") emit("runLineStats")
  else emit("runAnalysis")
}

/** 年份选项：数据年份 ∪ 今年 ∪ 已保存年份，降序（供工具条范围下拉与设置汇总弹窗共用逻辑） */
const yearOptions = computed(() => buildYearOptions(props.stats.entries, props.viewSettings.range))

/** 工具条显示范围下拉选项（与显示设置表单共用同一份构建逻辑） */
const rangeOptions = computed(() => buildAnalysisRangeOptions(props.i18n, yearOptions.value))

/** 工具条范围切换（字符串分支固定为 lastYear / all，其余视为年份） */
function onRangeChange(v: string | number | boolean | null) {
  if (typeof v !== "string") return
  if (v === "lastYear" || v === "all") {
    emit("updateViewSettings", { range: v })
    return
  }
  emit("updateViewSettings", { range: Number(v) })
}

/** 显示范围起止（KPI / 排行 / 趋势图共用，与热力图同一份 viewSettings.range；"all" 需要条目推算最早一天） */
const rangeBounds = computed(() => {
  const {
    start,
    end,
  } = resolveAnalysisRange(props.viewSettings.range, props.stats.entries)
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  }
})

/** 范围内条目（排行与趋势图的唯一数据源；热力图内部按同一范围过滤） */
const rangeEntries = computed(() =>
  filterEntriesByRange(props.stats.entries, rangeBounds.value.start, rangeBounds.value.end),
)

/** 趋势图粒度：多年跨度向季度/年收敛，避免几十根柱挤成一排 */
const rangeGranularity = computed(() => resolveTrendGranularity(rangeBounds.value.start, rangeBounds.value.end))

/** 范围天数（闭区间）与活跃天数（有提交的本地日期数） */
const rangeDaySpan = computed(() => inclusiveDays(rangeBounds.value.start, rangeBounds.value.end))
const rangeActiveDays = computed(() =>
  new Set(rangeEntries.value.map((e) => formatLocalDate(new Date(e.date)))).size,
)

/** 抓取条数口径（数据只覆盖每项目最近 N 条；与范围一起交代，避免 KPI/排行被误读为全量） */
const capHint = computed(() =>
  props.commitCount === "all"
    ? String(props.i18n.analysisTrendCapAll || "")
    : String(props.i18n.analysisTrendCapHint || "").replace("{0}", String(props.commitCount)),
)

/** 范围口径说明（KPI 卡片下方一行：范围 + 抓取条数上限） */
const rangeScopeText = computed(() => {
  const scope = String(props.i18n.analysisScopeNote || "")
    .replace("{0}", rangeBounds.value.start)
    .replace("{1}", rangeBounds.value.end)
  return [scope, capHint.value].filter(Boolean).join(" · ")
})

/** 总览卡片：范围内提交数 / 已分析项目 / 活跃天数 / 日均提交（失败计数由 AnalysisGate 统一承担） */
const overviewCards = computed<StatCardItem[]>(() => {
  const total = rangeEntries.value.length
  const avg = rangeDaySpan.value > 0 ? (total / rangeDaySpan.value).toFixed(1) : "0"
  return [
    {
      key: "commits",
      value: total,
      label: props.i18n.analysisTotalCommits,
    },
    {
      key: "covered",
      value: `${props.stats.analyzedCount} / ${props.stats.projectCount}`,
      label: props.i18n.analysisCoveredProjects,
    },
    {
      key: "activeDays",
      value: rangeActiveDays.value,
      label: props.i18n.analysisKpiActiveDays,
    },
    {
      key: "avgDaily",
      value: avg,
      label: props.i18n.analysisKpiAvgDaily,
    },
  ]
})

// ── 趋势图 → 热力图选区联动 ──

/** 热力图区块锚点（点击柱子后滚到区块底部，让当日/区间明细可见） */
const heatmapWrapRef = ref<HTMLElement | null>(null)

/** 选区请求（nonce 保证连续点击同一格也能触发监听） */
const focusRequest = ref<{ span: HeatBucketSpan, nonce: number } | null>(null)
let focusNonce = 0

function onTrendPick(span: HeatBucketSpan) {
  focusRequest.value = {
    span: { ...span },
    nonce: ++focusNonce,
  }
  void nextTick(() => heatmapWrapRef.value?.scrollIntoView({
    behavior: "smooth",
    block: "end",
  }))
}

/** 行数汇总卡片：项目数 / 文件数 / 当前总行数（全部为存量口径；增删净已随列表列一并移除） */
const summaryCards = computed<StatCardItem[]>(() => {
  const { projectCount, fileCount, totalLines } = props.lineStatsSummary
  return [
    { key: "projects", value: projectCount.toLocaleString(), label: props.i18n.lineStatsTotalProjects },
    { key: "files", value: fileCount.toLocaleString(), label: props.i18n.lineStatsTotalFiles },
    { key: "totalLines", value: totalLines.toLocaleString(), label: props.i18n.lineStatsTotalLines, valueCls: "gp-statgrid-value--total", hint: props.i18n.lineStatsTotalHint },
  ]
})

/** 行数详情弹窗目标行（项目名与总行数共用单次查找；项目已删除时为 undefined） */
const lineDetailRow = computed(() => props.projectRanking.find((r) => r.id === props.lineDetailProjectId))
const lineDetailProjectName = computed(() => lineDetailRow.value?.name ?? props.lineDetailProjectId)
const lineDetailTotalLines = computed(() => lineDetailRow.value?.totalLines)

// ── 规则检查视角：项目过滤与弹窗编排 ──

/** 是否限定到单个项目（违规列表隐藏重复的项目名 chip，减少视觉噪音） */
const scoped = computed(() => !!props.ruleCheckProjectId)

/** 项目过滤下拉选项（首项"全部项目"，后续为各项目） */
const projectOptions = computed(() => [
  { value: "", label: props.i18n.ruleCheckAllProjects },
  ...props.projects.map((p) => ({ value: p.id, label: p.name })),
])

/** 项目过滤变更：仅回传字符串（Select 的 change 载荷为宽类型） */
function onProjectChange(v: string | number | boolean | null) {
  if (typeof v === "string") emit("updateProject", v)
}

/** 行数排行视角：过滤弹窗与失败明细弹窗开关 */
const showExtDialog = ref(false)
const showFailDialog = ref(false)

/** 应用扩展名过滤：回传选中列表并关闭弹窗 */
function onApplyExt(exts: string[]) {
  showExtDialog.value = false
  emit("updateSelectedExtensions", exts)
}

/** 当前正在编辑的违规提交（null = 未打开弹窗） */
const editingViolation = ref<CommitRuleViolation | null>(null)
/** 当前待删除的违规提交 */
const droppingViolation = ref<CommitRuleViolation | null>(null)
/** 当前批量修正的违规提交集合 */
const editingBatch = ref<CommitRuleViolation[] | null>(null)

function openFix(violation: CommitRuleViolation) {
  editingViolation.value = violation
}

/** 打开删除历史提交弹窗（merge 等不可删场景由弹窗内部拦截） */
function openDrop(violation: CommitRuleViolation) {
  droppingViolation.value = violation
}

/** 打开批量修正弹窗（违规列表按日期降序传入，批量弹窗内按新→旧顺序处理） */
function openBatchFix(violations: CommitRuleViolation[]) {
  editingBatch.value = violations
}

/** 修正成功后关闭弹窗并触发重分析（只重扫受影响项目，避免整轮 git log） */
function handleFixSaved() {
  const projectId = editingViolation.value?.projectId
  editingViolation.value = null
  if (projectId) emit("commitsRewritten", [projectId])
  emit("runAnalysis", projectId)
}

/** 删除成功后关闭弹窗并触发重分析（只重扫受影响项目） */
function handleDropSaved() {
  const projectId = droppingViolation.value?.projectId
  droppingViolation.value = null
  if (projectId) emit("commitsRewritten", [projectId])
  emit("runAnalysis", projectId)
}

/** 批量修正保存完成：只重分析受影响项目，弹窗保持打开由"完成"按钮关闭 */
function handleBatchSaved(projectIds: string[]) {
  if (projectIds.length > 0) emit("commitsRewritten", projectIds)
  emit("runAnalysis", projectIds)
}
</script>
