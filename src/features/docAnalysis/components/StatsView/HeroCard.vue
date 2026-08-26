<!-- 文档分析功能 - Hero 汇总卡组件（总文档 + 健康度 + 问题速览，健康度配置已收敛到设置弹窗） -->
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
    <!-- 问题速览（徽章行） -->
    <div
      v-if="hasIssues"
      class="hero-issues"
    >
      <div
        v-if="stats.zeroByteDocs"
        class="issue-item critical"
        @click="$emit('selectCategory', '0B')"
      >
        <span class="issue-value">{{ stats.zeroByteDocs }}</span>
        <span class="issue-label">0B空</span>
      </div>
      <div
        v-if="effectiveDupDocs > 0"
        class="issue-item warn"
        @click="$emit('selectCategory', 'duplicate')"
      >
        <span class="issue-value">{{ effectiveDupDocs }}</span>
        <span class="issue-label">重名</span>
      </div>
      <div
        v-if="stats.orphanDocs"
        class="issue-item critical"
        @click="$emit('selectCategory', 'orphanDoc')"
      >
        <span class="issue-value">{{ stats.orphanDocs }}</span>
        <span class="issue-label">孤文档</span>
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
  hasIssues: boolean
  effectiveDupDocs: number
}

defineProps<Props>()

defineEmits<{
  (e: "selectCategory", category: string): void
}>()
</script>

<style lang="scss" scoped>
@use "../../styles/HeroCard.scss";
</style>
