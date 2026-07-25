<!-- 笔记本排行表：总字数/活跃天数/日均/占比 排序表格 -->
<template>
  <div class="ranking-card">
    <div class="ranking-title">
      <!-- 排行表标题："笔记本排行" -->
      {{ i18n.notebookRanking }}
    </div>
    <div class="ranking-table">
      <!-- 表头："笔记本 / 总字数 / 活跃天数 / 日均 / 占比" -->
      <div class="ranking-header">
        <span class="col-rank">#</span>
        <span class="col-name">{{ i18n.notebookName }}</span>
        <span class="col-total">{{ i18n.totalWords }}</span>
        <span class="col-days">{{ i18n.activeDaysLabel }}</span>
        <span class="col-avg">{{ i18n.dailyAvg }}</span>
        <span class="col-bar">{{ i18n.proportion }}</span>
      </div>
      <div
        v-for="(item, idx) in rankingData"
        :key="item.notebook"
        class="ranking-row"
      >
        <span class="col-rank">{{ idx + 1 }}</span>
        <span class="col-name">
          <span
            class="rank-dot"
            :style="{ background: item.color }"
          ></span>
          {{ item.notebook }}
        </span>
        <span class="col-total">{{ formatNumber(item.totalWords) }}</span>
        <span class="col-days">{{ item.activeDays }}</span>
        <span class="col-avg">{{ formatNumber(item.dailyAvg) }}</span>
        <span class="col-bar">
          <span class="bar-track">
            <span
              class="bar-fill"
              :style="{
                width: `${item.percent}%`,
                background: item.color,
              }"
            ></span>
          </span>
          <span class="bar-label">{{ item.percent }}%</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotebookActivityItem } from "../types"
import { computed } from "vue"
import { formatNumber } from "../utils"

interface Props {
  notebooks?: NotebookActivityItem[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  notebooks: () => [],
  i18n: () => ({}),
})

// 按总字数降序的排行数据（含活跃天数/日均/占比）
const rankingData = computed(() => {
  const totalAll = props.notebooks.reduce((sum, nb) => {
    return sum + nb.data.reduce((s, d) => s + d.words, 0)
  }, 0)

  return props.notebooks
    .map((nb) => {
      const totalWords = nb.data.reduce((s, d) => s + d.words, 0)
      const activeDays = nb.data.filter((d) => d.words > 0).length
      return {
        notebook: nb.notebook,
        color: nb.color,
        totalWords,
        activeDays,
        dailyAvg: activeDays > 0 ? Math.round(totalWords / activeDays) : 0,
        percent: totalAll > 0 ? Math.round((totalWords / totalAll) * 100) : 0,
      }
    })
    .sort((a, b) => b.totalWords - a.totalWords)
})
</script>

<style scoped lang="scss">
@use '../styles/NotebookActivityTrend.scss';
@use '../styles/index.scss' as stats;
</style>
