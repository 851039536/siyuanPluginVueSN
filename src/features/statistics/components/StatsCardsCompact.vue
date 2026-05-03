<template>
  <div class="stats-grid">
    <div v-for="item in statsItems" :key="item.label" class="stat-item" :class="item.variant">
      <span class="stat-icon">{{ item.icon }}</span>
      <div class="stat-data">
        <div class="value-row">
          <span class="stat-value">{{ item.value }}</span>
          <span v-if="item.change !== null" class="change" :class="item.change > 0 ? 'up' : 'down'">
            {{ formatChange(item.change) }}
          </span>
        </div>
        <span class="stat-label">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatNumber, formatShortNumber } from "../utils";

interface Props {
  totalNotes?: number;
  totalWords?: number;
  totalBlocks?: number;
  totalAssets?: number;
  totalImages?: number;
  totalTags?: number;
  totalBacklinks?: number;
  todayCreated?: number;
  todayModified?: number;
  avgWordsPerDoc?: number;
  createdChange?: number | null;
  modifiedChange?: number | null;
  i18n?: {
    totalNotes: string;
    totalWords: string;
    totalBlocks: string;
    totalAssets: string;
    totalImages: string;
    totalTags: string;
    totalBacklinks: string;
    todayCreated: string;
    todayModified: string;
    avgWordsPerDoc: string;
  };
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
  }),
});

const statsItems = computed(() => [
  { icon: "📓", value: formatNumber(props.totalNotes), label: props.i18n.totalNotes, variant: "primary" as const, change: null as number | null },
  { icon: "✍️", value: formatNumber(props.totalWords), label: props.i18n.totalWords, variant: "primary" as const, change: null },
  { icon: "📅", value: String(props.todayCreated), label: props.i18n.todayCreated, change: props.createdChange },
  { icon: "✏️", value: String(props.todayModified), label: props.i18n.todayModified, change: props.modifiedChange },
  { icon: "📊", value: String(props.avgWordsPerDoc), label: props.i18n.avgWordsPerDoc, change: null },
  { icon: "🧩", value: formatShortNumber(props.totalBlocks), label: props.i18n.totalBlocks, variant: "secondary" as const, change: null },
  { icon: "📎", value: formatShortNumber(props.totalAssets), label: props.i18n.totalAssets, variant: "secondary" as const, change: null },
  { icon: "🖼️", value: formatShortNumber(props.totalImages), label: props.i18n.totalImages, variant: "secondary" as const, change: null },
  { icon: "🏷️", value: formatShortNumber(props.totalTags), label: props.i18n.totalTags, variant: "secondary" as const, change: null },
  { icon: "🔗", value: formatShortNumber(props.totalBacklinks), label: props.i18n.totalBacklinks, variant: "secondary" as const, change: null },
]);

function formatChange(change: number | null): string {
  if (!change) return "";
  return (change > 0 ? "↑" : "↓") + Math.abs(change).toFixed(0) + "%";
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../styles/index.scss" as stats;

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: var(--b3-border-color);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--b3-theme-surface);
}

.stat-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.stat-data {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-family: $font-heading;
  font-size: 15px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
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

// 核心数据
.stat-item.primary {
  background: rgba(var(--b3-theme-primary-rgb), 0.06);

  .stat-icon { font-size: 22px; }
  .stat-value { font-size: 18px; }
}

// 次要统计
.stat-item.secondary {
  .stat-icon { font-size: 14px; opacity: 0.7; }
  .stat-value { font-size: 13px; }
  .stat-label { font-size: 9px; }
}

@include mobile-only {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);

    .stat-item.primary { grid-column: span 2; }
    .stat-item.secondary:nth-child(10) { grid-column: span 2; }
  }
}
</style>
