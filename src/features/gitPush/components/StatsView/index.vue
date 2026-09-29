<!-- gitPush 统计视图入口容器（工具条 + 健康概览 + 待处理清单 + 平台矩阵，纯编排无领域状态） -->
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

      <!-- 健康概览：推送状态分布条 + 四态图例 + 精简 KPI（替代原「6 张 KPI 卡 + 4 个同源 chips」） -->
      <HealthOverview
        :i18n="i18n"
        :stats="stats"
      />

      <!-- 待处理清单：全站唯一一份（原「条形排行 + 明细表格」两份同标题同数据渲染已合并） -->
      <PendingProjectsSection
        :i18n="i18n"
        :stats="stats"
        @view-project="emit('viewProject', $event)"
      />

      <!-- 平台区块（覆盖率行内汇总 + 一致性问题汇总 + 每项目平台配置/一致性矩阵） -->
      <PlatformSection
        :i18n="i18n"
        :stats="stats"
        :audit-rows="auditRows"
        :auditing="auditing"
        @view-project="emit('viewProject', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 统计视图入口容器：三层信息架构，从概览到明细自上而下收敛。
//   1. 健康概览  —— 一眼看全局（状态分布 + 需行动计数）
//   2. 待处理清单 —— 唯一一份可行动列表（点击跳项目）
//   3. 平台矩阵  —— 配置与链接一致性明细
// 原先「KPI 卡 + chips + 覆盖率条 + 矩阵」的平铺堆叠把同一批计数重复渲染了三遍，
// 且待处理项目同时以条形排行和表格出现两次；现按「概览 / 行动 / 明细」重新分层。
import type { RepoLinkAuditRow, StatsView } from "../../types"
import EmptyState from "../common/EmptyState.vue"
import HealthOverview from "./HealthOverview.vue"
import PendingProjectsSection from "./PendingProjectsSection.vue"
import PlatformSection from "./PlatformSection.vue"
import StatsToolbar from "./StatsToolbar.vue"

defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（单对象 prop，由 useGitStats.statsView 产出） */
  stats: StatsView
  /** 项目 id → 仓库链接一致性校验行（useRepoLinkAudit 产出，自动后台执行，透传给 PlatformSection） */
  auditRows: Record<string, RepoLinkAuditRow>
  /** 链接一致性校验进行中 */
  auditing: boolean
  /** 状态数据刷新中（工具条刷新按钮转圈禁用） */
  refreshing: boolean
  /** 上次状态快照刷新完成时间（ISO，空串 = 尚未手动刷新过） */
  refreshedAt: string
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
  refresh: []
}>()
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
