<template>
  <div class="stats-section">
    <h3 class="stats-title">📊 总览</h3>
    <div class="stats-cards-wrapper">
      <div
        v-for="item in allItems"
        :key="item.label"
        class="stats-item"
      >
      <div class="stats-value-row">
        <span class="stats-value">{{ item.value }}</span>
        <span
          v-if="item.change !== null"
          class="stats-change"
          :class="item.change > 0 ? 'up' : 'down'"
        >{{ formatChange(item.change) }}</span>
      </div>
      <span class="stats-label">{{ item.label }}</span>
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
  i18n?: {
    totalNotes: string
    totalWords: string
    totalBlocks: string
    totalAssets: string
    totalImages: string
    totalTags: string
    totalBacklinks: string
    todayCreated: string
    todayModified: string
    avgWordsPerDoc: string
    moreStats?: string
  }
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
  i18n: () => ({
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

const allItems = computed(() => [
  {
    value: formatNumber(props.totalNotes),
    label: props.i18n.totalNotes,
    change: null as number | null,
  },
  {
    value: formatShortNumber(props.totalWords),
    label: props.i18n.totalWords,
    change: null,
  },
  {
    value: String(props.avgWordsPerDoc),
    label: props.i18n.avgWordsPerDoc,
    change: null,
  },
  {
    value: String(props.todayCreated),
    label: props.i18n.todayCreated,
    change: props.createdChange,
  },
  {
    value: String(props.todayModified),
    label: props.i18n.todayModified,
    change: props.modifiedChange,
  },
  {
    value: formatShortNumber(props.totalBlocks),
    label: props.i18n.totalBlocks,
    change: null,
  },
  {
    value: formatShortNumber(props.totalAssets),
    label: props.i18n.totalAssets,
    change: null,
  },
  {
    value: formatShortNumber(props.totalImages),
    label: props.i18n.totalImages,
    change: null,
  },
  {
    value: formatShortNumber(props.totalTags),
    label: props.i18n.totalTags,
    change: null,
  },
  {
    value: formatShortNumber(props.totalBacklinks),
    label: props.i18n.totalBacklinks,
    change: null,
  },
])

function formatChange(change: number | null): string {
  if (change === null) return ""
  const prefix = change > 0 ? "↑" : "↓"
  const absVal = Math.abs(change)
  return `${prefix}${absVal.toFixed(0)}%`
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/shared" as *;
@use "../styles/index.scss" as stats;

.stats-cards-wrapper {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: var(--b3-border-color);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.stats-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
  background: var(--b3-theme-surface);
  text-align: center;
}

.stats-value-row {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.stats-value {
  font-family: $font-heading;
  font-size: 15px;
  font-weight: 700;
  color: var(--b3-theme-on-surface);
  line-height: 1.2;
}

.stats-label {
  font-size: 9px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  margin-top: 2px;
}

.stats-change {
  padding: 1px 3px;
  border-radius: 4px;
  font-size: 8px;
  font-weight: 700;
  line-height: 1.4;
}

.stats-change.up {
  background: rgba(stats.$color-success, 0.15);
  color: stats.$color-success;
}

.stats-change.down {
  background: rgba(stats.$color-danger, 0.15);
  color: stats.$color-danger;
}

@include mobile-only {
  .stats-cards-wrapper {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
