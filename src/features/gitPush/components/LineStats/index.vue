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
      <!-- 顶部工具条 -->
      <LineStatsToolbar
        :i18n="i18n"
        :analyzing="analyzing"
        :analyzed="analyzed"
        :analyzed-at="analyzedAt"
        :commit-count="commitCount"
        :selected-extensions="selectedExtensions"
        @run-analysis="emit('runAnalysis')"
        @update-count="emit('updateCount', $event)"
        @open-ext-dialog="showExtDialog = true"
      />

      <!-- 首次分析中占位 -->
      <div
        v-if="analyzing && !analyzed"
        class="gp-loading"
      >
        <Loader />
        <!-- 加载中文案："分析中…" -->
        <span class="gp-loading-text">{{ i18n.auditing }}</span>
      </div>

      <!-- 未分析提示 -->
      <EmptyState
        v-else-if="!analyzed"
        icon="mdi:code-tags"
        :text="i18n.lineStatsNotRun"
      />

      <template v-else>
        <!-- 失败提示 -->
        <div
          v-if="failedCount > 0"
          class="gls-fail-hint"
        >
          {{ i18n.analysisFailedCount.replace("{0}", String(failedCount)) }}
        </div>

        <!-- 空状态：分析完成但无行数数据 -->
        <EmptyState
          v-if="projectRanking.length === 0 && authorRanking.length === 0"
          icon="mdi:source-commit"
          :text="i18n.lineStatsNoData"
        />

        <!-- 单栏堆叠：汇总卡片 + 项目代码行数排行 + 作者代码行数排行 -->
        <div
          v-else
          class="gls-pair"
        >
          <!-- 顶部汇总卡片 -->
          <LineStatsCards
            :i18n="i18n"
            :summary="summary"
          />

          <!-- 项目代码行数排行 -->
          <LineRankingSection
            :i18n="i18n"
            mode="project"
            :project-ranking="projectRanking"
            :author-ranking="authorRanking"
            @view-project="emit('viewProject', $event)"
          />

          <!-- 作者代码行数排行 -->
          <LineRankingSection
            :i18n="i18n"
            mode="author"
            :project-ranking="projectRanking"
            :author-ranking="authorRanking"
          />
        </div>
      </template>
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
      @close="emit('closeLineDetail')"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 行数统计视图入口容器（状态编排 + 汇总卡片 + 排行区块 + 弹窗）
import type { NumstatCommit } from "../../reportMetrics"
import type { AuthorLineRankItem, LineStatsSummary, ProjectLineRankItem } from "../../types"
import { computed, ref } from "vue"
import EmptyState from "../common/EmptyState.vue"
import ExtFilterDialog from "./ExtFilterDialog.vue"
import LineRankingSection from "./LineRankingSection.vue"
import LineStatsCards from "./LineStatsCards.vue"
import LineStatsToolbar from "./LineStatsToolbar.vue"
import Loader from "@/components/Loader.vue"
import ProjectLineDetail from "./ProjectLineDetail.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 全部项目数（空状态判断） */
  projectCount: number
  /** 项目代码行数排行（按新增行降序） */
  projectRanking: ProjectLineRankItem[]
  /** 作者代码行数排行（按新增行降序） */
  authorRanking: AuthorLineRankItem[]
  /** 全量行数合计（基于全量项目数据独立累加，来自 useCommitAnalysis） */
  summary: LineStatsSummary
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  /** 抓取失败的项目数 */
  failedCount: number
  commitCount: number
  /** 选中的文件扩展名过滤（空数组 = 不过滤） */
  selectedExtensions: string[]
  /** 详情弹窗目标项目 id（非空即打开弹窗） */
  lineDetailProjectId: string
  /** 按 projectId 获取该项目原始 numstat（来自 useCommitAnalysis 内存缓存） */
  getProjectNumstat: (projectId: string) => NumstatCommit[]
  /** 按 projectId 获取该项目已跟踪文件的存量行数 Map（来自 useCommitAnalysis 内存缓存，值 null=不可读） */
  getProjectFileLines: (projectId: string) => Map<string, number | null>
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: number]
  updateSelectedExtensions: [exts: string[]]
  viewProject: [projectId: string]
  closeLineDetail: []
}>()

/** 过滤配置弹窗显示状态 */
const showExtDialog = ref(false)

/** 详情弹窗标题用项目名（从排行中查找；项目已删除时回退显示 id） */
const lineDetailProjectName = computed(
  () => props.projectRanking.find((r) => r.id === props.lineDetailProjectId)?.name ?? props.lineDetailProjectId,
)

/** 详情弹窗展示用当前总行数（从排行查找，存量口径；项目已删除或旧缓存缺失时为 undefined） */
const lineDetailTotalLines = computed(
  () => props.projectRanking.find((r) => r.id === props.lineDetailProjectId)?.totalLines,
)

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
