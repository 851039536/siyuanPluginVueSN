<!-- gitPush 提交分析视图入口容器（状态编排 + 各功能区块组合，纯编排无领域状态） -->
<template>
  <div class="gpa-panel">
    <!-- 空状态：无项目 -->
    <EmptyState
      v-if="stats.projectCount === 0"
      icon="mdi:chart-timeline-variant"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：状态文案 + 条数选择 + 分析按钮 + 显示设置 -->
      <AnalysisToolbar
        :i18n="i18n"
        :running="analyzing"
        :done="analyzed"
        :analyzed-at="analyzedAt"
        not-run-key="analysisNotRun"
        icon="chartTimelineVariant"
        :run-text="i18n.auditRun"
        :rerun-text="i18n.auditRerun"
        :aria-label="i18n.analysisView"
        @run="emit('runAnalysis')"
      >
        <template #controls>
          <!-- 条数选择（tooltip："每项目 {0} 条"） -->
          <CommitCountSelect
            :i18n="i18n"
            :commit-count="commitCount"
            @update-count="emit('updateCount', $event)"
          />
          <!-- 显示设置菜单 -->
          <CommitAnalysisSettings
            :i18n="i18n"
            :view-settings="viewSettings"
            :years="yearOptions"
            @update="emit('updateViewSettings', $event)"
          />
        </template>
      </AnalysisToolbar>

      <!-- 四态门：分析中占位 / 未分析提示 / 失败提示 / 已就绪内容 -->
      <AnalysisGate
        :running="analyzing"
        :done="analyzed"
        :not-run-text="i18n.analysisNotRun"
        :running-text="i18n.auditing"
        icon="mdi:chart-timeline-variant"
        :failed-count="stats.failedCount"
        :fail-text="i18n.analysisFailedCount.replace('{0}', String(stats.failedCount))"
      >
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
      </AnalysisGate>
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析视图入口容器（状态编排 + 各功能区块组合，纯编排无领域状态）
import type { CommitAnalysisStats, CommitAnalysisViewSettings } from "../../types"
import type { CommitCount } from "../../composables/useCommitAnalysis"
import type { StatCardItem } from "../common/StatCardGrid.vue"
import { computed } from "vue"
import EmptyState from "../common/EmptyState.vue"
import AnalysisGate from "../common/AnalysisGate.vue"
import AnalysisToolbar from "../common/AnalysisToolbar.vue"
import CommitCountSelect from "../common/CommitCountSelect.vue"
import StatCardGrid from "../common/StatCardGrid.vue"
import { buildYearOptions } from "../../utils"
import AuthorTypeSection from "./AuthorTypeSection.vue"
import CommitAnalysisSettings from "./CommitAnalysisSettings.vue"
import DailyTrendSection from "./DailyTrendSection.vue"
import HeatmapCalendarSection from "./HeatmapCalendarSection.vue"
import ProjectRankingSection from "./ProjectRankingSection.vue"
import RecentCommitsSection from "./RecentCommitsSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  stats: CommitAnalysisStats
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  commitCount: CommitCount
  viewSettings: CommitAnalysisViewSettings
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: CommitCount]
  updateViewSettings: [patch: Partial<CommitAnalysisViewSettings>]
  viewProject: [projectId: string]
}>()

/** 年份选项：数据年份 ∪ 今年 ∪ 已保存年份，降序（供工具条设置弹窗与设置汇总弹窗共用逻辑） */
const yearOptions = computed(() => buildYearOptions(props.stats.entries, props.viewSettings.range))

/** 总览卡片：总提交次数 / 已分析项目（失败计数由 AnalysisGate 统一承担，不再在此重复渲染） */
const overviewCards = computed<StatCardItem[]>(() => [
  { key: "commits", value: props.stats.totalCommits, label: props.i18n.analysisTotalCommits },
  { key: "covered", value: `${props.stats.analyzedCount} / ${props.stats.projectCount}`, label: props.i18n.analysisCoveredProjects },
])
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
