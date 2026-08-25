<!-- 笔记本排行表：总字数/活跃天数/日均/占比 排序表格（前三名奖牌徽章） -->
<template>
  <div class="ranking-card">
    <div class="card-title">
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
        v-for="(item, idx) in rows"
        :key="item.notebook"
        class="ranking-row"
      >
        <span
          class="col-rank"
          :class="rankClass(idx)"
        >{{ idx + 1 }}</span>
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
// 笔记本排行表：纯展示组件，数据由入口统一计算后传入
import type { NotebookRankingRow } from "../../types"
import { formatNumber } from "../../utils"

interface Props {
  rows: NotebookRankingRow[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  rows: () => [],
  i18n: () => ({}),
})

// 前三名序号使用奖牌色徽章
function rankClass(idx: number): string {
  if (idx === 0) return "rank-gold"
  if (idx === 1) return "rank-silver"
  if (idx === 2) return "rank-bronze"
  return ""
}
</script>

<style scoped lang="scss">
@use '../../styles/NotebookActivity.scss';
@use '../../styles/index.scss' as stats;
</style>
