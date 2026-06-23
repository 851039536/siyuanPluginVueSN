<template>
  <div class="word-ranking-section">
    <div class="ranking-header">
      <h4 class="subsection-title">
        <IconWrapper
          name="star"
          :size="16"
        /> {{ i18n.title }}
      </h4>
      <div class="ranking-controls">
        <select
          v-model="topN"
          class="top-n-select"
        >
          <option
            v-for="opt in topNOptions"
            :key="opt"
            :value="opt"
          >
            Top {{ opt }}
          </option>
        </select>
      </div>
    </div>

    <!-- 排行列表 -->
    <div
      v-if="rankingList.length > 0"
      class="ranking-list"
    >
      <div
        v-for="(item, index) in rankingList"
        :key="item.date"
        class="ranking-item"
        :class="getRankClass(index)"
      >
        <span class="rank-badge">{{ index + 1 }}</span>
        <div class="rank-info">
          <span class="rank-date">{{ item.dateLabel }}</span>
          <span class="rank-words">{{ formatNumber(item.words) }} {{ i18n.wordsUnit }}</span>
        </div>
        <div class="rank-bar-wrapper">
          <div
            class="rank-bar"
            :style="{ width: getBarWidth(item.words) }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div
      v-else
      class="ranking-empty"
    >
      {{ i18n.emptyText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatNumber } from "../utils"

interface DailyWordCount {
  date: string
  words: number
  dateLabel: string
}

interface Props {
  chartData?: DailyWordCount[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  chartData: () => [],
  i18n: () => ({
    title: "字数排行",
    wordsUnit: "字",
    emptyText: "暂无数据",
  }),
})

const topNOptions = [10, 50, 100] as const
const topN = ref<number>(10)

const rankingList = computed(() => {
  return [...props.chartData]
    .filter((item) => item.words > 0)
    .sort((a, b) => b.words - a.words)
    .slice(0, topN.value)
})

const maxWords = computed(() => {
  if (rankingList.value.length === 0) return 0
  return rankingList.value[0].words
})

function getBarWidth(words: number): string {
  if (maxWords.value === 0) return "0%"
  return `${(words / maxWords.value) * 100}%`
}

function getRankClass(index: number): string {
  if (index === 0) return "rank-gold"
  if (index === 1) return "rank-silver"
  if (index === 2) return "rank-bronze"
  return ""
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/shared" as *;
@use "../styles/index.scss" as stats;

.word-ranking-section {
  @include stats.stats-card-base;
  border-radius: 4px;
  padding: 0;
  overflow: visible;

  .ranking-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(var(--b3-theme-primary-rgb), 0.04);
    border-bottom: 1px solid var(--b3-border-color);

    .subsection-title {
      margin: 0;
    }

    .ranking-controls {
      .top-n-select {
        padding: 2px 8px;
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        background: var(--b3-theme-surface);
        color: var(--b3-theme-on-surface);
        font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
        outline: none;

        &:focus {
          border-color: var(--b3-theme-primary);
          box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest, rgba(var(--b3-theme-primary-rgb), 0.12));
        }
      }
    }
  }

  .ranking-empty {
    text-align: center;
    padding: 20px;
    font-size: 11px;
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
  }

  .ranking-list {
    max-height: 400px;
    overflow-y: auto;
    @include scrollbar-thin;

    .ranking-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--b3-border-color);
      transition: background 0.15s;

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: rgba(var(--b3-theme-primary-rgb), 0.03);
      }

      .rank-badge {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
        font-size: 10px;
        font-weight: 700;
        background: rgba(var(--b3-theme-on-surface-rgb), 0.06);
        color: var(--b3-theme-on-surface);
        opacity: 0.6;
      }

      &.rank-gold .rank-badge {
        background: linear-gradient(135deg, stats.$color-rank-gold, #ffb800);
        color: stats.$color-rank-gold-text;
        opacity: 1;
      }

      &.rank-silver .rank-badge {
        background: linear-gradient(135deg, stats.$color-rank-silver, #a8a8a8);
        color: #555;
        opacity: 1;
      }

      &.rank-bronze .rank-badge {
        background: linear-gradient(135deg, stats.$color-rank-bronze, #b8722d);
        color: #fff;
        opacity: 1;
      }

      .rank-info {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 8px;

        .rank-date {
          font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
          font-size: 11px;
          font-weight: 700;
          color: var(--b3-theme-on-surface);
          white-space: nowrap;
        }

        .rank-words {
          font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
          font-size: 10px;
          font-weight: 700;
          color: var(--b3-theme-primary);
          white-space: nowrap;
        }
      }

      .rank-bar-wrapper {
        flex-shrink: 0;
        width: 60px;
        height: 6px;
        background: rgba(var(--b3-theme-on-surface-rgb), 0.06);
        border-radius: 4px;
        overflow: hidden;

        .rank-bar {
          height: 100%;
          background: stats.$gradient-primary;
          border-radius: 4px;
          transition: width 0.3s ease;
        }
      }
    }
  }
}

@include mobile-only {
  .word-ranking-section {
    .ranking-list {
      max-height: 300px;
    }
  }
}
</style>
