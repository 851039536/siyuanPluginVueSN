<!-- gitPush 统计视图分类分布区块（各分类项目数条形，用 category.color 着色） -->
<template>
  <StatsSection
    v-if="stats.categoryDistribution.length > 0"
    :title="i18n.categoryDistribution"
  >
    <!-- 区块标题："分类分布" -->
    <div class="gp-coverage-list">
      <!-- 分类条目：分类色点 + 名称 + 占比；hover 显示项目数明细 -->
      <div
        v-for="c in categoryRows"
        :key="c.id"
        class="gp-coverage-item"
        :title="c.counts"
      >
        <div class="gp-coverage-head">
          <span
            class="gp-cat-dot"
            :style="{ background: c.color }"
          />
          <span>{{ c.name }}</span>
          <span class="gp-coverage-num">{{ c.pct }}</span>
        </div>
        <div class="gp-coverage-bar">
          <div
            class="gp-coverage-fill"
            :style="{ width: c.pct, background: c.color }"
          />
        </div>
      </div>
    </div>
  </StatsSection>
</template>

<script setup lang="ts">
// gitPush 统计视图分类分布区块（category.color 着色的项目数条形）
import type { StatsView } from "../../types"
import { computed } from "vue"
import { ratioPct } from "../../utils"
import StatsSection from "./common/StatsSection.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 categoryDistribution + projectCount） */
  stats: StatsView
}>()

/** 分类分布行视图：预计算占比（右侧显示）与计数明细（hover 提示），消除模板中重复计算 */
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
