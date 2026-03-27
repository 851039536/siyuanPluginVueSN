<template>
  <div class="insight-cards">
    <!-- 第一行：本周目标 + 热力图 -->
    <div class="insight-row">
      <div class="insight-card">
        <div class="card-header">
          <span class="card-icon">🎯</span>
          <span class="card-title">{{ i18n.weeklyGoal }}</span>
        </div>
        <div class="card-body">
          <div class="weekly-progress">
            <div class="progress-ring">
              <svg viewBox="0 0 36 36">
                <path class="ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path class="ring-fill" :stroke-dasharray="`${weeklyProgress}, 100`" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <span class="ring-text">{{ weeklyProgress.toFixed(0) }}%</span>
            </div>
            <div class="weekly-stats">
              <div class="stat-row">
                <span>{{ i18n.notesCreated }}</span>
                <span>{{ weeklyStats.created }} / {{ weeklyGoal.created }}</span>
              </div>
              <div class="stat-row">
                <span>{{ i18n.wordsWritten }}</span>
                <span>{{ formatNumber(weeklyStats.words) }} / {{ formatNumber(weeklyGoal.words) }}</span>
              </div>
              <div class="stat-row">
                <span>{{ i18n.activeDays }}</span>
                <span>{{ weeklyStats.activeDays }} / 7</span>
              </div>
            </div>
          </div>
          <div class="weekly-days">
            <span v-for="(day, idx) in weekDays" :key="idx" :class="{ active: day.active, today: day.isToday }">{{ day.label }}</span>
          </div>
        </div>
      </div>

      <div class="insight-card">
        <div class="card-header">
          <span class="card-icon">📊</span>
          <span class="card-title">{{ i18n.activityHeatmap }}</span>
        </div>
        <div class="card-body">
          <div class="heatmap-grid">
            <div v-for="(cell, idx) in heatmapCells" :key="idx" :class="cell.level" :title="cell.tooltip"></div>
          </div>
          <div class="heatmap-legend">
            <span>{{ i18n.less }}</span>
            <span class="level-0"></span><span class="level-1"></span><span class="level-2"></span><span class="level-3"></span><span class="level-4"></span>
            <span>{{ i18n.more }}</span>
          </div>
          <div class="heatmap-summary">{{ i18n.last30Days }}: {{ activeDaysInMonth }} {{ i18n.activeDaysCount }}</div>
        </div>
      </div>
    </div>

    <!-- 第三行：知识财富（含年同比） + 里程碑 -->
    <div class="insight-row">
      <div class="insight-card fixed-height">
        <div class="card-header">
          <span class="card-icon">💎</span>
          <span class="card-title">{{ i18n.knowledgeWealth }}</span>
        </div>
        <div class="card-body scrollable">
          <div class="wealth-main">
            <span>💰</span>
            <span class="wealth-value">{{ formatNumber(knowledgeWealth.total) }}</span>
            <span class="wealth-unit">{{ i18n.gold }}</span>
          </div>
          <div class="wealth-breakdown">
            <div class="breakdown-item"><span>📓</span><span>{{ i18n.fromNotes }}</span><span>+{{ formatNumber(knowledgeWealth.fromNotes) }}</span></div>
            <div class="breakdown-item"><span>✍️</span><span>{{ i18n.fromWords }}</span><span>+{{ formatNumber(knowledgeWealth.fromWords) }}</span></div>
            <div class="breakdown-item"><span>🔗</span><span>{{ i18n.fromLinks }}</span><span>+{{ formatNumber(knowledgeWealth.fromLinks) }}</span></div>
          </div>
          <div class="wealth-rank">
            <span>{{ i18n.wealthRank }}:</span>
            <span>{{ wealthRank.title }}</span>
            <span>{{ wealthRank.icon }}</span>
          </div>
          <!-- 年同比简化版 -->
          <div class="year-compare">
            <span>📈 {{ i18n.yearOverYear }}</span>
            <span :class="yearStats.change.notes >= 0 ? 'up' : 'down'">
              {{ yearStats.change.notes >= 0 ? '↑' : '↓' }}{{ Math.abs(yearStats.change.notes).toFixed(0) }}%
            </span>
          </div>
        </div>
      </div>

      <div class="insight-card fixed-height">
        <div class="card-header">
          <span class="card-icon">🏆</span>
          <span class="card-title">{{ i18n.milestones }}</span>
          <span class="achieved-count">{{ achievedMilestones.length }}/{{ allMilestones.length }}</span>
        </div>
        <div class="card-body scrollable">
          <div class="milestones-grid">
            <div
              v-for="m in visibleMilestones"
              :key="m.id"
              class="milestone-item"
              :class="{ achieved: m.achieved }"
            >
              <span class="milestone-icon">{{ m.achieved ? m.icon : '🔒' }}</span>
              <span class="milestone-text">{{ m.label }}</span>
              <div v-if="!m.achieved" class="mini-progress">
                <div class="mini-fill" :style="{ width: m.progress + '%' }"></div>
              </div>
            </div>
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
  totalBacklinks?: number
  i18n?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  historicalData: () => [],
  totalNotes: 0,
  totalWords: 0,
  totalBacklinks: 0,
  i18n: () => ({
    weeklyGoal: '本周目标',
    notesCreated: '新建笔记',
    wordsWritten: '写作字数',
    activeDays: '活跃天数',
    activityHeatmap: '活跃热力图',
    less: '少',
    more: '多',
    last30Days: '近30天',
    activeDaysCount: '天活跃',
    knowledgeWealth: '知识财富',
    gold: '金币',
    fromNotes: '笔记贡献',
    fromWords: '字数贡献',
    fromLinks: '双链贡献',
    wealthRank: '财富等级',
    milestones: '里程碑',
    yearOverYear: '年同比',
    notes: '笔记',
    words: '字数',
  }),
})

const currentYear = new Date().getFullYear()

// ============ 本周目标 ============
const weeklyGoal = { created: 30, words: 100000 }

const weeklyStats = computed(() => {
  const now = new Date()
  const dayOfWeek = now.getDay() || 7
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - dayOfWeek + 1)
  weekStart.setHours(0, 0, 0, 0)

  let created = 0
  let words = 0
  let activeDays = 0
  const activeSet = new Set<string>()

  for (const data of props.historicalData) {
    const dataDate = new Date(data.date)
    if (dataDate >= weekStart && dataDate <= now) {
      created += data.todayCreated
      words += data.todayModified
      if (data.todayCreated > 0 || data.todayModified > 0) {
        activeSet.add(data.date)
        activeDays = activeSet.size
      }
    }
  }

  return { created, words, activeDays }
})

const weeklyProgress = computed(() => {
  const notesProgress = (weeklyStats.value.created / weeklyGoal.created) * 50
  const wordsProgress = (weeklyStats.value.words / weeklyGoal.words) * 50
  return Math.min(notesProgress + wordsProgress, 100)
})

const weekDays = computed(() => {
  const days = []
  const now = new Date()
  const dayOfWeek = now.getDay() || 7

  for (let i = 0; i < 7; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - dayOfWeek + 1 + i)
    const dateStr = formatDate(date)
    const dayData = props.historicalData.find(d => d.date === dateStr)

    days.push({
      label: ['一', '二', '三', '四', '五', '六', '日'][i],
      active: dayData && (dayData.todayCreated > 0 || dayData.todayModified > 0),
      isToday: dateStr === formatDate(now),
    })
  }

  return days
})

// ============ 热力日历 ============
const heatmapCells = computed(() => {
  const cells = []
  const now = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = formatDate(date)
    const dayData = props.historicalData.find(d => d.date === dateStr)

    const activity = dayData ? (dayData.todayCreated + dayData.todayModified) : 0
    let level = 'level-0'
    if (activity > 0) level = 'level-1'
    if (activity > 5) level = 'level-2'
    if (activity > 15) level = 'level-3'
    if (activity > 30) level = 'level-4'

    cells.push({
      date: dateStr,
      level,
      tooltip: `${dateStr}: ${activity}次操作`,
    })
  }

  return cells
})

const activeDaysInMonth = computed(() => {
  return heatmapCells.value.filter(c => c.level !== 'level-0').length
})

// ============ 知识财富 ============
const knowledgeWealth = computed(() => {
  const fromNotes = props.totalNotes * 100
  const fromWords = Math.floor(props.totalWords / 10)
  const fromLinks = props.totalBacklinks * 50

  return {
    fromNotes,
    fromWords,
    fromLinks,
    total: fromNotes + fromWords + fromLinks,
  }
})

const wealthRank = computed(() => {
  const notes = props.totalNotes
  // 参考里程碑：500、1500、3000、3500、4000、5000、7500、10000
  if (notes >= 10000) return { title: '笔记之神', icon: '👑' }
  if (notes >= 7500) return { title: '传奇作者', icon: '💎' }
  if (notes >= 5000) return { title: '知识架构师', icon: '🌟' }
  if (notes >= 4000) return { title: '笔记大师', icon: '🎓' }
  if (notes >= 3500) return { title: '知识管理者', icon: '📚' }
  if (notes >= 3000) return { title: '写作达人', icon: '✍️' }
  if (notes >= 1500) return { title: '知识探索者', icon: '🔍' }
  if (notes >= 500) return { title: '记录学徒', icon: '📝' }
  return { title: '笔记新手', icon: '🌱' }
})

// ============ 里程碑 ============
const allMilestones = [
  // 笔记里程碑：500篇起
  { id: 'notes-500', icon: '🌱', label: '500篇笔记', target: 500, type: 'notes' },
  { id: 'notes-1500', icon: '🌿', label: '1500篇笔记', target: 1500, type: 'notes' },
  { id: 'notes-3000', icon: '🌳', label: '3000篇笔记', target: 3000, type: 'notes' },
  { id: 'notes-3500', icon: '🌲', label: '3500篇笔记', target: 3500, type: 'notes' },
  { id: 'notes-4000', icon: '🏔️', label: '4000篇笔记', target: 4000, type: 'notes' },
  { id: 'notes-5000', icon: '⛰️', label: '5000篇笔记', target: 5000, type: 'notes' },
  { id: 'notes-7500', icon: '🗻', label: '7500篇笔记', target: 7500, type: 'notes' },
  { id: 'notes-10000', icon: '🏔️', label: '1万篇笔记', target: 10000, type: 'notes' },
  // 字数里程碑：50万字起
  { id: 'words-50w', icon: '📚', label: '50万字', target: 500000, type: 'words' },
  { id: 'words-100w', icon: '🎓', label: '100万字', target: 1000000, type: 'words' },
  { id: 'words-200w', icon: '📖', label: '200万字', target: 2000000, type: 'words' },
  { id: 'words-300w', icon: '📜', label: '300万字', target: 3000000, type: 'words' },
  { id: 'words-500w', icon: '🏆', label: '500万字', target: 5000000, type: 'words' },
  { id: 'words-1000w', icon: '👑', label: '1000万字', target: 10000000, type: 'words' },
  { id: 'words-5000w', icon: '💎', label: '5000万字', target: 50000000, type: 'words' },
  { id: 'words-1yi', icon: '🌟', label: '1亿字', target: 100000000, type: 'words' },
]

const achievedMilestones = computed(() => {
  return allMilestones.filter(m => {
    const current = m.type === 'notes' ? props.totalNotes : props.totalWords
    return current >= m.target
  })
})

const visibleMilestones = computed(() => {
  return allMilestones.map(m => {
    const current = m.type === 'notes' ? props.totalNotes : props.totalWords
    const achieved = current >= m.target
    const progress = achieved ? 100 : Math.min((current / m.target) * 100, 100)
    return { ...m, achieved, progress }
  })
})

// ============ 年同比 ============
const yearStats = computed(() => {
  const currentYearStr = currentYear.toString()
  const previousYearStr = (currentYear - 1).toString()

  let currentYearNotes = 0
  let currentYearWords = 0
  let previousYearNotes = 0
  let previousYearWords = 0

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

// ============ 工具函数 ============
function formatDate(date: Date): string {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`
}

function padZero(num: number): string {
  return num < 10 ? '0' + num : String(num)
}
</script>

<style scoped lang="scss">
@use "sass:color";
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

$green: #2da44e;
$red: #cf222e;
$gold: #f59e0b;

.insight-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;

  .insight-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .insight-card {
    @include stats.stats-card-base;
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    overflow: hidden;
    background: var(--b3-theme-surface);

    &.fixed-height { height: 180px; display: flex; flex-direction: column; }

    .card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(var(--b3-theme-primary-rgb), 0.06);
      border-bottom: 1px solid var(--b3-border-color);

      .card-icon { font-size: 14px; }
      .card-title { flex: 1; font-size: 11px; font-weight: 700; color: var(--b3-theme-primary); }
      .achieved-count { font-size: 10px; opacity: 0.6; }
    }

    .card-body { padding: 10px 12px; }
    .card-body.scrollable { flex: 1; overflow: auto; }
  }
}

// 本周目标
.weekly-progress { display: flex; gap: 12px; margin-bottom: 10px; }
.progress-ring { position: relative; width: 50px; height: 50px;
  svg { transform: rotate(-90deg); width: 100%; height: 100%; }
  .ring-bg { fill: none; stroke: rgba(var(--b3-theme-primary-rgb), 0.1); stroke-width: 3; }
  .ring-fill { fill: none; stroke: var(--b3-theme-primary); stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 0.5s ease; }
  .ring-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10px; font-weight: 700; color: var(--b3-theme-primary); }
}
.weekly-stats { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 4px;
  .stat-row { display: flex; justify-content: space-between; font-size: 9px;
    span:first-child { opacity: 0.6; }
    span:last-child { font-weight: 600; color: var(--b3-theme-primary); }
  }
}
.weekly-days { display: flex; justify-content: space-between; padding: 6px 4px; background: rgba(var(--b3-theme-primary-rgb), 0.03); border-radius: 6px;
  span { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 9px; border-radius: 50%; background: rgba(var(--b3-theme-on-surface-rgb), 0.05); opacity: 0.5;
    &.active { background: rgba($green, 0.2); color: $green; opacity: 1; }
    &.today { border: 2px solid var(--b3-theme-primary); font-weight: 700; opacity: 1; }
  }
}

// 热力图
.heatmap-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; margin-bottom: 8px;
  div { aspect-ratio: 1; border-radius: 2px; transition: transform 0.2s ease; cursor: pointer;
    &:hover { transform: scale(1.2); }
    &.level-0 { background: rgba(var(--b3-theme-on-surface-rgb), 0.05); }
    &.level-1 { background: rgba($green, 0.2); }
    &.level-2 { background: rgba($green, 0.4); }
    &.level-3 { background: rgba($green, 0.6); }
    &.level-4 { background: $green; }
  }
}
.heatmap-legend { display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-bottom: 6px; font-size: 8px; opacity: 0.5;
  span:not(.level-0):not(.level-1):not(.level-2):not(.level-3):not(.level-4) { }
  .level-0, .level-1, .level-2, .level-3, .level-4 { width: 8px; height: 8px; border-radius: 1px; }
  .level-0 { background: rgba(var(--b3-theme-on-surface-rgb), 0.05); }
  .level-1 { background: rgba($green, 0.2); }
  .level-2 { background: rgba($green, 0.4); }
  .level-3 { background: rgba($green, 0.6); }
  .level-4 { background: $green; }
}
.heatmap-summary { font-size: 9px; opacity: 0.6; text-align: center; }

// 知识财富
.wealth-main { display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 10px;
  .wealth-value { font-size: 24px; font-weight: 800; background: linear-gradient(135deg, $gold, #ff8c00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .wealth-unit { font-size: 10px; opacity: 0.6; }
}
.wealth-breakdown { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;
  .breakdown-item { display: flex; align-items: center; gap: 4px; font-size: 9px; padding: 4px 6px; background: rgba(var(--b3-theme-primary-rgb), 0.03); border-radius: 4px;
    span:nth-child(2) { flex: 1; opacity: 0.6; }
    span:last-child { font-weight: 600; color: $green; }
  }
}
.wealth-rank { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--b3-border-color); font-size: 9px;
  span:nth-child(2) { font-size: 11px; font-weight: 700; color: var(--b3-theme-primary); }
}
.year-compare { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--b3-border-color); font-size: 10px;
  .up { color: $green; font-weight: 600; }
  .down { color: $red; font-weight: 600; }
}

// 里程碑
.milestones-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.milestone-item { display: flex; flex-direction: column; align-items: center; padding: 8px 6px; background: rgba(var(--b3-theme-primary-rgb), 0.03); border-radius: 6px;
  &.achieved { background: rgba($green, 0.1);
    .milestone-text { color: $green; font-weight: 600; }
  }
  &:not(.achieved) { opacity: 0.6; }
  .milestone-icon { margin-bottom: 4px; }
  .milestone-text { font-size: 9px; text-align: center; }
  .mini-progress { width: 100%; height: 3px; background: rgba(var(--b3-theme-primary-rgb), 0.1); border-radius: 2px; margin-top: 4px; overflow: hidden;
    .mini-fill { height: 100%; background: var(--b3-theme-primary); transition: width 0.3s ease; }
  }
}

@include tablet-only {
  .insight-cards .insight-row { grid-template-columns: 1fr; }
}
</style>
