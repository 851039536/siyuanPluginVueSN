<template>
  <div class="stats-grid">
    <!-- 核心数据 -->
    <div class="stat-item primary">
      <span class="stat-icon">📓</span>
      <div class="stat-data">
        <span class="stat-value">{{ formatNumber(totalNotes) }}</span>
        <span class="stat-label">{{ i18n.totalNotes }}</span>
      </div>
    </div>
    <div class="stat-item primary">
      <span class="stat-icon">✍️</span>
      <div class="stat-data">
        <span class="stat-value">{{ formatNumber(totalWords) }}</span>
        <span class="stat-label">{{ i18n.totalWords }}</span>
      </div>
    </div>
    <!-- 今日动态 -->
    <div class="stat-item">
      <span class="stat-icon">📅</span>
      <div class="stat-data">
        <div class="value-row">
          <span class="stat-value">{{ todayCreated }}</span>
          <span v-if="createdChange !== null" class="change" :class="getChangeClass(createdChange)">
            {{ getChangeArrow(createdChange) }}{{ formatPercent(createdChange) }}
          </span>
        </div>
        <span class="stat-label">{{ i18n.todayCreated }}</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-icon">✏️</span>
      <div class="stat-data">
        <div class="value-row">
          <span class="stat-value">{{ todayModified }}</span>
          <span v-if="modifiedChange !== null" class="change" :class="getChangeClass(modifiedChange)">
            {{ getChangeArrow(modifiedChange) }}{{ formatPercent(modifiedChange) }}
          </span>
        </div>
        <span class="stat-label">{{ i18n.todayModified }}</span>
      </div>
    </div>
    <div class="stat-item">
      <span class="stat-icon">📊</span>
      <div class="stat-data">
        <span class="stat-value">{{ avgWordsPerDoc }}</span>
        <span class="stat-label">{{ i18n.avgWordsPerDoc }}</span>
      </div>
    </div>
    <!-- 次要统计 -->
    <div class="stat-item secondary">
      <span class="stat-icon">🧩</span>
      <div class="stat-data">
        <span class="stat-value">{{ formatShortNumber(totalBlocks) }}</span>
        <span class="stat-label">{{ i18n.totalBlocks }}</span>
      </div>
    </div>
    <div class="stat-item secondary">
      <span class="stat-icon">📎</span>
      <div class="stat-data">
        <span class="stat-value">{{ formatShortNumber(totalAssets) }}</span>
        <span class="stat-label">{{ i18n.totalAssets }}</span>
      </div>
    </div>
    <div class="stat-item secondary">
      <span class="stat-icon">🖼️</span>
      <div class="stat-data">
        <span class="stat-value">{{ formatShortNumber(totalImages) }}</span>
        <span class="stat-label">{{ i18n.totalImages }}</span>
      </div>
    </div>
    <div class="stat-item secondary">
      <span class="stat-icon">🏷️</span>
      <div class="stat-data">
        <span class="stat-value">{{ formatShortNumber(totalTags) }}</span>
        <span class="stat-label">{{ i18n.totalTags }}</span>
      </div>
    </div>
    <div class="stat-item secondary">
      <span class="stat-icon">🔗</span>
      <div class="stat-data">
        <span class="stat-value">{{ formatShortNumber(totalBacklinks) }}</span>
        <span class="stat-label">{{ i18n.totalBacklinks }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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

withDefaults(defineProps<Props>(), {
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

function getChangeClass(change: number | null): string {
	if (!change) return "";
	return change > 0 ? "up" : "down";
}

function getChangeArrow(change: number | null): string {
	if (!change) return "";
	return change > 0 ? "↑" : "↓";
}

function formatPercent(change: number | null): string {
	if (change === null) return "";
	return Math.abs(change).toFixed(0) + "%";
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: var(--b3-border-color);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--b3-theme-surface);

    &.primary {
      background: linear-gradient(135deg, rgba(var(--b3-theme-primary-rgb), 0.08), rgba(var(--b3-theme-primary-rgb), 0.02));

      .stat-icon { font-size: 22px; }
      .stat-value { font-size: 18px; }
    }

    &.secondary {
      .stat-icon { font-size: 14px; opacity: 0.7; }
      .stat-value { font-size: 13px; }
      .stat-label { font-size: 9px; }
    }

    .stat-icon { font-size: 18px; flex-shrink: 0; }

    .stat-data {
      flex: 1;
      min-width: 0;

      .value-row {
        display: flex;
        align-items: center;
        gap: 4px;
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

      .change {
        padding: 1px 4px;
        border-radius: 6px;
        font-size: 8px;
        font-weight: 700;

        &.up { background: rgba(#2da44e, 0.15); color: #2da44e; }
        &.down { background: rgba(#cf222e, 0.15); color: #cf222e; }
      }
    }
  }
}

@include mobile-only {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);

    .stat-item.primary { grid-column: span 2; }
    .stat-item.secondary:nth-child(10) { grid-column: span 2; }
  }
}
</style>
