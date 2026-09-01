<!-- gitPush 统计视图入口容器（空态 + 总览卡片 + 瀑布流组合各功能区块） -->
<template>
  <div class="gp-stats-panel">
    <!-- 空状态：无项目时显示"暂无项目统计" -->
    <EmptyState
      v-if="stats.projectCount === 0"
      icon="mdi:chart-bar"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 总览卡片区 -->
      <OverviewCards
        :i18n="i18n"
        :stats="stats"
      />

      <!-- 瀑布流布局：容器 ≥ 约 684px 时双列瀑布，窄面板自动单列（列数由容器宽度决定），消除并排等高行的空隙 -->
      <div class="gp-stats-masonry">
        <!-- 远程覆盖率 -->
        <CoverageSection
          :i18n="i18n"
          :stats="stats"
        />

        <!-- 分类分布 -->
        <CategoryDistributionSection
          :i18n="i18n"
          :stats="stats"
        />

        <!-- 待处理项目（推送状态概览 + 待处理表格合并） -->
        <PendingProjectsSection
          :i18n="i18n"
          :stats="stats"
          @view-project="emit('viewProject', $event)"
        />

        <!-- 平台配置状态 -->
        <PlatformStatusSection
          :i18n="i18n"
          :stats="stats"
          @view-project="emit('viewProject', $event)"
        />

        <!-- 仓库链接一致性（按需批量比对手动链接与实际远程 URL） -->
        <RepoLinkAuditSection
          :i18n="i18n"
          :rows="auditRows"
          :auditing="auditing"
          :audited="audited"
          :summary="auditSummary"
          @run-audit="emit('runAudit')"
          @view-project="emit('viewProject', $event)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 统计视图入口容器（空态 + 瀑布流组合各功能区块，纯编排无领域状态）
import type { RepoLinkAuditRow, RepoLinkAuditSummary, StatsView } from "../../types"
import EmptyState from "../common/EmptyState.vue"
import CategoryDistributionSection from "./CategoryDistributionSection.vue"
import CoverageSection from "./CoverageSection.vue"
import OverviewCards from "./OverviewCards.vue"
import PendingProjectsSection from "./PendingProjectsSection.vue"
import PlatformStatusSection from "./PlatformStatusSection.vue"
import RepoLinkAuditSection from "./RepoLinkAuditSection.vue"

defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（单对象 prop，由 useGitStats.statsView 产出） */
  stats: StatsView
  /** 仓库链接一致性审计状态（useRepoLinkAudit 产出，透传给 RepoLinkAuditSection） */
  auditRows: RepoLinkAuditRow[]
  auditing: boolean
  audited: boolean
  auditSummary: RepoLinkAuditSummary
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
  runAudit: []
}>()
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
