<!-- gitPush 统计视图分类分布区块（各分类项目数条形，用 category.color 着色） -->
<template>
  <StatsSection
    v-if="stats.categoryDistribution.length > 0"
    :title="i18n.categoryDistribution"
  >
    <!-- 区块标题："分类分布" -->
    <div class="gp-coverage-list">
      <!-- 分类条目：分类色点 + 名称 + 计数；hover 显示百分比 -->
      <div
        v-for="c in categoryRows"
        :key="c.id"
        class="gp-coverage-item"
        :title="c.pct"
      >
        <div class="gp-coverage-head">
          <span
            class="gp-cat-dot"
            :style="{ background: c.color }"
          />
          <span>{{ c.name }}</span>
          <span class="gp-coverage-num">{{ c.count }} / {{ stats.projectCount }}</span>
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

/** 分类分布行视图：预计算条形宽度百分比，消除模板中每条目 2 次 ratioPct 调用 */
const categoryRows = computed(() => {
  const total = props.stats.projectCount
  return props.stats.categoryDistribution.map((c) => ({ ...c, pct: ratioPct(c.count, total) }))
})
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
