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
      <AnalysisTabs
        v-model="activeTab"
        :i18n="i18n"
        :counts="tabCounts"
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
          <!-- 提交概览视角：热力图/日历显示设置 -->
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
          <!-- 总览卡片：总提交次数 / 已分析项目 -->
          <StatCardGrid
            :min-width="110"
            :cards="overviewCards"
          />

          <!-- 空状态：分析完成但无提交数据 -->
          <EmptyState
            v-if="stats.totalCommits === 0"
            icon="mdi:source-commit"
            :text="i18n.analysisNoData"
          />

          <template v-else>
            <!-- 双栏：项目提交排行 | 最近提交记录 -->
            <div class="gpa-pair">
              <ProjectRankingSection
                :i18n="i18n"
                :stats="stats"
                @view-project="emit('viewProject', $event)"
              />
              <RecentCommitsSection
                :i18n="i18n"
                :stats="stats"
                @view-project="emit('viewProject', $event)"
              />
            </div>

            <!-- 提交热力图 / 日历 -->
            <HeatmapCalendarSection
              :i18n="i18n"
              :stats="stats"
              :view-settings="viewSettings"
            />

            <!-- 最近 30 天提交趋势 -->
            <DailyTrendSection
              :i18n="i18n"
              :stats="stats"
            />

            <!-- 双栏：作者提交排行 | 提交内容类型 -->
            <AuthorTypeSection
              :i18n="i18n"
              :stats="stats"
            />
          </template>
        </template>

        <!-- ═══ 视角 2：规则检查 ═══ -->
        <template v-else-if="activeTab === 'rulecheck'">
          <!-- 空状态：分析完成但无提交数据 -->
          <EmptyState
            v-if="ruleCheckStats.totalCommits === 0"
            icon="mdi:source-commit"
            :text="i18n.ruleCheckNoData"
          />

          <template v-else>
            <!-- 总览卡片 + 规则提示 -->
            <RuleCheckOverview
              :i18n="i18n"
              :stats="ruleCheckStats"
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
              :min-width="78"
              :cards="summaryCards"
            />

            <LineRankingSection
              :i18n="i18n"
              :project-ranking="projectRanking"
              @view-project="emit('viewProject', $event)"
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

    <!-- 项目行数详情弹窗（点击项目行打开，展示该项目的文件/作者行数明细） -->
    <ProjectLineDetail
      v-if="lineDetailProjectId"
      :i18n="i18n"
      :project-id="lineDetailProjectId"
      :project-name="lineDetailProjectName"
      :total-lines="lineDetailTotalLines"
      :get-numstat="getProjectNumstat"
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
import type { AnalysisTabId } from "./AnalysisTabs.vue"
import type { CommitAnalysisStats, CommitAnalysisViewSettings, CommitRuleCheckStats, CommitRuleViolation, GitProject, LineStatsSummary, ProjectFetchFailure, ProjectLineRankItem } from "../../types"
import type { NumstatCommit } from "../../reportMetrics"
import type { CommitCount } from "../../composables/useCommitAnalysis"
import type { StatCardItem } from "../common/StatCardGrid.vue"
import { computed, ref } from "vue"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import Select from "@/components/Select.vue"
import EmptyState from "../common/EmptyState.vue"
import AnalysisGate from "../common/AnalysisGate.vue"
import AnalysisToolbar from "../common/AnalysisToolbar.vue"
import CommitCountSelect from "../common/CommitCountSelect.vue"
import StatCardGrid from "../common/StatCardGrid.vue"
import BatchFixDialog from "../common/BatchFixDialog.vue"
import CommitFixDialog from "../common/CommitFixDialog.vue"
import DropCommitDialog from "../common/DropCommitDialog.vue"
import { buildYearOptions } from "../../utils"
import AnalysisTabs from "./AnalysisTabs.vue"
import AuthorTypeSection from "./AuthorTypeSection.vue"
import CommitAnalysisSettings from "./CommitAnalysisSettings.vue"
import DailyTrendSection from "./DailyTrendSection.vue"
import HeatmapCalendarSection from "./HeatmapCalendarSection.vue"
import ProjectRankingSection from "./ProjectRankingSection.vue"
import RecentCommitsSection from "./RecentCommitsSection.vue"
import ExtFilterDialog from "../LineStats/ExtFilterDialog.vue"
import FetchFailuresDialog from "../LineStats/FetchFailuresDialog.vue"
import LineRankingSection from "../LineStats/LineRankingSection.vue"
import ProjectLineDetail from "../LineStats/ProjectLineDetail.vue"
import ReasonDistributionSection from "../CommitRuleCheck/ReasonDistributionSection.vue"
import RuleCheckOverview from "../CommitRuleCheck/RuleCheckOverview.vue"
import ViolationListSection from "../CommitRuleCheck/ViolationListSection.vue"

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
  getProjectNumstat: (projectId: string) => NumstatCommit[]
  getProjectFileLines: (projectId: string) => Map<string, number | null>
  refreshProject: (projectId: string) => void
}>()

const emit = defineEmits<{
  runAnalysis: []
  runLineStats: []
  updateCount: [n: CommitCount]
  updateViewSettings: [patch: Record<string, any>]
  updateSelectedExtensions: [exts: string[]]
  updateProject: [projectId: string]
  viewProject: [projectId: string]
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

/** Tab 角标计数：概览=提交数，规则检查=违规数，行数排行=项目数 */
const tabCounts = computed(() => ({
  overview: props.stats.totalCommits,
  rulecheck: props.ruleCheckStats.violationCount,
  linestats: props.projectRanking.length,
}))

/** 运行按钮：按当前视角触发对应的抓取（行数排行抓 numstat，其余抓 commit log） */
function runCurrentTab() {
  if (activeTab.value === "linestats") emit("runLineStats")
  else emit("runAnalysis")
}

/** 年份选项：数据年份 ∪ 今年 ∪ 已保存年份，降序（供设置弹窗与设置汇总弹窗共用逻辑） */
const yearOptions = computed(() => buildYearOptions(props.stats.entries, props.viewSettings.range))

/** 总览卡片：总提交次数 / 已分析项目（失败计数由 AnalysisGate 统一承担，不再重复渲染） */
const overviewCards = computed<StatCardItem[]>(() => [
  { key: "commits", value: props.stats.totalCommits, label: props.i18n.analysisTotalCommits },
  { key: "covered", value: `${props.stats.analyzedCount} / ${props.stats.projectCount}`, label: props.i18n.analysisCoveredProjects },
])

/** 行数汇总卡片：总新增 / 总删除 / 总净增 / 当前总行数 */
const summaryCards = computed<StatCardItem[]>(() => {
  const { added, deleted, net, totalLines } = props.lineStatsSummary
  const netSuffix = net > 0 ? "pos" : net < 0 ? "neg" : "zero"
  return [
    { key: "added", value: `+${added.toLocaleString()}`, label: props.i18n.lineStatsTotalAdded, valueCls: "gp-statgrid-value--add" },
    { key: "deleted", value: `−${deleted.toLocaleString()}`, label: props.i18n.lineStatsTotalDeleted, valueCls: "gp-statgrid-value--del" },
    { key: "net", value: net.toLocaleString(), label: props.i18n.lineStatsTotalNet, valueCls: `gp-statgrid-value--net-${netSuffix}` },
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

/** 修正成功后关闭弹窗并触发重分析（局部刷新由父层按项目处理） */
function handleFixSaved() {
  editingViolation.value = null
  emit("runAnalysis")
}

/** 删除成功后关闭弹窗并触发重分析 */
function handleDropSaved() {
  droppingViolation.value = null
  emit("runAnalysis")
}

/** 批量修正保存完成：重分析受影响项目，弹窗保持打开由"完成"按钮关闭 */
function handleBatchSaved() {
  emit("runAnalysis")
}
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/CommitRuleCheckPanel.scss";
@use "../../styles/LineStatsPanel.scss";
@use "../../styles/AnalysisTabs.scss";
@use "../../styles/index.scss";
</style>
