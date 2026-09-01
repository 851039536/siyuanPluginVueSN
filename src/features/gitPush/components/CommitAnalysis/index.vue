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
      <!-- 顶部工具条 -->
      <AnalysisToolbar
        :i18n="i18n"
        :analyzing="analyzing"
        :analyzed="analyzed"
        :analyzed-at="analyzedAt"
        :commit-count="commitCount"
        :view-settings="viewSettings"
        :year-options="yearOptions"
        @run-analysis="emit('runAnalysis')"
        @update-count="emit('updateCount', $event)"
        @update-view-settings="emit('updateViewSettings', $event)"
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
        icon="mdi:chart-timeline-variant"
        :text="i18n.analysisNotRun"
      />

      <template v-else>
        <!-- 总览卡片 + 失败提示 -->
        <AnalysisOverviewCards
          :i18n="i18n"
          :stats="stats"
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
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析视图入口容器（状态编排 + 各功能区块组合，纯编排无领域状态）
import type { CommitAnalysisStats, CommitAnalysisViewSettings } from "../../types"
import type { CommitCount } from "../../composables/useCommitAnalysis"
import { computed } from "vue"
import EmptyState from "../common/EmptyState.vue"
import Loader from "@/components/Loader.vue"
import { buildYearOptions } from "../../utils"
import AnalysisOverviewCards from "./AnalysisOverviewCards.vue"
import AnalysisToolbar from "./AnalysisToolbar.vue"
import AuthorTypeSection from "./AuthorTypeSection.vue"
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
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisPanel.scss";
@use "../../styles/index.scss";
</style>
