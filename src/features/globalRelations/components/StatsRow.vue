<!-- 统计卡片行：关系总数 / 涉及文档 / 双向关系 / 单向关系 -->
<template>
  <div class="gr-stats">
    <!-- 标签："关系总数" -->
    <div class="gr-stat-card">
      <span class="gr-stat-card__value">{{ stats.total }}</span>
      <span class="gr-stat-card__label">{{ i18n.totalRelations }}</span>
    </div>
    <!-- 标签："涉及文档" -->
    <div class="gr-stat-card">
      <span class="gr-stat-card__value">{{ stats.docs }}</span>
      <span class="gr-stat-card__label">{{ i18n.involvedDocs }}</span>
    </div>
    <!-- 标签："双向关系" -->
    <div class="gr-stat-card gr-stat-card--bidirectional">
      <span class="gr-stat-card__value">{{ stats.bidirectional }}</span>
      <span class="gr-stat-card__label">{{ i18n.bidirectionalCount }}</span>
    </div>
    <!-- 标签："单向关系" -->
    <div class="gr-stat-card">
      <span class="gr-stat-card__value">{{ stats.unidirectional }}</span>
      <span class="gr-stat-card__label">{{ i18n.unidirectionalCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GlobalRelationsI18n } from "../types"

interface Props {
  /** 统计数值集合（由 composable 计算） */
  stats: {
    total: number
    docs: number
    bidirectional: number
    unidirectional: number
  }
  i18n: GlobalRelationsI18n
}

defineProps<Props>()
</script>

<style scoped lang="scss">
@use "../styles/StatsRow.scss";
</style>
