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
            :class="item.change > 0 ? 'up' : 'down'"
          >{{ formatChange(item.change) }}</span>
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
  i18n?: {
    overview?: string
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
    change: null as number | null,
  },
  {
    value: formatNumber(props.totalWords),
    label: props.i18n.totalWords,
    unitText: formatChineseUnit(props.totalWords),
    change: null,
  },
  {
    value: String(props.todayCreated),
    label: props.i18n.todayCreated,
    unitText: "",
    change: props.createdChange,
  },
])

const secondaryItems = computed(() => [
  {
    value: String(props.todayModified),
    label: props.i18n.todayModified,
  },
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

.stats-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.stats-title {
  margin: 0;
  font-family: $font-heading;
  font-size: 13px;
  font-weight: 700;
  color: var(--b3-theme-on-surface);
  display: flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: "";
    display: inline-block;
    width: 3px;
    height: 14px;
    background: var(--b3-theme-primary);
    border-radius: 2px;
  }
}

// 核心指标：3 列大卡片
.core-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.core-card {
  @include stats.stats-card-base;
  display: flex;
  flex-direction: column;
  padding: 10px 8px;
  text-align: center;
}

.core-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  margin-bottom: 4px;
}

.core-value-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.core-value {
  font-family: $font-heading;
  font-size: 20px;
  font-weight: 800;
  color: var(--b3-theme-primary);
  line-height: 1.2;
}

.core-unit {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  white-space: nowrap;
}

.core-change {
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.4;
}

.core-change.up {
  background: rgba(stats.$color-success, 0.15);
  color: stats.$color-success;
}

.core-change.down {
  background: rgba(stats.$color-danger, 0.15);
  color: stats.$color-danger;
}

// 次要指标：紧凑网格
.secondary-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: var(--b3-border-color);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.secondary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 2px;
  background: var(--b3-theme-surface);
  text-align: center;
}

.secondary-value {
  font-family: $font-heading;
  font-size: 13px;
  font-weight: 700;
  color: var(--b3-theme-on-surface);
  line-height: 1.2;
}

.secondary-label {
  font-size: 8px;
  color: var(--b3-theme-on-surface);
  opacity: 0.45;
  margin-top: 2px;
}

@include mobile-only {
  .core-cards {
    grid-template-columns: repeat(3, 1fr);
  }

  .secondary-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
