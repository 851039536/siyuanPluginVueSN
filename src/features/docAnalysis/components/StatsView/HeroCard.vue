<!-- 文档分析功能 - Hero 汇总卡组件（总文档 + 健康度，问题详情由下方统计表格展示） -->
<template>
  <div class="hero-card">
    <div class="hero-top">
      <div class="hero-left">
        <span class="hero-label">总文档</span>
        <span class="hero-value">{{ stats.totalDocs }}</span>
      </div>
      <div class="hero-right">
        <span class="hero-health-label">健康度</span>
        <div
          class="hero-health-bar"
          :title="healthTooltip"
        >
          <div
            class="hero-health-fill"
            :style="{ width: `${healthPct}%` }"
          />
        </div>
        <span
          class="hero-health-value"
          :title="healthTooltip"
        >{{ healthPct.toFixed(2) }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DocStats } from "../../types/index"

interface Props {
  stats: DocStats
  healthPct: number
  healthTooltip: string
}

defineProps<Props>()
</script>

<style lang="scss" scoped>
@use "../../styles/HeroCard.scss";
</style>
