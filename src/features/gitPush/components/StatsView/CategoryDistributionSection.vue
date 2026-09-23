<!-- gitPush 统计视图分类分布区块（各分类项目数条形，用 category.color 着色） -->
<template>
  <StatsSection
    v-if="categoryRows.length > 0"
    :title="i18n.categoryDistribution"
  >
    <!-- 分类条目：分类色点 + 名称 + 计数（hover 显示项目数明细与占比） -->
    <div class="gps-bar-list">
      <div
        v-for="c in categoryRows"
        :key="c.id"
        class="gps-bar-row"
      >
        <span
          class="gps-bar-label"
          :title="c.name"
        >
          <span
            class="gps-cat-dot"
            :style="{ background: c.color }"
          />
          <span class="gps-bar-text">{{ c.name }}</span>
        </span>
        <span class="gps-bar-track">
          <span
            class="gps-bar-fill"
            :style="{ width: c.pct, background: c.color }"
          />
        </span>
        <span
          class="gps-bar-num"
          :title="c.counts"
        >{{ c.count }}</span>
      </div>
    </div>
  </StatsSection>
</template>

<script setup lang="ts">
// gitPush 统计视图分类分布区块（category.color 着色的项目数条形，右侧计数 + hover 占比明细）
import type { StatsView } from "../../types"
import { computed } from "vue"
import { ratioPct } from "../../utils"
import StatsSection from "./common/StatsSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 categoryDistribution + projectCount） */
  stats: StatsView
}>()

/** 分类分布行视图：预计算占比（条形宽度）与计数明细（hover 提示 "n / total"） */
const categoryRows = computed(() => {
  const total = props.stats.projectCount
  return props.stats.categoryDistribution.map((c) => ({
    ...c,
    pct: ratioPct(c.count, total),
    counts: `${c.count} / ${total}`,
  }))
})
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
