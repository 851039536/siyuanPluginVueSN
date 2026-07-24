<!-- 核心指标卡片：概览总览（核心大卡 + 次要紧凑网格） -->
<template>
  <div class="stats-section">
    <h3 class="stats-title">
      {{ i18n.overview || '总览' }}
    </h3>

    <!-- 核心指标：3 列大卡片 -->
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
            v-if="item.unitText"
            class="core-unit"
          >（{{ item.unitText }}）</span>
          <span
            v-if="item.change !== null"
            class="core-change"
            :class="item.change > 0 ? 'up' : (item.change < 0 ? 'down' : '')"
          >{{ item.isPercent ? formatPercent(item.change) : formatDelta(item.change) }}</span>
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
} from "../utils"

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
  i18n: () => ({
    overview: "总览",
    totalNotes: "笔记总数",
    totalWords: "总字数",
    totalBlocks: "内容块",
    totalAssets: "附件",
    totalImages: "图片",
    totalTags: "标签",
    totalBacklinks: "双链",
    todayCreated: "今日新增",
    todayModified: "今日修改",
    avgWordsPerDoc: "平均字数",
    moreStats: "详细统计",
  }),
})

function formatChineseUnit(num: number): string {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}亿`
  } else if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`
  }
  return ""
}

const coreItems = computed(() => [
  {
    value: formatNumber(props.totalNotes),
    label: props.i18n.totalNotes,
    unitText: formatChineseUnit(props.totalNotes),
    change: props.notesChange,
    isPercent: false,
  },
  {
    value: formatNumber(props.totalWords),
    label: props.i18n.totalWords,
    unitText: formatChineseUnit(props.totalWords),
    change: props.wordsChange,
    isPercent: false,
  },
  {
    value: String(props.todayCreated),
    label: props.i18n.todayCreated,
    unitText: "",
    change: props.createdChange,
    isPercent: true,
  },
  {
    value: String(props.todayModified),
    label: props.i18n.todayModified,
    unitText: "",
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

function formatPercent(change: number | null): string {
  if (change === null) return ""
  if (change === 0) return "0%"
  const prefix = change > 0 ? "↑" : "↓"
  return `${prefix}${Math.abs(change).toFixed(0)}%`
}

function formatDelta(change: number | null): string {
  if (change === null) return ""
  if (change === 0) return "0"
  const prefix = change > 0 ? "↑" : "↓"
  return `${prefix}${Math.abs(change)}`
}
</script>

<style scoped lang="scss">
@use "../styles/StatsCardsCompact.scss";
</style>
