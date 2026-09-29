<!-- gitPush 统计视图健康概览（推送状态分布条 + 精简 KPI 行，替代原「6 张 KPI 卡 + 4 个 chips」的双重计数堆叠） -->
<template>
  <div class="gps-health">
    <!-- 推送状态分布：一条按项目数占比分段的横向条（四态合计 = 项目总数），下方为四态图例 -->
    <div
      v-if="visibleSegments.length > 0"
      class="gps-health-bar"
      :title="distributionTitle"
    >
      <span
        v-for="seg in visibleSegments"
        :key="seg.key"
        class="gps-health-seg"
        :class="`gps-health-seg--${seg.cls}`"
        :style="{ flexGrow: seg.value }"
        :title="`${seg.label} ${seg.value}`"
      />
    </div>

    <!-- 四态图例：色点 + 状态名 + 计数（与上方分布条同源，作为可读的数值补充） -->
    <div class="gps-health-legend">
      <span
        v-for="seg in distribution"
        :key="seg.key"
        class="gps-health-legend-item"
        :class="{ 'gps-health-legend-item--zero': seg.value === 0 }"
      >
        <span
          class="gps-health-dot"
          :class="`gps-health-dot--${seg.cls}`"
        />
        <span class="gps-health-legend-label">{{ seg.label }}</span>
        <span class="gps-health-legend-value">{{ seg.value }}</span>
      </span>
    </div>

    <!-- 精简 KPI 行：只保留「需要行动」与「资产盘点」两组，去掉与图例重复的待推送/无远程 -->
    <div class="gps-health-kpis">
      <span
        v-for="kpi in kpis"
        :key="kpi.key"
        class="gps-health-kpi"
      >
        <Icon
          :icon="kpi.icon"
          height="12"
          class="gps-health-kpi-icon"
          :class="kpi.cls"
        />
        <span class="gps-health-kpi-value">{{ kpi.value }}</span>
        <span class="gps-health-kpi-label">{{ kpi.label }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 健康概览：把原「KPI 卡片 + 推送状态 chips + 平台覆盖率条」三处同源计数收敛为
// 「一条分布条 + 一行图例 + 一行精简 KPI」，解决同一数字在页面上重复出现多次的问题。
// 待推送计数已由图例承载，KPI 行不再重复；平台覆盖率移入平台区块标题旁的行内汇总。
import type { StatsView } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 pushStatusStats / projectCount / 未提交与盘点计数） */
  stats: StatsView
}>()

// 推送状态四态配置：顺序 = 分布条从左到右的分段顺序（问题态在前，一眼先看到需要处理的部分）
const STATUS_SEGMENTS = [
  { key: "ahead", cls: "ahead", labelKey: "needsPush" },
  { key: "behind", cls: "behind", labelKey: "needsPullShort" },
  { key: "synced", cls: "synced", labelKey: "synced" },
  { key: "noRemote", cls: "none", labelKey: "noRemoteLabel" },
] as const

/** 分布分段视图：四态计数（label 按 i18n 预渲染），合计即项目总数 */
const distribution = computed(() =>
  STATUS_SEGMENTS.map((s) => ({
    key: s.key,
    cls: s.cls,
    label: props.i18n[s.labelKey],
    value: props.stats.pushStatusStats[s.key],
  })),
)

/** 分布条可见分段：零值态不渲染（flexGrow=0 虽无宽度，但仍会占去一段 gap 缝） */
const visibleSegments = computed(() => distribution.value.filter((s) => s.value > 0))

/** 分布条整体 tooltip：四态计数单行汇总（条本身过窄时仍可读） */
const distributionTitle = computed(() =>
  distribution.value.map((s) => `${s.label} ${s.value}`).join(" · "),
)

/** 精简 KPI：未提交变更（需行动）+ 收藏/归档（盘点），待推送与无远程已由图例承载故不重复 */
const kpis = computed(() => [
  {
    key: "uncommitted",
    icon: "mdi:file-document-edit-outline",
    cls: "gps-health-kpi-icon--accent",
    value: props.stats.uncommittedCount,
    label: props.i18n.uncommitted,
  },
  {
    key: "starred",
    icon: "mdi:star-outline",
    cls: "gps-health-kpi-icon--star",
    value: props.stats.starredCount,
    label: props.i18n.starred,
  },
  {
    key: "archived",
    icon: "mdi:archive-outline",
    cls: "gps-health-kpi-icon--muted",
    value: props.stats.archivedCount,
    label: props.i18n.archivedTitle,
  },
])
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
