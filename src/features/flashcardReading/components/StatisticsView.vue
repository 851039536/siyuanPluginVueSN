<template>
  <div class="statistics-view">
    <div class="stats-overview">
      <div class="stat-card stat-card-primary">
        <div class="stat-icon">
          <IconWrapper
            name="refresh"
            :size="24"
          />
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ statistics.totalPractice }}
          </div>
          <div class="stat-label">
            {{ i18n.totalPractice || '总练习次数' }}
          </div>
        </div>
      </div>
      <div class="stat-card stat-card-success">
        <div class="stat-icon">
          <IconWrapper
            name="success"
            :size="24"
          />
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ statistics.practicedCards }}
          </div>
          <div class="stat-label">
            {{ i18n.practicedCards || '已练习卡片' }}
          </div>
        </div>
        <div
          v-if="statistics.totalCards > 0"
          class="stat-badge"
        >
          {{ masteryPercent }}%
        </div>
      </div>
      <div class="stat-card stat-card-info">
        <div class="stat-icon">
          <IconWrapper
            name="listBulleted"
            :size="24"
          />
        </div>
        <div class="stat-content">
          <div class="stat-value">
            {{ statistics.totalCards }}
          </div>
          <div class="stat-label">
            {{ i18n.totalCards || '总卡片数' }}
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="statistics.totalCards > 0"
      class="progress-section"
    >
      <div class="progress-header">
        <span class="progress-title">{{ i18n.masteryProgress || '掌握进度' }}</span>
        <span class="progress-value">{{ statistics.practicedCards }}/{{ statistics.totalCards }} ({{ masteryPercent }}%)</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${masteryPercent}%` }"
        />
      </div>
    </div>

    <div
      v-if="statistics.categoryStats.length > 0"
      class="chart-section"
    >
      <h4 class="chart-title">
        <IconWrapper
          name="statistics"
          :size="16"
        />
        {{ i18n.categoryStats || '类别统计' }}
      </h4>
      <div class="bar-chart">
        <div
          v-for="(item, index) in statistics.categoryStats"
          :key="item.category"
          class="bar-item"
        >
          <div class="bar-label">
            {{ item.category }}
          </div>
          <div class="bar-container">
            <div
              class="bar-fill"
              :class="`bar-fill-${index % 4}`"
              :style="{ width: `${categoryPercent(item.count)}%` }"
            >
              <span class="bar-value">{{ item.count }}</span>
            </div>
          </div>
          <div
            v-if="statistics.totalPractice > 0"
            class="bar-percent"
          >
            {{ categoryPercent(item.count) }}%
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="statistics.cardStats.length > 0"
      class="chart-section"
    >
      <h4 class="chart-title">
        <IconWrapper
          name="starCircle"
          :size="16"
        />
        {{ i18n.topCards || '练习排行榜' }}
      </h4>
      <div class="rank-list">
        <div
          v-for="(item, index) in statistics.cardStats"
          :key="item.title"
          class="rank-item"
          :class="{ 'rank-item-top': index < 3 }"
        >
          <span
            class="rank-number"
            :class="{ 'rank-medal-top': index < 3 }"
          >{{ index + 1 }}</span>
          <div class="rank-info">
            <div class="rank-title">
              {{ item.title }}
            </div>
            <span class="category-tag">{{ item.category }}</span>
          </div>
          <span class="rank-count">{{ item.count }}</span>
        </div>
      </div>
    </div>

    <div
      v-else
      class="empty-stats"
    >
      <div class="empty-icon">
        <IconWrapper
          name="statistics"
          :size="64"
        />
      </div>
      <p class="empty-title">
        {{ i18n.noPracticeData || '暂无练习数据' }}
      </p>
      <p class="empty-desc">
        {{ i18n.startPracticeHint || '开始练习单词，这里将显示你的学习统计' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  I18n,
  StatisticsData,
} from "../types"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

const props = defineProps<{
  statistics: StatisticsData
  i18n: I18n
}>()

const masteryPercent = computed(() =>
  props.statistics.totalCards > 0
    ? Math.round(props.statistics.practicedCards / props.statistics.totalCards * 100)
    : 0,
)

const categoryPercent = (count: number) =>
  props.statistics.totalPractice > 0
    ? Math.round(count / props.statistics.totalPractice * 100)
    : 0
</script>
