<template>
  <div class="statistics-view">
    <div class="stats-overview">
      <Card
        variant="bordered"
        size="small"
        class="stat-item"
      >
        <div class="stat-item-inner">
          <div class="stat-icon stat-icon--primary">
            <IconWrapper
              name="refresh"
              :size="22"
            />
          </div>
          <div class="stat-body">
            <div class="stat-value">
              {{ statistics.totalPractice }}
            </div>
            <div class="stat-label">
              {{ i18n.totalPractice || '总练习次数' }}
            </div>
          </div>
        </div>
      </Card>
      <Card
        variant="bordered"
        size="small"
        class="stat-item"
      >
        <div class="stat-item-inner">
          <div class="stat-icon stat-icon--success">
            <IconWrapper
              name="success"
              :size="22"
            />
          </div>
          <div class="stat-body">
            <div class="stat-value">
              {{ statistics.practicedCards }}
            </div>
            <div class="stat-label">
              {{ i18n.practicedCards || '已练习卡片' }}
            </div>
          </div>
        </div>
      </Card>
      <Card
        variant="bordered"
        size="small"
        class="stat-item"
      >
        <div class="stat-item-inner">
          <div class="stat-icon stat-icon--info">
            <IconWrapper
              name="listBulleted"
              :size="22"
            />
          </div>
          <div class="stat-body">
            <div class="stat-value">
              {{ statistics.totalCards }}
            </div>
            <div class="stat-label">
              {{ i18n.totalCards || '总卡片数' }}
            </div>
          </div>
        </div>
      </Card>
    </div>

    <Card
      v-if="statistics.totalCards > 0"
      variant="bordered"
      size="small"
      class="progress-section"
    >
      <div class="progress-header">
        <span class="progress-title">{{ i18n.masteryProgress || '掌握进度' }}</span>
        <span class="progress-percent">{{ statistics.practicedCards }}/{{ statistics.totalCards }} ({{ masteryPercent }}%)</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${masteryPercent}%` }"
        />
      </div>
    </Card>

    <Card
      v-if="statistics.categoryStats.length > 0"
      variant="bordered"
      size="small"
      class="chart-card"
    >
      <template #header>
        <span class="chart-card-title">
          <IconWrapper
            name="statistics"
            :size="14"
          />
          {{ i18n.categoryStats || '类别统计' }}
        </span>
      </template>
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
              :class="`bar-fill--${index % 4}`"
              :style="{ width: `${categoryPercent(item.count)}%` }"
            >
              <span class="bar-value">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <Card
      v-if="statistics.cardStats.length > 0"
      variant="bordered"
      size="small"
      class="rank-card"
    >
      <template #header>
        <span class="chart-card-title">
          <IconWrapper
            name="starCircle"
            :size="14"
          />
          {{ i18n.topCards || '练习排行榜' }}
        </span>
      </template>
      <div class="rank-list">
        <div
          v-for="(item, index) in statistics.cardStats"
          :key="item.title"
          class="rank-item"
          :class="{ 'rank-item--top': index < 3 }"
        >
          <span
            class="rank-number"
            :class="{ 'rank-number--top': index < 3 }"
          >{{ index + 1 }}</span>
          <div class="rank-info">
            <span class="rank-title">{{ item.title }}</span>
            <span class="category-tag">{{ item.category }}</span>
          </div>
          <span class="rank-count">{{ item.count }}</span>
        </div>
      </div>
    </Card>

    <div
      v-if="statistics.totalCards === 0"
      class="empty-state"
    >
      <IconWrapper
        name="statistics"
        :size="48"
      />
      <p>{{ i18n.noPracticeData || '暂无练习数据' }}</p>
      <p class="empty-state-hint">
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
import Card from "@/components/Card.vue"
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
