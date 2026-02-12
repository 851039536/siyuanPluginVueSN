<template>
  <div class="trend-view">
    <h3 class="section-title">{{ i18n.title }}</h3>

    <!-- 趋势统计列表 -->
    <div v-if="trendStats" class="trend-stats-list">
      <div class="trend-stat-item">
        <span class="stat-icon">📅</span>
        <span class="stat-label">{{ i18n.avgDailyCreated }}</span>
        <span class="stat-value">{{ trendStats.avgDailyCreated }}</span>
      </div>
      <div class="trend-stat-item">
        <span class="stat-icon">✏️</span>
        <span class="stat-label">{{ i18n.avgDailyModified }}</span>
        <span class="stat-value">{{ trendStats.avgDailyModified }}</span>
      </div>
    </div>

    <!-- 历史数据列表 -->
    <div class="historical-data-list">
      <h4 class="subsection-title">{{ i18n.historicalData }}</h4>
      <div class="historical-table-container">
        <table class="historical-table">
          <thead>
            <tr>
              <th class="col-date">{{ i18n.date }}</th>
              <th class="col-notes">
                <span class="th-icon">📓</span>
                {{ i18n.notes }}
              </th>
              <th class="col-words">
                <span class="th-icon">✍️</span>
                {{ i18n.words }}
              </th>
              <th class="col-created">
                <span class="th-icon">📅</span>
                {{ i18n.created }}
              </th>
              <th class="col-modified">
                <span class="th-icon">✏️</span>
                {{ i18n.modified }}
              </th>
              <th class="col-change">{{ i18n.change }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in historicalRows"
              :key="row.item.date"
              class="historical-row"
              :class="{ today: row.isToday }"
            >
              <td class="col-date">{{ row.item.dateLabel }}</td>
              <td class="col-notes">{{ formatNumber(row.item.totalNotes) }}</td>
              <td class="col-words">{{ formatNumber(row.item.totalWords) }}</td>
              <td class="col-created">{{ row.item.todayCreated }}</td>
              <td class="col-modified">{{ row.item.todayModified }}</td>
              <td class="col-change">
                <template v-if="row.hasPrevious">
                  <span
                    v-if="row.wordDiff !== 0"
                    class="diff-tag"
                    :class="row.wordDiff > 0 ? 'success' : 'danger'"
                  >
                    {{ (row.wordDiff > 0 ? '+' : '') + formatShortNumber(row.wordDiff) + ' ' + i18n.wordsUnit }}
                  </span>
                  <span
                    v-if="row.noteDiff !== 0"
                    class="diff-tag"
                    :class="row.noteDiff > 0 ? 'success' : 'danger'"
                  >
                    {{ (row.noteDiff > 0 ? '+' : '') + row.noteDiff + ' ' + i18n.notesUnit }}
                  </span>
                </template>
                <span v-else class="diff-tag secondary">-</span>
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber, formatShortNumber } from '../utils'

interface HistoricalDataItem {

  date: string
  dateLabel: string
  totalNotes: number
  totalWords: number
  todayCreated: number
  todayModified: number
}

interface Props {
  historicalData?: HistoricalDataItem[]
  i18n?: {
    title: string
    notesGrowth: string
    wordsGrowth: string
    avgDailyCreated: string
    avgDailyModified: string
    historicalData: string
    date: string
    notes: string
    words: string
    created: string
    modified: string
    change: string
    wordsUnit: string
    notesUnit: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  i18n: () => ({
    title: '趋势分析',
    notesGrowth: '笔记增长',
    wordsGrowth: '字数增长',
    avgDailyCreated: '日均新增',
    avgDailyModified: '日均修改',
    historicalData: '历史数据',
    date: '日期',
    notes: '笔记',
    words: '字数',
    created: '新增',
    modified: '修改',
    change: '变化',
    wordsUnit: '字',
    notesUnit: '笔记',
  }),
})

const trendStats = computed(() => {
  if (props.historicalData.length === 0) return null

  const totalNotes = props.historicalData[props.historicalData.length - 1]?.totalNotes || 0
  const firstNotes = props.historicalData[0]?.totalNotes || 0
  const notesGrowth = totalNotes - firstNotes

  const totalWords = props.historicalData[props.historicalData.length - 1]?.totalWords || 0
  const firstWords = props.historicalData[0]?.totalWords || 0
  const wordsGrowth = totalWords - firstWords

  const totalCreated = props.historicalData.reduce((sum, item) => sum + item.todayCreated, 0)
  const totalModified = props.historicalData.reduce((sum, item) => sum + item.todayModified, 0)

  return {
    notesGrowth,
    wordsGrowth,
    totalCreated,
    totalModified,
    avgDailyCreated: Math.round(totalCreated / props.historicalData.length),
    avgDailyModified: Math.round(totalModified / props.historicalData.length),
  }
})

const historicalRows = computed(() => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`
  return props.historicalData.map((item, index) => {
    const previous = props.historicalData[index + 1]
    const wordDiff = previous ? getWordDiff(item, previous) : 0
    const noteDiff = previous ? getNoteDiff(item, previous) : 0
    return {
      item,
      wordDiff,
      noteDiff,
      hasPrevious: Boolean(previous),
      isToday: item.date === todayStr,
    }
  })
})


function getWordDiff(current: HistoricalDataItem, previous: HistoricalDataItem): number {
  if (!current || !previous) return 0

  if (previous.todayCreated === 0 && previous.todayModified === 0 && current.totalWords > 0) {
    const diff = current.totalWords - previous.totalWords
    return diff > 0 ? diff : 0
  }

  if (previous.totalWords === 0 && current.totalWords > 0) {
    return 0
  }

  return current.totalWords - previous.totalWords
}

function getNoteDiff(current: HistoricalDataItem, previous: HistoricalDataItem): number {
  if (!current || !previous) return 0

  if (previous.todayCreated === 0 && previous.todayModified === 0 && current.totalNotes > 0) {
    const diff = current.totalNotes - previous.totalNotes
    return diff > 0 ? diff : 0
  }

  if (previous.totalNotes === 0 && current.totalNotes > 0) {
    return 0
  }

  return current.totalNotes - previous.totalNotes
}

function padZero(num: number): string {
  return num < 10 ? '0' + num : String(num)
}
</script>


<style scoped lang="scss">
@use "@/variables" as *;
@use "@/_variables" as base;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

// 定义局部颜色变量，如果全局没有定义
$github-green: #2da44e;
$github-red: #cf222e;


.trend-view {
  .trend-stats-list {
    margin: 0 8px 16px;
    border: 1px solid var(--b3-theme-border);
    border-radius: 6px;
    overflow: hidden;

    .trend-stat-item {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid var(--b3-theme-border);
      background: var(--b3-theme-surface);

      &:last-child {
        border-bottom: none;
      }

      .stat-icon {
        font-size: 18px;
        margin-right: 10px;
      }

      .stat-label {
        flex: 1;
        font-family: $font-body;
        font-size: 13px;
        color: var(--b3-theme-on-surface);
      }

      .stat-value {
        font-family: $font-heading;
        font-size: 15px;
        font-weight: 600;
        color: var(--b3-theme-primary);
      }
    }
  }

  .historical-data-list {
    margin: 16px 8px 0;

    .historical-table-container {
      max-height: 320px;
      overflow-y: auto;
      border: 1px solid var(--b3-theme-border);
      border-radius: 6px;
      @include scrollbar-thin;

      .historical-table {
        width: 100%;
        border-collapse: collapse;
        font-family: $font-body;
        font-size: 11px;

        thead {
          position: sticky;
          top: 0;
          z-index: 1;
          background: var(--b3-theme-surface);

          th {
            padding: 6px 8px;
            text-align: left;
            font-family: $font-heading;
            font-weight: 600;
            color: var(--b3-theme-on-surface);
            border-bottom: 1px solid var(--b3-theme-border);

            .th-icon {
              margin-right: 4px;
            }

            &.col-date {
              width: 80px;
            }

            &.col-notes,
            &.col-words,
            &.col-created,
            &.col-modified {
              width: 60px;
              text-align: right;
            }

            &.col-change {
              width: 100px;
              text-align: center;
            }
          }
        }

        tbody {
          .historical-row {
            border-bottom: 1px solid var(--b3-theme-border);

            &:last-child {
              border-bottom: none;
            }

            &.today {
              background: rgba(245, 87, 108, 0.06);
            }

            td {
              padding: 6px 8px;
              color: var(--b3-theme-on-surface);

              &.col-date {
                font-weight: 600;
                font-family: $font-heading;
                color: var(--b3-theme-primary);
              }

              &.col-notes,
              &.col-words,
              &.col-created,
              &.col-modified {
                text-align: right;
                font-variant-numeric: tabular-nums;
              }

              &.col-change {
                text-align: center;
              }

              .diff-tag {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 4px;
                font-weight: 600;
                font-size: 11px;
                margin: 0 2px;
                font-family: $font-heading;

                &.success {
                  background: rgba($github-green, 0.15);
                  color: $github-green;
                }

                &.danger {
                  background: rgba($github-red, 0.15);
                  color: $github-red;
                }

                &.secondary {
                  background: rgba(120, 120, 120, 0.1);
                  color: #666;
                }
              }
            }
          }
        }
      }
    }
  }
}


// Responsive design
@include mobile-only {
  .trend-view {
    .trend-stats-list {
      margin-left: 4px;
      margin-right: 4px;
    }

    .historical-data-list {
      margin-left: 4px;
      margin-right: 4px;
    }
  }
}
</style>
