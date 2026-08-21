<!-- gitPush 统计视图分类分布区块（各分类项目数条形，用 category.color 着色） -->
<template>
  <div
    v-if="stats.categoryDistribution.length > 0"
    class="gp-stats-section"
  >
    <div class="gp-stats-section-title">
      <!-- 区块标题："分类分布" -->
      {{ i18n.categoryDistribution }}
    </div>
    <div class="gp-coverage-list">
      <!-- 分类条目：分类色点 + 名称 + 计数；hover 显示百分比 -->
      <div
        v-for="c in stats.categoryDistribution"
        :key="c.id"
        class="gp-coverage-item"
        :title="ratioPct(c.count, stats.projectCount)"
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
            :style="{ width: ratioPct(c.count, stats.projectCount), background: c.color }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 统计视图分类分布区块（category.color 着色的项目数条形）
import type { StatsView } from "../../types"
import { ratioPct } from "../../utils"

defineProps<{
  i18n: Record<string, any>
  /** 统计聚合视图（取 categoryDistribution + projectCount） */
  stats: StatsView
}>()
</script>

<style lang="scss">
@use "../../styles/StatsPanel.scss";
@use "../../styles/index.scss";
</style>
