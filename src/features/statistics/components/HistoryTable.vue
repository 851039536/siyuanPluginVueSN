<!-- 历史数据表格：日期/笔记/字数/块/新增/修改 + 相邻日差值标签 -->
<template>
  <div class="historical-data-list">
    <!-- 区块标题："历史数据" -->
    <h4 class="subsection-title">
      {{ i18n.historicalData }}
    </h4>
    <div class="historical-table-container">
      <table class="historical-table">
        <thead>
          <!-- 表头："日期 / 笔记 / 字数 / 块 / 新增 / 修改 / 变化" -->
          <tr>
            <th class="col-date">
              {{ i18n.date }}
            </th>
            <th class="col-notes">
              <IconWrapper
                name="file"
                :size="12"
              />
              {{ i18n.notes }}
            </th>
            <th class="col-words">
              <IconWrapper
                name="edit"
                :size="12"
              />
              {{ i18n.words }}
            </th>
            <th class="col-blocks">
              <IconWrapper
                name="format"
                :size="12"
              />
              {{ i18n.blocks }}
            </th>
            <th class="col-created">
              <IconWrapper
                name="list"
                :size="12"
              />
              {{ i18n.created }}
            </th>
            <th class="col-modified">
              <IconWrapper
                name="edit"
                :size="12"
              />
              {{ i18n.modified }}
            </th>
            <th class="col-change">
              {{ i18n.change }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in historicalRows"
            :key="row.item.date"
            class="historical-row"
            :class="{ today: row.isToday }"
          >
            <td class="col-date">
              {{ row.item.dateLabel }}
            </td>
            <td class="col-notes">
              {{ formatNumber(row.item.totalNotes) }}
            </td>
            <td class="col-words">
              {{ formatNumber(row.item.totalWords) }}
            </td>
            <td class="col-blocks">
              {{ formatNumber(row.item.totalBlocks) }}
            </td>
            <td class="col-created">
              {{ row.item.todayCreated }}
            </td>
            <td class="col-modified">
              {{ row.item.todayModified }}
            </td>
            <td class="col-change">
              <template v-if="row.hasPrevious">
                <!-- 差值标签："+N 字" -->
                <span
                  v-if="row.wordDiff !== 0"
                  class="diff-tag"
                  :class="row.wordDiff > 0 ? 'success' : 'danger'"
                >
                  {{ `${(row.wordDiff > 0 ? '+' : '') + formatShortNumber(row.wordDiff)} ${i18n.wordsUnit}` }}
                </span>
                <!-- 差值标签："+N 笔记" -->
                <span
                  v-if="row.noteDiff !== 0"
                  class="diff-tag"
                  :class="row.noteDiff > 0 ? 'success' : 'danger'"
                >
                  {{ `${(row.noteDiff > 0 ? '+' : '') + row.noteDiff} ${i18n.notesUnit}` }}
                </span>
                <!-- 差值标签："+N 块" -->
                <span
                  v-if="row.blockDiff !== 0"
                  class="diff-tag"
                  :class="row.blockDiff > 0 ? 'success' : 'danger'"
                >
                  {{ `${(row.blockDiff > 0 ? '+' : '') + formatShortNumber(row.blockDiff)} ${i18n.blocks}` }}
                </span>
              </template>
              <span
                v-else
                class="diff-tag secondary"
              >-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HistoricalDataItem } from "../types"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  formatDate,
  formatNumber,
  formatShortNumber,
} from "../utils"

interface Props {
  historicalData?: HistoricalDataItem[]
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  i18n: () => ({}),
})

const historicalRows = computed(() => {
  const today = new Date()
  const todayStr = formatDate(today)
  return props.historicalData.map((item, index) => {
    const previous = props.historicalData[index + 1]
    return {
      item,
      wordDiff: previous ? getDiff(item, previous, "totalWords") : 0,
      noteDiff: previous ? getDiff(item, previous, "totalNotes") : 0,
      blockDiff: previous ? getDiff(item, previous, "totalBlocks") : 0,
      hasPrevious: Boolean(previous),
      isToday: item.date === todayStr,
    }
  })
})

function getDiff(
  current: HistoricalDataItem,
  previous: HistoricalDataItem,
  field: "totalWords" | "totalNotes" | "totalBlocks",
): number {
  if (!current || !previous) return 0
  // 累计值的差值即为该周期内的净变化
  return current[field] - previous[field]
}
</script>

<style scoped lang="scss">
@use "../styles/HistoryTable.scss";
@use '../styles/index.scss' as stats;
</style>
