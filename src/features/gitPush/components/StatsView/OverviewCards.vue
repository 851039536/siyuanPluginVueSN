<!-- gitPush 统计视图总览卡片区（总项目数/已配远程/待推送/未提交/收藏/已归档，配置驱动） -->
<template>
  <div class="gp-stats-cards">
    <!-- 总览卡片：6 张指标卡（配置驱动，卡片类名区分语义色） -->
    <div
      v-for="(card, i) in overviewCards"
      :key="i"
      class="gp-stat-card"
      :class="card.cls"
    >
      <div class="gp-stat-card-value">
        {{ card.value }}
      </div>
      <div class="gp-stat-card-label">
        {{ card.label }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 统计视图总览卡片区（6 张指标卡配置驱动渲染）
import type { StatsView } from "../../types"
import { computed } from "vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 projectCount/remoteCoverage/pushStatusStats/各计数） */
  stats: StatsView
}>()

/** 总览卡片配置：总项目数 / 已配远程 / 待推送 / 未提交 / 收藏 / 已归档 */
const overviewCards = computed(() => [
  { value: props.stats.projectCount, label: props.i18n.totalProjects, cls: "" },
  { value: props.stats.remoteCoverage.hasRemote, label: props.i18n.remoteConfigured, cls: "gp-stat-card--info" },
  { value: props.stats.pushStatusStats.ahead, label: props.i18n.needsPush, cls: "gp-stat-card--warn" },
  { value: props.stats.uncommittedCount, label: props.i18n.uncommitted, cls: "gp-stat-card--accent" },
  // 收藏卡："收藏"（与列表星标按钮同色）
  { value: props.stats.starredCount, label: props.i18n.starred, cls: "gp-stat-card--star" },
  // 归档卡："已归档"（弱化展示）
  { value: props.stats.archivedCount, label: props.i18n.archivedTitle, cls: "gp-stat-card--muted" },
])
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
