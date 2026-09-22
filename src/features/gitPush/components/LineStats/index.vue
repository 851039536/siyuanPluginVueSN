<!-- gitPush 行数统计视图入口容器（状态编排 + 汇总卡片 + 排行区块 + 弹窗，纯编排无领域状态） -->
<template>
  <div class="gls-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="projectCount === 0"
      icon="mdi:code-tags"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：状态文案 + 扩展名过滤 + 分析按钮 -->
      <AnalysisToolbar
        :i18n="i18n"
        :running="analyzing"
        :done="analyzed"
        :analyzed-at="analyzedAt"
        not-run-key="lineStatsNotRun"
        fallback-key="timeJustNow"
        icon="codeTags"
        outlined
        :run-text="i18n.lineStatsRun"
        :rerun-text="i18n.auditRerun"
        :aria-label="i18n.lineStatsView"
        @run="emit('runAnalysis')"
      >
        <template #controls>
          <!-- 文件格式过滤配置按钮（已选数量走共享 Badge 角标；有生效过滤时描边转主题色） -->
          <Badge
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
              :disabled="analyzing"
              :title="i18n.lineStatsExtFilter"
              @click="showExtDialog = true"
            />
          </Badge>
        </template>
      </AnalysisToolbar>

      <!-- 四态门：分析中占位 / 未分析提示 / 失败提示 / 已就绪内容 -->
      <AnalysisGate
        :running="analyzing"
        :done="analyzed"
        :not-run-text="i18n.lineStatsNotRun"
        :running-text="i18n.auditing"
        icon="mdi:code-tags"
        :failed-count="failedCount"
        :fail-text="i18n.analysisFailedCount.replace('{0}', String(failedCount))"
      >
        <!-- 失败明细入口（名称与原因收纳在弹窗里；旧缓存无明细时仅显示计数） -->
        <template #failAction>
          <Button
            v-if="fetchFailures.length > 0"
            variant="ghost"
            :text="true"
            size="xsmall"
            icon="alertCircleOutline"
            @click="showFailDialog = true"
          >{{ i18n.lineStatsFailureShow }}</Button>
        </template>

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
          <!-- 顶部汇总卡片：总新增 / 总删除 / 总净增 / 当前总行数 -->
          <StatCardGrid
            :min-width="78"
            :cards="summaryCards"
          />

          <!-- 项目代码行数排行 -->
          <LineRankingSection
            :i18n="i18n"
            :project-ranking="projectRanking"
            @view-project="emit('viewProject', $event)"
          />
        </div>
      </AnalysisGate>
    </template>

    <!-- 文件格式过滤配置弹窗（点击过滤按钮弹出，确定后 emit 更新扩展名排除列表） -->
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

    <!-- 项目抓取失败明细弹窗（点击失败提示中的「查看失败项目」打开，逐条展示项目名/路径/原因） -->
    <FetchFailuresDialog
      v-if="showFailDialog"
      :i18n="i18n"
      :failures="fetchFailures"
      @close="showFailDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 行数统计视图入口容器（状态编排 + 汇总卡片 + 排行区块 + 弹窗）
import type { NumstatCommit } from "../../reportMetrics"
import type { LineStatsSummary, ProjectFetchFailure, ProjectLineRankItem } from "../../types"
import type { StatCardItem } from "../common/StatCardGrid.vue"
import { computed, ref } from "vue"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import EmptyState from "../common/EmptyState.vue"
import AnalysisGate from "../common/AnalysisGate.vue"
import AnalysisToolbar from "../common/AnalysisToolbar.vue"
import StatCardGrid from "../common/StatCardGrid.vue"
import ExtFilterDialog from "./ExtFilterDialog.vue"
import FetchFailuresDialog from "./FetchFailuresDialog.vue"
import LineRankingSection from "./LineRankingSection.vue"
import ProjectLineDetail from "./ProjectLineDetail.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全部项目数（空状态判断） */
  projectCount: number
  /** 项目代码行数排行（按总行数降序） */
  projectRanking: ProjectLineRankItem[]
  /** 全量行数合计（基于全量项目数据独立累加，来自 useCommitAnalysis） */
  summary: LineStatsSummary
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  /** 抓取失败的项目数 */
  failedCount: number
  /** 抓取失败项目明细（项目名 + 本次使用路径 + 原因分类 + 原始报错，失败明细弹窗数据源） */
  fetchFailures: ProjectFetchFailure[]
  /** 选中的文件扩展名过滤（空数组 = 不过滤） */
  selectedExtensions: string[]
  /** 详情弹窗目标项目 id（非空即打开弹窗） */
  lineDetailProjectId: string
  /** 按 projectId 获取该项目原始 numstat（来自 useCommitAnalysis 内存缓存） */
  getProjectNumstat: (projectId: string) => NumstatCommit[]
  /** 按 projectId 获取该项目已跟踪文件的存量行数 Map（来自 useCommitAnalysis 内存缓存，值 null=不可读） */
  getProjectFileLines: (projectId: string) => Map<string, number | null>
  /** 单项目行数刷新（详情弹窗刷新按钮，透传给 ProjectLineDetail） */
  refreshProject: (projectId: string) => void
  /** 单项目刷新进行中（详情弹窗刷新按钮旋转禁用） */
  lineDetailRefreshing: boolean
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateSelectedExtensions: [exts: string[]]
  viewProject: [projectId: string]
  closeLineDetail: []
}>()

/** 过滤配置弹窗显示状态 */
const showExtDialog = ref(false)

/** 失败明细弹窗显示状态 */
const showFailDialog = ref(false)

/** 汇总卡片：总新增 / 总删除 / 总净增 / 当前总行数（顺序：增删在前便于与净增横向对照） */
const summaryCards = computed<StatCardItem[]>(() => {
  const { added, deleted, net, totalLines } = props.summary
  const netSuffix = net > 0 ? "pos" : net < 0 ? "neg" : "zero"
  return [
    { key: "added", value: `+${added.toLocaleString()}`, label: props.i18n.lineStatsTotalAdded, valueCls: "gp-statgrid-value--add" },
    { key: "deleted", value: `−${deleted.toLocaleString()}`, label: props.i18n.lineStatsTotalDeleted, valueCls: "gp-statgrid-value--del" },
    { key: "net", value: net.toLocaleString(), label: props.i18n.lineStatsTotalNet, valueCls: `gp-statgrid-value--net-${netSuffix}` },
    { key: "totalLines", value: totalLines.toLocaleString(), label: props.i18n.lineStatsTotalLines, valueCls: "gp-statgrid-value--total", hint: props.i18n.lineStatsTotalHint },
  ]
})

/** 详情弹窗目标行（单次查找，项目名与总行数共用；项目已删除时为 undefined） */
const lineDetailRow = computed(() => props.projectRanking.find((r) => r.id === props.lineDetailProjectId))

/** 详情弹窗标题用项目名（项目已删除时回退显示 id） */
const lineDetailProjectName = computed(() => lineDetailRow.value?.name ?? props.lineDetailProjectId)

/** 详情弹窗展示用当前总行数（存量口径；项目已删除或旧缓存缺失时为 undefined） */
const lineDetailTotalLines = computed(() => lineDetailRow.value?.totalLines)

/** 弹窗应用过滤：回传选中列表并关闭 */
function onApplyExt(exts: string[]) {
  showExtDialog.value = false
  emit("updateSelectedExtensions", exts)
}
</script>

<style lang="scss">
@use "../../styles/LineStatsPanel.scss";
@use "../../styles/index.scss";
</style>
