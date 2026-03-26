<template>
  <div class="insight-cards">
    <!-- 连续活跃天数 -->
    <div class="insight-card streak-card">
      <div class="card-header">
        <span class="card-icon">🔥</span>
        <span class="card-title">{{ i18n.streakDays }}</span>
      </div>
      <div class="card-body">
        <div class="streak-number">{{ streakDays }}</div>
        <div class="streak-label">{{ i18n.daysStreak }}</div>
        <div v-if="maxStreakDays > 0" class="max-streak">
          {{ i18n.maxStreak }}: {{ maxStreakDays }} {{ i18n.days }}
        </div>
      </div>
      <div class="streak-flames">
        <span v-for="n in Math.min(streakDays, 7)" :key="n" class="flame">🔥</span>
      </div>
    </div>

    <!-- 里程碑成就 -->
    <div class="insight-card milestone-card">
      <div class="card-header">
        <span class="card-icon">🏆</span>
        <span class="card-title">{{ i18n.milestones }}</span>
      </div>
      <div class="card-body">
        <div class="milestones-list">
          <div
            v-for="milestone in achievedMilestones"
            :key="milestone.id"
            class="milestone-item achieved"
          >
            <span class="milestone-icon">{{ milestone.icon }}</span>
            <span class="milestone-text">{{ milestone.label }}</span>
          </div>
          <div v-if="nextMilestone" class="milestone-item next">
            <span class="milestone-icon">🎯</span>
            <span class="milestone-text">
              {{ nextMilestone.label }}
              <span class="progress-hint">({{ nextMilestone.remaining }} {{ i18n.remaining }})</span>
            </span>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: nextMilestone.progress + '%' }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 最佳记录 -->
    <div class="insight-card records-card">
      <div class="card-header">
        <span class="card-icon">⭐</span>
        <span class="card-title">{{ i18n.bestRecords }}</span>
      </div>
      <div class="card-body">
        <div class="record-item">
          <span class="record-label">{{ i18n.mostWordsDay }}</span>
          <span class="record-value">{{ formatNumber(bestRecords.mostWordsDay.words) }} {{ i18n.wordsUnit }}</span>
          <span class="record-date">{{ bestRecords.mostWordsDay.date }}</span>
        </div>
        <div class="record-item">
          <span class="record-label">{{ i18n.mostCreatedDay }}</span>
          <span class="record-value">{{ bestRecords.mostCreatedDay.count }} {{ i18n.notesUnit }}</span>
          <span class="record-date">{{ bestRecords.mostCreatedDay.date }}</span>
        </div>
        <div class="record-item">
          <span class="record-label">{{ i18n.longestNote }}</span>
          <span class="record-value">{{ formatNumber(bestRecords.longestNote.words) }} {{ i18n.wordsUnit }}</span>
        </div>
      </div>
    </div>

    <!-- 年同比 -->
    <div class="insight-card year-card">
      <div class="card-header">
        <span class="card-icon">📈</span>
        <span class="card-title">{{ i18n.yearOverYear }}</span>
      </div>
      <div class="card-body">
        <div class="year-comparison">
          <div class="year-col">
            <div class="year-label">{{ currentYear }}</div>
            <div class="year-value">{{ formatNumber(yearStats.current.totalNotes) }}</div>
            <div class="year-sub">{{ i18n.notes }}</div>
          </div>
          <div class="year-arrow">
            <span
              class="change-indicator"
              :class="yearStats.change.notes >= 0 ? 'positive' : 'negative'"
            >
              {{ yearStats.change.notes >= 0 ? '↑' : '↓' }}
              {{ Math.abs(yearStats.change.notes).toFixed(1) }}%
            </span>
          </div>
          <div class="year-col">
            <div class="year-label">{{ currentYear - 1 }}</div>
            <div class="year-value muted">{{ formatNumber(yearStats.previous.totalNotes) }}</div>
            <div class="year-sub">{{ i18n.notes }}</div>
          </div>
        </div>
        <div class="year-comparison">
          <div class="year-col">
            <div class="year-value">{{ formatNumber(yearStats.current.totalWords) }}</div>
            <div class="year-sub">{{ i18n.words }}</div>
          </div>
          <div class="year-arrow">
            <span
              class="change-indicator"
              :class="yearStats.change.words >= 0 ? 'positive' : 'negative'"
            >
              {{ yearStats.change.words >= 0 ? '↑' : '↓' }}
              {{ Math.abs(yearStats.change.words).toFixed(1) }}%
            </span>
          </div>
          <div class="year-col">
            <div class="year-value muted">{{ formatNumber(yearStats.previous.totalWords) }}</div>
            <div class="year-sub">{{ i18n.words }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '../utils'

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
  totalNotes?: number
  totalWords?: number
  i18n?: {
    streakDays: string
    daysStreak: string
    maxStreak: string
    days: string
    milestones: string
    bestRecords: string
    yearOverYear: string
    mostWordsDay: string
    mostCreatedDay: string
    longestNote: string
    wordsUnit: string
    notesUnit: string
    notes: string
    words: string
    remaining: string
  }
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  totalNotes: 0,
  totalWords: 0,
  i18n: () => ({
    streakDays: '连续活跃',
    daysStreak: '天连续记录',
    maxStreak: '最长',
    days: '天',
    milestones: '里程碑',
    bestRecords: '最佳记录',
    yearOverYear: '年同比',
    mostWordsDay: '单日字数最多',
    mostCreatedDay: '单日新增最多',
    longestNote: '最长笔记',
    wordsUnit: '字',
    notesUnit: '篇',
    notes: '笔记',
    words: '字数',
    remaining: '剩余',
  }),
})

const currentYear = new Date().getFullYear()

// 计算连续活跃天数
const streakDays = computed(() => {
  if (props.historicalData.length === 0) return 0

  const sortedData = [...props.historicalData].sort((a, b) => b.date.localeCompare(a.date))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  let checkDate = new Date(today)

  for (let i = 0; i < sortedData.length; i++) {
    const dateStr = formatDate(checkDate)
    const dayData = sortedData.find(d => d.date === dateStr)

    if (dayData && (dayData.todayCreated > 0 || dayData.todayModified > 0)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (i === 0) {
      // 今天还没有数据，检查昨天
      checkDate.setDate(checkDate.getDate() - 1)
      i--
    } else {
      break
    }
  }

  return streak
})

// 计算最长连续天数
const maxStreakDays = computed(() => {
  if (props.historicalData.length === 0) return 0

  const sortedData = [...props.historicalData].sort((a, b) => a.date.localeCompare(b.date))
  let maxStreak = 0
  let currentStreak = 0

  for (const data of sortedData) {
    if (data.todayCreated > 0 || data.todayModified > 0) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  return maxStreak
})

// 里程碑配置
const noteMilestones = [
  { id: 'notes-10', icon: '🌱', label: '10篇笔记', target: 10 },
  { id: 'notes-50', icon: '🌿', label: '50篇笔记', target: 50 },
  { id: 'notes-100', icon: '🌳', label: '100篇笔记', target: 100 },
  { id: 'notes-500', icon: '🌲', label: '500篇笔记', target: 500 },
  { id: 'notes-1000', icon: '🏔️', label: '1000篇笔记', target: 1000 },
]

const wordMilestones = [
  { id: 'words-1w', icon: '✍️', label: '1万字', target: 10000 },
  { id: 'words-5w', icon: '📝', label: '5万字', target: 50000 },
  { id: 'words-10w', icon: '📚', label: '10万字', target: 100000 },
  { id: 'words-50w', icon: '📖', label: '50万字', target: 500000 },
  { id: 'words-100w', icon: '🎓', label: '100万字', target: 1000000 },
]

// 已达成的里程碑
const achievedMilestones = computed(() => {
  const achieved: Array<{ id: string; icon: string; label: string }> = []

  for (const m of noteMilestones) {
    if (props.totalNotes >= m.target) {
      achieved.push(m)
    }
  }

  for (const m of wordMilestones) {
    if (props.totalWords >= m.target) {
      achieved.push(m)
    }
  }

  return achieved.slice(-3) // 只显示最近3个
})

// 下一个里程碑
const nextMilestone = computed(() => {
  const allMilestones = [...noteMilestones, ...wordMilestones]

  for (const m of noteMilestones) {
    if (props.totalNotes < m.target) {
      const progress = (props.totalNotes / m.target) * 100
      const remaining = m.target - props.totalNotes
      return { ...m, progress, remaining }
    }
  }

  for (const m of wordMilestones) {
    if (props.totalWords < m.target) {
      const progress = (props.totalWords / m.target) * 100
      const remaining = m.target - props.totalWords
      return { ...m, progress, remaining }
    }
  }

  return null
})

// 最佳记录
const bestRecords = computed(() => {
  let mostWordsDay = { words: 0, date: '-' }
  let mostCreatedDay = { count: 0, date: '-' }
  let longestNote = { words: 0 }

  for (const data of props.historicalData) {
    if (data.todayCreated > mostCreatedDay.count) {
      mostCreatedDay = { count: data.todayCreated, date: data.dateLabel }
    }
    // 用 todayModified 作为日字数的近似
    if (data.todayModified > mostWordsDay.words) {
      mostWordsDay = { words: data.todayModified, date: data.dateLabel }
    }
  }

  longestNote = { words: props.totalWords / Math.max(props.totalNotes, 1) }

  return { mostWordsDay, mostCreatedDay, longestNote }
})

// 年同比统计
const yearStats = computed(() => {
  const currentYearStart = new Date(currentYear, 0, 1)
  const previousYearStart = new Date(currentYear - 1, 0, 1)
  const previousYearEnd = new Date(currentYear - 1, 11, 31)

  let currentYearNotes = 0
  let currentYearWords = 0
  let previousYearNotes = 0
  let previousYearWords = 0

  const currentYearStr = currentYearStart.getFullYear().toString()
  const previousYearStr = previousYearStart.getFullYear().toString()

  for (const data of props.historicalData) {
    const year = data.date.substring(0, 4)
    if (year === currentYearStr) {
      currentYearNotes = data.totalNotes
      currentYearWords = data.totalWords
    } else if (year === previousYearStr) {
      previousYearNotes = data.totalNotes
      previousYearWords = data.totalWords
    }
  }

  const calcChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  return {
    current: { totalNotes: currentYearNotes, totalWords: currentYearWords },
    previous: { totalNotes: previousYearNotes, totalWords: previousYearWords },
    change: {
      notes: calcChange(currentYearNotes, previousYearNotes),
      words: calcChange(currentYearWords, previousYearWords),
    },
  }
})

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`
}

function padZero(num: number): string {
  return num < 10 ? '0' + num : String(num)
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

$github-green: #2da44e;
$github-red: #cf222e;
$gold: #f59e0b;

.insight-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 8px;

  .insight-card {
    @include stats.stats-card-base;
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    overflow: hidden;
    background: var(--b3-theme-surface);

    .card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: rgba(var(--b3-theme-primary-rgb), 0.06);
      border-bottom: 1px solid var(--b3-border-color);

      .card-icon {
        font-size: 14px;
      }

      .card-title {
        font-family: $font-heading;
        font-size: 11px;
        font-weight: 700;
        color: var(--b3-theme-primary);
      }
    }

    .card-body {
      padding: 10px;
    }
  }

  // 连续活跃卡片
  .streak-card {
    .streak-number {
      font-family: $font-heading;
      font-size: 28px;
      font-weight: 800;
      color: $gold;
      line-height: 1;
    }

    .streak-label {
      font-size: 10px;
      color: var(--b3-theme-on-surface);
      opacity: 0.6;
      margin-top: 2px;
    }

    .max-streak {
      font-size: 9px;
      color: var(--b3-theme-on-surface);
      opacity: 0.4;
      margin-top: 4px;
    }

    .streak-flames {
      display: flex;
      justify-content: center;
      gap: 2px;
      padding: 4px;
      background: rgba($gold, 0.08);

      .flame {
        font-size: 12px;
        animation: flicker 1s ease-in-out infinite;
        animation-delay: calc(var(--i, 0) * 0.1s);
      }
    }
  }

  // 里程碑卡片
  .milestone-card {
    .milestones-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .milestone-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;

      &.achieved {
        .milestone-icon {
          font-size: 12px;
        }

        .milestone-text {
          color: var(--b3-theme-on-surface);
          opacity: 0.8;
        }
      }

      &.next {
        flex-wrap: wrap;
        background: rgba(var(--b3-theme-primary-rgb), 0.05);
        padding: 6px;
        border-radius: 4px;

        .milestone-text {
          flex: 1;
          min-width: 0;
          font-weight: 600;
          color: var(--b3-theme-primary);
        }

        .progress-hint {
          font-size: 8px;
          opacity: 0.6;
        }

        .progress-bar {
          width: 100%;
          height: 3px;
          background: rgba(var(--b3-theme-primary-rgb), 0.1);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;

          .progress-fill {
            height: 100%;
            background: var(--b3-theme-primary);
            transition: width 0.3s ease;
          }
        }
      }
    }
  }

  // 最佳记录卡片
  .records-card {
    .record-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 4px 0;
      border-bottom: 1px dashed var(--b3-border-color);

      &:last-child {
        border-bottom: none;
      }

      .record-label {
        font-size: 9px;
        color: var(--b3-theme-on-surface);
        opacity: 0.5;
      }

      .record-value {
        font-size: 11px;
        font-weight: 700;
        color: var(--b3-theme-primary);
        font-family: $font-heading;
      }

      .record-date {
        font-size: 8px;
        color: var(--b3-theme-on-surface);
        opacity: 0.4;
      }
    }
  }

  // 年同比卡片
  .year-card {
    .year-comparison {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed var(--b3-border-color);

      &:last-child {
        border-bottom: none;
      }

      .year-col {
        text-align: center;
        flex: 1;

        .year-label {
          font-size: 9px;
          color: var(--b3-theme-on-surface);
          opacity: 0.5;
        }

        .year-value {
          font-size: 12px;
          font-weight: 700;
          color: var(--b3-theme-primary);
          font-family: $font-heading;

          &.muted {
            opacity: 0.5;
          }
        }

        .year-sub {
          font-size: 8px;
          opacity: 0.4;
        }
      }

      .year-arrow {
        flex: 0 0 50px;
        text-align: center;

        .change-indicator {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 10px;

          &.positive {
            background: rgba($github-green, 0.15);
            color: $github-green;
          }

          &.negative {
            background: rgba($github-red, 0.15);
            color: $github-red;
          }
        }
      }
    }
  }
}

@keyframes flicker {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(0.95); }
}

// 响应式设计
@include tablet-only {
  .insight-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@include mobile-only {
  .insight-cards {
    grid-template-columns: 1fr;
    margin-left: 4px;
    margin-right: 4px;
  }
}
</style>
