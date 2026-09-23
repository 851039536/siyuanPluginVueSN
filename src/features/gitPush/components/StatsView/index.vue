<!-- gitPush 统计视图入口容器（工具条 + 总览卡片 + 双栏 Pair + 单栏堆叠区块，纯编排无领域状态） -->
<template>
  <div class="gps-panel">
    <!-- 空状态：无项目时显示"暂无项目统计" -->
    <EmptyState
      v-if="stats.projectCount === 0"
      icon="mdi:chart-bar"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：快照状态文案 + 刷新全部项目状态（与提交分析工具条同构） -->
      <StatsToolbar
        :i18n="i18n"
        :project-count="stats.projectCount"
        :refreshing="refreshing"
        :refreshed-at="refreshedAt"
        @refresh="emit('refresh')"
      />

      <!-- 总览卡片区（KPI 卡片 + 推送状态 chips） -->
      <OverviewCards
        :i18n="i18n"
        :stats="stats"
      />

      <!-- 双栏 Pair 1：分类分布（窄卡） | 待处理项目排行（限高滚动） -->
      <div class="gps-pair">
        <CategoryDistributionSection
          :i18n="i18n"
          :stats="stats"
        />

        <StatsSection
          :title="i18n.pendingProjects"
          :count="stats.pendingProjects.length"
          scroll
        >
          <!-- 待处理项目排行：条形宽度相对最多待推送提交数，整行按钮点击跳转项目 -->
          <div
            v-if="pendingRows.length > 0"
            class="gps-bar-list"
          >
            <Button
              v-for="row in pendingRows"
              :key="row.id"
              class="gps-bar-row gps-bar-row--clickable"
              variant="ghost"
              size="xsmall"
              dense
              :title="row.path"
              @click="emit('viewProject', row.id)"
            >
              <span
                class="gps-bar-label"
                :title="row.name"
              ><span class="gps-bar-text">{{ row.name }}</span></span>
              <span class="gps-bar-track">
                <span
                  class="gps-bar-fill"
                  :style="{ width: row.pct }"
                />
              </span>
              <span class="gps-bar-num">{{ row.count }}</span>
            </Button>
          </div>
          <!-- 空态："所有项目状态正常" -->
          <AllClear
            v-else
            :text="i18n.allClear"
          />
        </StatsSection>
      </div>

      <!-- 待处理项目明细表格（全宽：多列计数需横向空间） -->
      <PendingProjectsSection
        :i18n="i18n"
        :stats="stats"
        @view-project="emit('viewProject', $event)"
      />

      <!-- 平台区块（覆盖率汇总 + 每项目平台配置矩阵合并，全宽） -->
      <PlatformSection
        :i18n="i18n"
        :stats="stats"
        @view-project="emit('viewProject', $event)"
      />

      <!-- 仓库链接一致性（运行入口在本区块标题右侧；按需批量比对手动链接与实际远程 URL，全宽） -->
      <RepoLinkAuditSection
        :i18n="i18n"
        :rows="auditRows"
        :auditing="auditing"
        :audited="audited"
        :summary="auditSummary"
        @view-project="emit('viewProject', $event)"
        @run-audit="emit('runAudit')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 统计视图入口容器（工具条 + 卡片区 + 双栏/单栏区块组合，纯编排无领域状态）。
// 骨架与视觉对齐提交分析视图：AnalysisToolbar 同款工具条 → StatCardGrid 总览 → gps-pair 双栏 → 全宽区块。
import type { RepoLinkAuditRow, RepoLinkAuditSummary, StatsView } from "../../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { withBarPct } from "../../utils"
import EmptyState from "../common/EmptyState.vue"
import AllClear from "./common/AllClear.vue"
import StatsSection from "./common/StatsSection.vue"
import CategoryDistributionSection from "./CategoryDistributionSection.vue"
import OverviewCards from "./OverviewCards.vue"
import PendingProjectsSection from "./PendingProjectsSection.vue"
import PlatformSection from "./PlatformSection.vue"
import RepoLinkAuditSection from "./RepoLinkAuditSection.vue"
import StatsToolbar from "./StatsToolbar.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（单对象 prop，由 useGitStats.statsView 产出） */
  stats: StatsView
  /** 仓库链接一致性审计状态（useRepoLinkAudit 产出，透传给 RepoLinkAuditSection） */
  auditRows: RepoLinkAuditRow[]
  auditing: boolean
  audited: boolean
  auditSummary: RepoLinkAuditSummary
  /** 状态数据刷新中（工具条刷新按钮转圈禁用） */
  refreshing: boolean
  /** 上次状态快照刷新完成时间（ISO，空串 = 尚未手动刷新过） */
  refreshedAt: string
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
  runAudit: []
  refresh: []
}>()

/**
 * 待处理项目排行行视图：按待推送提交数降序（上游 pendingProjects 已按 totalAhead 优先排序），
 * 条形宽度相对最大值，计数列展示待推送提交数（hover 保留完整本地路径）。
 */
const pendingRows = computed(() =>
  withBarPct(props.stats.pendingProjects.map((p) => ({
    id: p.project.id,
    name: p.project.name,
    path: p.project.path,
    count: p.totalAhead,
  }))),
)
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
