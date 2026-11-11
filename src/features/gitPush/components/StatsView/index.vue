<!-- gitPush 统计中心 · 项目状态分区入口容器（工具条 + 健康概览 + 待处理清单 + 平台矩阵，纯编排无领域状态） -->
<template>
  <div class="gps-panel">
    <!-- 空状态：无项目时显示"暂无项目统计" -->
    <EmptyState
      v-if="stats.projectCount === 0"
      icon="mdi:chart-bar"
      :text="i18n.noProjectsStats"
    />

    <template v-else>
      <!-- 顶部工具条：快照状态文案 + 刷新全部项目状态（复用分析类统一工具条外壳） -->
      <AnalysisToolbar
        :i18n="i18n"
        :status-text="statusText"
        :show-run="false"
        :aria-label="i18n.statsStatusTab"
      >
        <template #controls>
          <!-- 未加载态也保留分支一致性入口（加载后入口在平台区块标题右侧，避免同屏重复） -->
          <Button
            v-if="!loaded"
            variant="ghost"
            size="xsmall"
            icon="sourceBranchCheck"
            :title="i18n.consistencyTitle"
            :aria-label="i18n.consistencyTitle"
            @click="emit('openConsistency')"
          />
          <Button
            variant="ghost"
            size="xsmall"
            :icon="loaded ? 'refresh' : 'downloadOutline'"
            :loading="refreshing || loading"
            :disabled="refreshing || loading"
            :title="loaded ? i18n.refreshAll : i18n.statsLoadAction"
            @click="onPrimaryAction"
          />
        </template>
      </AnalysisToolbar>

      <!-- 未加载空态：进入页面不自动刷新，由用户点击加载（同会话内已加载过则直接展示） -->
      <EmptyState
        v-if="!loaded"
        icon="mdi:cloud-download-outline"
        :text="i18n.statsNotLoaded"
      >
        <template #action>
          <Button
            class="gp-empty-action"
            variant="primary"
            icon="downloadOutline"
            :loading="loading"
            :disabled="loading || refreshing"
            @click="emit('load')"
          >
            {{ i18n.statsLoadAction }}
          </Button>
        </template>
      </EmptyState>

      <template v-else>
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

        <!-- 平台区块（覆盖率行内汇总 + 链接校验问题 + 每项目平台配置/一致性矩阵 + 分支一致性入口） -->
        <PlatformSection
          :i18n="i18n"
          :stats="stats"
          :audit-rows="auditRows"
          :auditing="auditing"
          @view-project="emit('viewProject', $event)"
          @open-consistency="emit('openConsistency')"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
// gitPush 统计中心 · 项目状态分区入口容器：三层信息架构，从概览到明细自上而下收敛。
//   1. 健康概览  —— 一眼看全局（状态分布 + 需行动计数）
//   2. 待处理清单 —— 唯一一份可行动列表（点击跳项目）
//   3. 平台矩阵  —— 配置与链接一致性明细
// 原先「KPI 卡 + chips + 覆盖率条 + 矩阵」的平铺堆叠把同一批计数重复渲染了三遍，
// 且待处理项目同时以条形排行和表格出现两次；现按「概览 / 行动 / 明细」重新分层。
import type { RepoLinkAuditRow, StatsView } from "../../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { statsStatusText } from "../../utils"
import { fmtTemplate } from "../../utils/i18nFormat"
import AnalysisToolbar from "../common/AnalysisToolbar.vue"
import EmptyState from "../common/EmptyState.vue"
import HealthOverview from "./HealthOverview.vue"
import PendingProjectsSection from "./PendingProjectsSection.vue"
import PlatformSection from "./PlatformSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（单对象 prop，由 useGitStats.statsView 产出） */
  stats: StatsView
  /** 项目 id → 仓库链接一致性校验行（useRepoLinkAudit 产出，自动后台执行，透传给 PlatformSection） */
  auditRows: Record<string, RepoLinkAuditRow>
  /** 链接一致性校验进行中 */
  auditing: boolean
  /** 状态数据刷新中（工具条刷新按钮转圈禁用） */
  refreshing: boolean
  /** 首屏后台状态加载中（预算到期后仍在补齐剩余项目） */
  loading: boolean
  /** 首屏后台加载进度（仅状态文案使用；total 为 0 时回退到“加载中”） */
  loadingProgress: { done: number, total: number }
  /** 是否已由用户触发过加载（false = 进入页面后的未加载空态） */
  loaded: boolean
  /** 上次状态快照刷新完成时间（ISO，空串 = 尚未手动刷新过） */
  refreshedAt: string
}>()

const emit = defineEmits<{
  viewProject: [projectId: string]
  refresh: []
  /** 手动首次加载（进入页面不自动刷新） */
  load: []
  /** 打开「分支一致性分析」弹窗（入口位于平台区块标题右侧） */
  openConsistency: []
}>()

/** 工具条主按钮：未加载时触发加载，已加载时触发全量刷新 */
function onPrimaryAction() {
  if (props.loaded) emit("refresh")
  else emit("load")
}

/** 快照状态文案：加载中（含进度）→ 未加载 → 刷新中 → 上次刷新相对时间 → 项目总数 */
const statusText = computed(() => {
  if (props.loading) {
    if (props.loadingProgress.total > 0) {
      return fmtTemplate(
        props.i18n.statsLoadingProgress,
        String(props.loadingProgress.done),
        String(props.loadingProgress.total),
      )
    }
    return props.i18n.loadingLabel
  }
  if (!props.loaded) return props.i18n.statsNotLoadedShort
  return statsStatusText({
    refreshing: props.refreshing,
    refreshedAt: props.refreshedAt,
    projectCount: props.stats.projectCount,
    i18n: props.i18n,
  })
})
</script>
