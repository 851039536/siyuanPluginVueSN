<!-- gitPush 统计视图总览区（KPI 卡片 + 推送状态概要 chips，配置驱动） -->
<template>
  <div class="gp-overview">
    <!-- KPI 卡片网格（总项目数/已配远程/待推送/未提交/收藏/已归档） -->
    <StatCardGrid
      :min-width="110"
      :cards="overviewCards"
    />

    <!-- 推送状态概要：待推送/待拉取/已同步/无远程（即「待处理项目」区块原本的 chip 条，
         信息与上方「待推送」卡片同源，移到这里与汇总卡并列，避免同一批计数在页面上出现两次标题） -->
    <StatusChipBar
      :i18n="i18n"
      :chips="statusChips"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 统计视图总览区（6 张指标卡 + 推送状态 chips，配置驱动渲染）
import type { StatsView } from "../../types"
import type { StatCardItem } from "../common/StatCardGrid.vue"
import { computed } from "vue"
import StatCardGrid from "../common/StatCardGrid.vue"
import StatusChipBar from "./common/StatusChipBar.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 projectCount/remoteCoverage/pushStatusStats/各计数） */
  stats: StatsView
}>()

/** 总览卡片配置：总项目数 / 已配远程 / 待推送 / 未提交 / 收藏 / 已归档（cls 决定数值语义色） */
const overviewCards = computed<StatCardItem[]>(() => [
  { key: "projects", value: props.stats.projectCount, label: props.i18n.totalProjects },
  { key: "remote", value: props.stats.remoteCoverage.hasRemote, label: props.i18n.remoteConfigured, cls: "gp-statgrid-card--info" },
  { key: "ahead", value: props.stats.pushStatusStats.ahead, label: props.i18n.needsPush, cls: "gp-statgrid-card--warn" },
  { key: "uncommitted", value: props.stats.uncommittedCount, label: props.i18n.uncommitted, cls: "gp-statgrid-card--accent" },
  // 收藏卡："收藏"（与列表星标按钮同色系）
  { key: "starred", value: props.stats.starredCount, label: props.i18n.starred, cls: "gp-statgrid-card--star" },
  // 归档卡："已归档"（弱化展示）
  { key: "archived", value: props.stats.archivedCount, label: props.i18n.archivedTitle, cls: "gp-statgrid-card--muted" },
])

// 推送状态 chip 配置：待推送/待拉取/已同步/无远程（labelKey 复用现有 i18n 键作 hover 提示）
const STATUS_CHIPS = [
  { key: "ahead", icon: "mdi:cloud-upload-outline", cls: "ahead", labelKey: "needsPush" },
  { key: "behind", icon: "mdi:cloud-download-outline", cls: "behind", labelKey: "needsPullShort" },
  { key: "synced", icon: "mdi:check-circle-outline", cls: "synced", labelKey: "synced" },
  { key: "noRemote", icon: "mdi:lan-disconnect", cls: "none", labelKey: "noRemoteLabel" },
] as const

/** chip 数值视图：从推送状态统计取数 */
const statusChips = computed(() =>
  STATUS_CHIPS.map((c) => ({ ...c, value: props.stats.pushStatusStats[c.key] })),
)
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
