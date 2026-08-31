<!-- 核心指标卡片：概览总览（核心大卡 + 次要紧凑网格） -->
<template>
  <div class="stats-section">
    <!-- 核心指标：4 列大卡片 -->
    <div class="core-cards">
      <div
        v-for="item in coreItems"
        :key="item.label"
        class="core-card"
      >
        <span class="core-label">{{ item.label }}</span>
        <div class="core-value-row">
          <span class="core-value">{{ item.value }}</span>
          <span
            v-if="item.change !== null"
            class="core-change"
            :class="item.change > 0 ? 'up' : (item.change < 0 ? 'down' : '')"
          >{{ formatChange(item.change, item.isPercent) }}</span>
        </div>
      </div>
    </div>

    <!-- 次要指标：紧凑网格 -->
    <div class="secondary-grid">
      <div
        v-for="item in secondaryItems"
        :key="item.label"
        class="secondary-item"
      >
        <span class="secondary-value">{{ item.value }}</span>
        <span class="secondary-label">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import {
  formatNumber,
  formatShortNumber,
} from "../../utils"

interface Props {
  totalNotes?: number
  totalWords?: number
  totalBlocks?: number
  totalAssets?: number
  totalImages?: number
  totalTags?: number
  totalBacklinks?: number
  todayCreated?: number
  todayModified?: number
  avgWordsPerDoc?: number
  createdChange?: number | null
  modifiedChange?: number | null
  notesChange?: number | null
  wordsChange?: number | null
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  totalNotes: 0,
  totalWords: 0,
  totalBlocks: 0,
  totalAssets: 0,
  totalImages: 0,
  totalTags: 0,
  totalBacklinks: 0,
  todayCreated: 0,
  todayModified: 0,
  avgWordsPerDoc: 0,
  createdChange: null,
  modifiedChange: null,
  notesChange: null,
  wordsChange: null,
  i18n: () => ({}),
})

const coreItems = computed(() => [
  {
    value: formatNumber(props.totalNotes),
    label: props.i18n.totalNotes,
    change: props.notesChange,
    isPercent: false,
  },
  {
    value: formatNumber(props.totalWords),
    label: props.i18n.totalWords,
    change: props.wordsChange,
    isPercent: false,
  },
  {
    value: String(props.todayCreated),
    label: props.i18n.todayCreated,
    change: props.createdChange,
    isPercent: true,
  },
  {
    value: String(props.todayModified),
    label: props.i18n.todayModified,
    change: props.modifiedChange,
    isPercent: true,
  },
])

const secondaryItems = computed(() => [
  {
    value: String(props.avgWordsPerDoc),
    label: props.i18n.avgWordsPerDoc,
  },
  {
    value: formatShortNumber(props.totalBlocks),
    label: props.i18n.totalBlocks,
  },
  {
    value: formatShortNumber(props.totalAssets),
    label: props.i18n.totalAssets,
  },
  {
    value: formatShortNumber(props.totalImages),
    label: props.i18n.totalImages,
  },
  {
    value: formatShortNumber(props.totalTags),
    label: props.i18n.totalTags,
  },
  {
    value: formatShortNumber(props.totalBacklinks),
    label: props.i18n.totalBacklinks,
  },
])

// 涨跌角标：isPercent 时追加 % 后缀，否则显示绝对值
function formatChange(change: number | null, isPercent: boolean): string {
  if (change === null) return ""
  if (change === 0) return isPercent ? "0%" : "0"
  const prefix = change > 0 ? "↑" : "↓"
  const value = isPercent ? Math.abs(change).toFixed(0) : String(Math.abs(change))
  return `${prefix}${value}${isPercent ? "%" : ""}`
}
</script>

<style scoped lang="scss">
@use "../../styles/StatsCardsCompact.scss";
@use '../../styles/index.scss' as stats;
</style>
