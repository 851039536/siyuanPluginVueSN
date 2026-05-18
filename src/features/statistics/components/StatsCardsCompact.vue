<template>
  <div class="stats-cards-wrapper">
    <!-- 核心指标横幅（常驻） -->
    <div class="core-metrics">
      <div
        v-for="item in coreItems"
        :key="item.label"
        class="core-item"
      >
        <span class="core-icon">{{ item.icon }}</span>
        <div class="core-data">
          <span class="core-value">{{ item.value }}</span>
          <span class="core-label">{{ item.label }}</span>
        </div>
      </div>
    </div>

    <!-- 次要指标（折叠） -->
    <CollapsibleSection
      :title="i18n.moreStats || '详细统计'"
      :badge="`${secondaryItems.length}项`"
    >
      <div class="secondary-grid">
        <div
          v-for="item in secondaryItems"
          :key="item.label"
          class="stat-item secondary"
        >
          <span class="stat-icon">{{ item.icon }}</span>
          <div class="stat-data">
            <div class="value-row">
              <span class="stat-value">{{ item.value }}</span>
              <span
                v-if="item.change !== null"
                class="change"
                :class="item.change > 0 ? 'up' : 'down'"
              >
                {{ formatChange(item.change) }}
              </span>
            </div>
            <span class="stat-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import {
  formatNumber,
  formatShortNumber,
} from "../utils"
import CollapsibleSection from "./CollapsibleSection.vue"

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

const coreItems = computed(() => [
  {
    icon: "📓",
    value: formatNumber(props.totalNotes),
    label: props.i18n.totalNotes,
  },
  {
    icon: "✍️",
    value: formatShortNumber(props.totalWords),
    label: props.i18n.totalWords,
  },
  {
    icon: "📊",
    value: String(props.avgWordsPerDoc),
    label: props.i18n.avgWordsPerDoc,
  },
])

const secondaryItems = computed(() => [
  {
    icon: "📅",
    value: String(props.todayCreated),
    label: props.i18n.todayCreated,
    change: props.createdChange,
  },
  {
    icon: "✏️",
    value: String(props.todayModified),
    label: props.i18n.todayModified,
    change: props.modifiedChange,
  },
  {
    icon: "🧩",
    value: formatShortNumber(props.totalBlocks),
    label: props.i18n.totalBlocks,
    change: null as number | null,
  },
  {
    icon: "📎",
    value: formatShortNumber(props.totalAssets),
    label: props.i18n.totalAssets,
    change: null,
  },
  {
    icon: "🖼️",
    value: formatShortNumber(props.totalImages),
    label: props.i18n.totalImages,
    change: null,
  },
  {
    icon: "🏷️",
    value: formatShortNumber(props.totalTags),
    label: props.i18n.totalTags,
    change: null,
  },
  {
    icon: "🔗",
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
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../styles/index.scss" as stats;

.stats-cards-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// 核心指标横幅
.core-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.core-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
}

.core-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.core-data {
  flex: 1;
  min-width: 0;
}

.core-value {
  font-family: $font-heading;
  font-size: 18px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  line-height: 1.2;
  display: block;
}

.core-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

// 次要指标
.secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--b3-border-color);
  border-radius: 8px;
  overflow: hidden;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--b3-theme-surface);
}

.stat-icon {
  font-size: 14px;
  flex-shrink: 0;
  opacity: 0.7;
}

.stat-data {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-family: $font-heading;
  font-size: 13px;
  font-weight: 700;
  color: var(--b3-theme-on-surface);
  line-height: 1.2;
}

.stat-label {
  font-size: 9px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.value-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.change {
  padding: 1px 4px;
  border-radius: 6px;
  font-size: 8px;
  font-weight: 700;
}

.change.up {
  background: rgba(stats.$color-success, 0.15);
  color: stats.$color-success;
}

.change.down {
  background: rgba(stats.$color-danger, 0.15);
  color: stats.$color-danger;
}

@include mobile-only {
  .core-metrics {
    grid-template-columns: 1fr;
  }

  .secondary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
