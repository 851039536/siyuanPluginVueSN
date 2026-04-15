<template>
  <div class="trend-view">
    <!-- 标题行：包含标题和日均统计 -->
    <div class="section-header">
      <h3 class="section-title">{{ i18n.title }}</h3>
      <div v-if="trendStats" class="trend-stats-inline">
        <span class="stat-item">📅 {{ i18n.avgDailyCreated }} <strong>{{ trendStats.avgDailyCreated }}</strong></span>
        <span class="stat-item">✏️ {{ i18n.avgDailyModified }} <strong>{{ trendStats.avgDailyModified }}</strong></span>
      </div>
    </div>

    <!-- 周期对比汇总 -->
    <div v-if="comparisonStats" class="comparison-section">
      <div class="comparison-card">
        <div class="comparison-header">
          <span class="comparison-icon">📅</span>
          <span class="comparison-title">{{ i18n.dayOverDay }}</span>
        </div>
        <div class="comparison-body">
          <div class="comparison-item">
            <span class="item-label">{{ i18n.created }}</span>
            <span class="item-values">
              <span class="current-value">{{ comparisonStats.today.created }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ comparisonStats.yesterday.created }}</span>
            </span>
            <span
              v-if="comparisonStats.dayChange.created !== null"
              class="change-tag"
              :class="getChangeClass(comparisonStats.dayChange.created)"
            >
              {{ formatChange(comparisonStats.dayChange.created) }}
            </span>
          </div>
          <div class="comparison-item">
            <span class="item-label">{{ i18n.modified }}</span>
            <span class="item-values">
              <span class="current-value">{{ comparisonStats.today.modified }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ comparisonStats.yesterday.modified }}</span>
            </span>
            <span
              v-if="comparisonStats.dayChange.modified !== null"
              class="change-tag"
              :class="getChangeClass(comparisonStats.dayChange.modified)"
            >
              {{ formatChange(comparisonStats.dayChange.modified) }}
            </span>
          </div>
          <div class="comparison-item">
            <span class="item-label">{{ i18n.words }}</span>
            <span class="item-values">
              <span class="current-value">{{ formatNumber(comparisonStats.today.words) }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ formatNumber(comparisonStats.yesterday.words) }}</span>
            </span>
            <span
              v-if="comparisonStats.dayChange.words !== null"
              class="change-tag"
              :class="getChangeClass(comparisonStats.dayChange.words)"
            >
              {{ formatChange(comparisonStats.dayChange.words) }}
            </span>
          </div>
        </div>
      </div>

      <div class="comparison-card">
        <div class="comparison-header">
          <span class="comparison-icon">📆</span>
          <span class="comparison-title">{{ i18n.weekOverWeek }}</span>
        </div>
        <div class="comparison-body">
          <div class="comparison-item">
            <span class="item-label">{{ i18n.created }}</span>
            <span class="item-values">
              <span class="current-value">{{ comparisonStats.thisWeek.created }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ comparisonStats.lastWeek.created }}</span>
            </span>
            <span
              v-if="comparisonStats.weekChange.created !== null"
              class="change-tag"
              :class="getChangeClass(comparisonStats.weekChange.created)"
            >
              {{ formatChange(comparisonStats.weekChange.created) }}
            </span>
          </div>
          <div class="comparison-item">
            <span class="item-label">{{ i18n.modified }}</span>
            <span class="item-values">
              <span class="current-value">{{ comparisonStats.thisWeek.modified }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ comparisonStats.lastWeek.modified }}</span>
            </span>
            <span
              v-if="comparisonStats.weekChange.modified !== null"
              class="change-tag"
              :class="getChangeClass(comparisonStats.weekChange.modified)"
            >
              {{ formatChange(comparisonStats.weekChange.modified) }}
            </span>
          </div>
          <div class="comparison-item">
            <span class="item-label">{{ i18n.words }}</span>
            <span class="item-values">
              <span class="current-value">{{ formatNumber(comparisonStats.thisWeek.words) }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ formatNumber(comparisonStats.lastWeek.words) }}</span>
            </span>
            <span
              v-if="comparisonStats.weekChange.words !== null"
              class="change-tag"
              :class="getChangeClass(comparisonStats.weekChange.words)"
            >
              {{ formatChange(comparisonStats.weekChange.words) }}
            </span>
          </div>
        </div>
      </div>

      <div class="comparison-card">
        <div class="comparison-header">
          <span class="comparison-icon">🗓️</span>
          <span class="comparison-title">{{ i18n.monthOverMonth }}</span>
        </div>
        <div class="comparison-body">
          <div class="comparison-item">
            <span class="item-label">{{ i18n.created }}</span>
            <span class="item-values">
              <span class="current-value">{{ comparisonStats.thisMonth.created }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ comparisonStats.lastMonth.created }}</span>
            </span>
            <span
              v-if="comparisonStats.monthChange.created !== null"
              class="change-tag"
              :class="getChangeClass(comparisonStats.monthChange.created)"
            >
              {{ formatChange(comparisonStats.monthChange.created) }}
            </span>
          </div>
          <div class="comparison-item">
            <span class="item-label">{{ i18n.modified }}</span>
            <span class="item-values">
              <span class="current-value">{{ comparisonStats.thisMonth.modified }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ comparisonStats.lastMonth.modified }}</span>
            </span>
            <span
              v-if="comparisonStats.monthChange.modified !== null"
              class="change-tag"
              :class="getChangeClass(comparisonStats.monthChange.modified)"
            >
              {{ formatChange(comparisonStats.monthChange.modified) }}
            </span>
          </div>
          <div class="comparison-item">
            <span class="item-label">{{ i18n.words }}</span>
            <span class="item-values">
              <span class="current-value">{{ formatNumber(comparisonStats.thisMonth.words) }}</span>
              <span class="vs-label">vs</span>
              <span class="prev-value">{{ formatNumber(comparisonStats.lastMonth.words) }}</span>
            </span>
            <span
              v-if="comparisonStats.monthChange.words !== null"
              class="change-tag"
              :class="getChangeClass(comparisonStats.monthChange.words)"
            >
              {{ formatChange(comparisonStats.monthChange.words) }}
            </span>
          </div>
        </div>
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
import { computed } from "vue";
import { formatNumber, formatShortNumber } from "../utils";

interface HistoricalDataItem {
	date: string;
	dateLabel: string;
	totalNotes: number;
	totalWords: number;
	todayCreated: number;
	todayModified: number;
}

interface Props {
	historicalData?: HistoricalDataItem[];
	i18n?: {
		title: string;
		notesGrowth: string;
		wordsGrowth: string;
		avgDailyCreated: string;
		avgDailyModified: string;
		historicalData: string;
		date: string;
		notes: string;
		words: string;
		created: string;
		modified: string;
		change: string;
		wordsUnit: string;
		notesUnit: string;
		dayOverDay: string;
		weekOverWeek: string;
		monthOverMonth: string;
	};
}

const props = withDefaults(defineProps<Props>(), {
	historicalData: () => [],
	i18n: () => ({
		title: "趋势分析",
		notesGrowth: "笔记增长",
		wordsGrowth: "字数增长",
		avgDailyCreated: "日均新增",
		avgDailyModified: "日均修改",
		historicalData: "历史数据",
		date: "日期",
		notes: "笔记",
		words: "字数",
		created: "新增",
		modified: "修改",
		change: "变化",
		wordsUnit: "字",
		notesUnit: "笔记",
		dayOverDay: "日环比",
		weekOverWeek: "周环比",
		monthOverMonth: "月环比",
	}),
});

// 计算周期对比数据
const comparisonStats = computed(() => {
	if (props.historicalData.length === 0) return null;

	const today = new Date();
	const todayStr = formatDate(today);

	// 获取今日数据
	const todayData = props.historicalData.find((item) => item.date === todayStr);

	// 获取昨日数据
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);
	const yesterdayStr = formatDate(yesterday);
	const yesterdayData = props.historicalData.find(
		(item) => item.date === yesterdayStr,
	);

	// 获取本周数据 (周一到今天)
	const weekStart = new Date(today);
	const dayOfWeek = weekStart.getDay() || 7; // 周日为0，转为7
	weekStart.setDate(weekStart.getDate() - dayOfWeek + 1);
	const thisWeekData = getRangeData(weekStart, today);

	// 获取上周数据
	const lastWeekEnd = new Date(weekStart);
	lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
	const lastWeekStart = new Date(lastWeekEnd);
	lastWeekStart.setDate(lastWeekStart.getDate() - 6);
	const lastWeekData = getRangeData(lastWeekStart, lastWeekEnd);

	// 获取本月数据
	const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
	const thisMonthData = getRangeData(monthStart, today);

	// 获取上月数据
	const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
	const lastMonthStart = new Date(
		lastMonthEnd.getFullYear(),
		lastMonthEnd.getMonth(),
		1,
	);
	const lastMonthData = getRangeData(lastMonthStart, lastMonthEnd);

	return {
		today: {
			created: todayData?.todayCreated ?? 0,
			modified: todayData?.todayModified ?? 0,
			words: todayData?.totalWords ?? 0,
		},
		yesterday: {
			created: yesterdayData?.todayCreated ?? 0,
			modified: yesterdayData?.todayModified ?? 0,
			words: yesterdayData?.totalWords ?? 0,
		},
		dayChange: {
			created: calcChange(
				todayData?.todayCreated ?? 0,
				yesterdayData?.todayCreated ?? 0,
			),
			modified: calcChange(
				todayData?.todayModified ?? 0,
				yesterdayData?.todayModified ?? 0,
			),
			words: calcChange(
				todayData?.totalWords ?? 0,
				yesterdayData?.totalWords ?? 0,
			),
		},
		thisWeek: {
			created: thisWeekData.created,
			modified: thisWeekData.modified,
			words: thisWeekData.words,
		},
		lastWeek: {
			created: lastWeekData.created,
			modified: lastWeekData.modified,
			words: lastWeekData.words,
		},
		weekChange: {
			created: calcChange(thisWeekData.created, lastWeekData.created),
			modified: calcChange(thisWeekData.modified, lastWeekData.modified),
			words: calcChange(thisWeekData.words, lastWeekData.words),
		},
		thisMonth: {
			created: thisMonthData.created,
			modified: thisMonthData.modified,
			words: thisMonthData.words,
		},
		lastMonth: {
			created: lastMonthData.created,
			modified: lastMonthData.modified,
			words: lastMonthData.words,
		},
		monthChange: {
			created: calcChange(thisMonthData.created, lastMonthData.created),
			modified: calcChange(thisMonthData.modified, lastMonthData.modified),
			words: calcChange(thisMonthData.words, lastMonthData.words),
		},
	};
});

function formatDate(date: Date): string {
	return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
}

function padZero(num: number): string {
	return num < 10 ? "0" + num : String(num);
}

function getRangeData(
	startDate: Date,
	endDate: Date,
): { created: number; modified: number; words: number } {
	let created = 0;
	let modified = 0;
	let words = 0;

	const startStr = formatDate(startDate);
	const endStr = formatDate(endDate);

	for (const item of props.historicalData) {
		if (item.date >= startStr && item.date <= endStr) {
			created += item.todayCreated;
			modified += item.todayModified;
			words = item.totalWords; // 取最后一天的总字数
		}
	}

	return { created, modified, words };
}

function calcChange(current: number, previous: number): number | null {
	if (previous === 0) {
		return current > 0 ? 100 : null;
	}
	return ((current - previous) / previous) * 100;
}

function getChangeClass(change: number | null): string {
	if (change === null || change === 0) return "neutral";
	return change > 0 ? "positive" : "negative";
}

function formatChange(change: number | null): string {
	if (change === null) return "-";
	const prefix = change > 0 ? "+" : "";
	return `${prefix}${change.toFixed(1)}%`;
}

const trendStats = computed(() => {
	if (props.historicalData.length === 0) return null;

	const totalNotes =
		props.historicalData[props.historicalData.length - 1]?.totalNotes || 0;
	const firstNotes = props.historicalData[0]?.totalNotes || 0;
	const notesGrowth = totalNotes - firstNotes;

	const totalWords =
		props.historicalData[props.historicalData.length - 1]?.totalWords || 0;
	const firstWords = props.historicalData[0]?.totalWords || 0;
	const wordsGrowth = totalWords - firstWords;

	const totalCreated = props.historicalData.reduce(
		(sum, item) => sum + item.todayCreated,
		0,
	);
	const totalModified = props.historicalData.reduce(
		(sum, item) => sum + item.todayModified,
		0,
	);

	return {
		notesGrowth,
		wordsGrowth,
		totalCreated,
		totalModified,
		avgDailyCreated: Math.round(totalCreated / props.historicalData.length),
		avgDailyModified: Math.round(totalModified / props.historicalData.length),
	};
});

const historicalRows = computed(() => {
	const today = new Date();
	const todayStr = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`;
	return props.historicalData.map((item, index) => {
		const previous = props.historicalData[index + 1];
		const wordDiff = previous ? getWordDiff(item, previous) : 0;
		const noteDiff = previous ? getNoteDiff(item, previous) : 0;
		return {
			item,
			wordDiff,
			noteDiff,
			hasPrevious: Boolean(previous),
			isToday: item.date === todayStr,
		};
	});
});

function getWordDiff(
	current: HistoricalDataItem,
	previous: HistoricalDataItem,
): number {
	if (!current || !previous) return 0;

	if (
		previous.todayCreated === 0 &&
		previous.todayModified === 0 &&
		current.totalWords > 0
	) {
		const diff = current.totalWords - previous.totalWords;
		return diff > 0 ? diff : 0;
	}

	if (previous.totalWords === 0 && current.totalWords > 0) {
		return 0;
	}

	return current.totalWords - previous.totalWords;
}

function getNoteDiff(
	current: HistoricalDataItem,
	previous: HistoricalDataItem,
): number {
	if (!current || !previous) return 0;

	if (
		previous.todayCreated === 0 &&
		previous.todayModified === 0 &&
		current.totalNotes > 0
	) {
		const diff = current.totalNotes - previous.totalNotes;
		return diff > 0 ? diff : 0;
	}

	if (previous.totalNotes === 0 && current.totalNotes > 0) {
		return 0;
	}

	return current.totalNotes - previous.totalNotes;
}
</script>


<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

.trend-view {
  // 周期对比区域
  .comparison-section {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;

    .comparison-card {
      @include stats.stats-card-base;
      border-radius: 8px;

      .comparison-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        background: rgba(var(--b3-theme-primary-rgb), 0.06);
        border-bottom: 1px solid var(--b3-border-color);

        .comparison-icon {
          font-size: 14px;
        }

        .comparison-title {
          font-family: $font-heading;
          font-size: 11px;
          font-weight: 700;
          color: var(--b3-theme-primary);
        }
      }

      .comparison-body {
        padding: 6px 8px;

        .comparison-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dashed var(--b3-border-color);
          opacity: 0.9;

          &:last-child {
            border-bottom: none;
          }

          .item-label {
            font-size: 9px;
            color: var(--b3-theme-on-surface);
            opacity: 0.6;
            min-width: 24px;
          }

          .item-values {
            display: flex;
            align-items: center;
            gap: 3px;
            font-size: 10px;

            .current-value {
              font-weight: 700;
              color: var(--b3-theme-primary);
            }

            .vs-label {
              font-size: 8px;
              opacity: 0.4;
            }

            .prev-value {
              opacity: 0.6;
            }
          }

          .change-tag {
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 700;
            font-family: $font-heading;

            &.positive {
              background: rgba(stats.$color-success, 0.15);
              color: stats.$color-success;
            }

            &.negative {
              background: rgba(stats.$color-danger, 0.15);
              color: stats.$color-danger;
            }

            &.neutral {
              background: rgba(var(--b3-theme-on-surface-rgb), 0.08);
              color: var(--b3-theme-on-surface);
              opacity: 0.5;
            }
          }
        }
      }
    }
  }

  // 标题行
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--b3-border-color);

    .section-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--b3-theme-primary);
    }

    .trend-stats-inline {
      display: flex;
      gap: 16px;
      font-size: 11px;

      .stat-item {
        color: var(--b3-theme-on-surface);
        opacity: 0.7;

        strong {
          color: var(--b3-theme-primary);
          font-weight: 700;
          margin-left: 4px;
        }
      }
    }
  }

  .historical-data-list {
    margin: 0;

    .historical-table-container {
      max-height: 280px;
      overflow-y: auto;
      border: 1px solid var(--b3-border-color);
      border-radius: 8px;
      @include scrollbar-thin;

      .historical-table {
        width: 100%;
        border-collapse: collapse;
        font-family: $font-body;
        font-size: 10px;

        thead {
          position: sticky;
          top: 0;
          z-index: 1;
          background: var(--b3-theme-surface);

          th {
            padding: 5px 8px;
            text-align: left;
            font-family: $font-heading;
            font-weight: 700;
            color: var(--b3-theme-on-surface);
            border-bottom: 1px solid var(--b3-border-color);
            background: var(--b3-theme-surface);

            .th-icon {
              margin-right: 3px;
            }

            &.col-date {
              width: 70px;
            }

            &.col-notes,
            &.col-words,
            &.col-created,
            &.col-modified {
              width: 50px;
              text-align: right;
            }

            &.col-change {
              width: 90px;
              text-align: center;
            }
          }
        }

        tbody {
          .historical-row {
            border-bottom: 1px solid var(--b3-border-color);

            &:last-child {
              border-bottom: none;
            }

            &.today {
              background: rgba(var(--b3-theme-primary-rgb), 0.05);
            }

            td {
              padding: 5px 8px;
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
                opacity: 0.9;
              }

              &.col-change {
                text-align: center;
              }

              .diff-tag {
                display: inline-block;
                padding: 1px 6px;
                border-radius: 3px;
                font-weight: 700;
                font-size: 10px;
                margin: 0 1px;
                font-family: $font-heading;

                &.success {
                  background: rgba(stats.$color-success, 0.12);
                  color: stats.$color-success;
                }

                &.danger {
                  background: rgba(stats.$color-danger, 0.12);
                  color: stats.$color-danger;
                }

                &.secondary {
                  background: rgba(var(--b3-theme-on-surface-rgb), 0.05);
                  color: var(--b3-theme-on-surface);
                  opacity: 0.5;
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
@include tablet-only {
  .trend-view {
    .comparison-section {
      grid-template-columns: 1fr;
    }
  }
}

@include mobile-only {
  .trend-view {
    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .historical-data-list {
      margin-left: 4px;
      margin-right: 4px;
    }
  }
}
</style>
