<!-- 字数排行：Top N 排序列表、金/银/铜排名徽章、柱状进度条可视化 -->
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

<style lang="scss" scoped>
@use '../styles/WordRanking.scss';
</style>
