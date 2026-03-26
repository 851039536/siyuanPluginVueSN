<template>
  <div class="insight-cards">
    <!-- 第一行：称号卡片 + 连续活跃 -->
    <div class="insight-row">
      <!-- 活跃等级/称号卡片 -->
      <div class="insight-card level-card">
        <div class="card-header">
          <span class="card-icon">{{ currentLevel.icon }}</span>
          <span class="card-title">{{ i18n.writerLevel }}</span>
        </div>
        <div class="card-body">
          <div class="level-display">
            <div class="level-badge" :class="currentLevel.tier">
              <span class="badge-icon">{{ currentLevel.icon }}</span>
              <span class="badge-name">{{ currentLevel.name }}</span>
            </div>
          </div>
          <div class="level-progress">
            <div class="progress-info">
              <span class="progress-label">{{ i18n.expProgress }}</span>
              <span class="progress-value">{{ currentLevel.currentExp }} / {{ currentLevel.nextLevelExp }}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: currentLevel.progressPercent + '%' }"></div>
              <div class="progress-glow"></div>
            </div>
            <div class="next-level-hint">
              {{ i18n.toNextLevel }}: {{ currentLevel.nextLevelName }}
            </div>
          </div>
          <div class="level-benefits">
            <span v-for="benefit in currentLevel.benefits" :key="benefit" class="benefit-tag">
              {{ benefit }}
            </span>
          </div>
        </div>
      </div>

      <!-- 连续活跃天数 -->
      <div class="insight-card streak-card">
        <div class="card-header">
          <span class="card-icon">🔥</span>
          <span class="card-title">{{ i18n.streakDays }}</span>
        </div>
        <div class="card-body">
          <div class="streak-display">
            <div class="streak-number">{{ streakDays }}</div>
            <div class="streak-label">{{ i18n.daysStreak }}</div>
            <div v-if="maxStreakDays > streakDays" class="max-streak">
              🏆 {{ i18n.maxStreak }}: {{ maxStreakDays }} {{ i18n.days }}
            </div>
          </div>
          <div class="streak-reward">
            <div class="reward-title">{{ i18n.nextReward }}</div>
            <div class="reward-item">
              <span class="reward-icon">🎁</span>
              <span class="reward-text">{{ getNextStreakReward() }}</span>
              <span class="reward-progress">{{ streakDays }}/{{ nextStreakMilestone }}</span>
            </div>
            <div class="streak-flames">
              <span
                v-for="n in 7"
                :key="n"
                class="flame"
                :class="{ active: n <= streakDays, locked: n > streakDays }"
              >🔥</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 第二行：本周目标 + 热力图 -->
    <div class="insight-row">
      <!-- 本周目标 -->
      <div class="insight-card weekly-card">
        <div class="card-header">
          <span class="card-icon">🎯</span>
          <span class="card-title">{{ i18n.weeklyGoal }}</span>
        </div>
        <div class="card-body">
          <div class="weekly-progress">
            <div class="progress-ring">
              <svg viewBox="0 0 36 36">
                <path
                  class="ring-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  class="ring-fill"
                  :stroke-dasharray="`${weeklyProgress}, 100`"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div class="ring-text">{{ weeklyProgress.toFixed(0) }}%</div>
            </div>
            <div class="weekly-stats">
              <div class="stat-row">
                <span class="stat-label">{{ i18n.notesCreated }}</span>
                <span class="stat-value">{{ weeklyStats.created }} / {{ weeklyGoal.created }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ i18n.wordsWritten }}</span>
                <span class="stat-value">{{ formatNumber(weeklyStats.words) }} / {{ formatNumber(weeklyGoal.words) }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">{{ i18n.activeDays }}</span>
                <span class="stat-value">{{ weeklyStats.activeDays }} / 7</span>
              </div>
            </div>
          </div>
          <div class="weekly-days">
            <span
              v-for="(day, index) in weekDays"
              :key="index"
              class="day-dot"
              :class="{ active: day.active, today: day.isToday }"
            >
              {{ day.label }}
            </span>
          </div>
        </div>
      </div>

      <!-- 迷你热力日历 -->
      <div class="insight-card heatmap-card">
        <div class="card-header">
          <span class="card-icon">📊</span>
          <span class="card-title">{{ i18n.activityHeatmap }}</span>
        </div>
        <div class="card-body">
          <div class="heatmap-grid">
            <div
              v-for="(cell, index) in heatmapCells"
              :key="index"
              class="heatmap-cell"
              :class="cell.level"
              :title="cell.tooltip"
            ></div>
          </div>
          <div class="heatmap-legend">
            <span class="legend-label">{{ i18n.less }}</span>
            <span class="legend-cell level-0"></span>
            <span class="legend-cell level-1"></span>
            <span class="legend-cell level-2"></span>
            <span class="legend-cell level-3"></span>
            <span class="legend-cell level-4"></span>
            <span class="legend-label">{{ i18n.more }}</span>
          </div>
          <div class="heatmap-summary">
            <span>{{ i18n.last30Days }}: {{ activeDaysInMonth }} {{ i18n.activeDaysCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 第三行：知识财富 + 里程碑 -->
    <div class="insight-row">
      <!-- 知识财富值 -->
      <div class="insight-card wealth-card">
        <div class="card-header">
          <span class="card-icon">💎</span>
          <span class="card-title">{{ i18n.knowledgeWealth }}</span>
        </div>
        <div class="card-body">
          <div class="wealth-display">
            <div class="wealth-main">
              <span class="wealth-icon">💰</span>
              <span class="wealth-value">{{ formatNumber(knowledgeWealth.total) }}</span>
              <span class="wealth-unit">{{ i18n.gold }}</span>
            </div>
            <div class="wealth-breakdown">
              <div class="breakdown-item">
                <span class="breakdown-icon">📓</span>
                <span class="breakdown-label">{{ i18n.fromNotes }}</span>
                <span class="breakdown-value">+{{ formatNumber(knowledgeWealth.fromNotes) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-icon">✍️</span>
                <span class="breakdown-label">{{ i18n.fromWords }}</span>
                <span class="breakdown-value">+{{ formatNumber(knowledgeWealth.fromWords) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-icon">🔗</span>
                <span class="breakdown-label">{{ i18n.fromLinks }}</span>
                <span class="breakdown-value">+{{ formatNumber(knowledgeWealth.fromLinks) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-icon">🔥</span>
                <span class="breakdown-label">{{ i18n.fromStreak }}</span>
                <span class="breakdown-value">+{{ formatNumber(knowledgeWealth.fromStreak) }}</span>
              </div>
            </div>
          </div>
          <div class="wealth-rank">
            <span class="rank-label">{{ i18n.wealthRank }}:</span>
            <span class="rank-value">{{ wealthRank.title }}</span>
            <span class="rank-icon">{{ wealthRank.icon }}</span>
          </div>
        </div>
      </div>

      <!-- 里程碑成就 -->
      <div class="insight-card milestone-card">
        <div class="card-header">
          <span class="card-icon">🏆</span>
          <span class="card-title">{{ i18n.milestones }}</span>
          <span class="achieved-count">{{ achievedMilestones.length }}/{{ allMilestones.length }}</span>
        </div>
        <div class="card-body">
          <div class="milestones-grid">
            <div
              v-for="milestone in visibleMilestones"
              :key="milestone.id"
              class="milestone-item"
              :class="{ achieved: milestone.achieved, locked: !milestone.achieved }"
            >
              <span class="milestone-icon">{{ milestone.achieved ? milestone.icon : '🔒' }}</span>
              <span class="milestone-text">{{ milestone.label }}</span>
              <div v-if="!milestone.achieved" class="milestone-progress">
                <div class="mini-progress">
                  <div class="mini-fill" :style="{ width: milestone.progress + '%' }"></div>
                </div>
                <span class="progress-text">{{ milestone.progress.toFixed(0) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 第四行：年同比 -->
    <div class="insight-row single">
      <!-- 年同比 -->
      <div class="insight-card year-card">
        <div class="card-header">
          <span class="card-icon">📈</span>
          <span class="card-title">{{ i18n.yearOverYear }}</span>
        </div>
        <div class="card-body">
          <div class="year-comparison">
            <div class="comparison-row">
              <div class="year-col current">
                <div class="year-label">{{ currentYear }}</div>
                <div class="year-value">{{ formatNumber(yearStats.current.totalNotes) }}</div>
                <div class="year-unit">{{ i18n.notes }}</div>
              </div>
              <div class="comparison-arrow">
                <div
                  class="change-badge"
                  :class="yearStats.change.notes >= 0 ? 'positive' : 'negative'"
                >
                  {{ yearStats.change.notes >= 0 ? '↑' : '↓' }}
                  {{ Math.abs(yearStats.change.notes).toFixed(1) }}%
                </div>
              </div>
              <div class="year-col previous">
                <div class="year-label">{{ currentYear - 1 }}</div>
                <div class="year-value">{{ formatNumber(yearStats.previous.totalNotes) }}</div>
                <div class="year-unit">{{ i18n.notes }}</div>
              </div>
            </div>
            <div class="comparison-row">
              <div class="year-col current">
                <div class="year-value">{{ formatNumber(yearStats.current.totalWords) }}</div>
                <div class="year-unit">{{ i18n.words }}</div>
              </div>
              <div class="comparison-arrow">
                <div
                  class="change-badge"
                  :class="yearStats.change.words >= 0 ? 'positive' : 'negative'"
                >
                  {{ yearStats.change.words >= 0 ? '↑' : '↓' }}
                  {{ Math.abs(yearStats.change.words).toFixed(1) }}%
                </div>
              </div>
              <div class="year-col previous">
                <div class="year-value">{{ formatNumber(yearStats.previous.totalWords) }}</div>
                <div class="year-unit">{{ i18n.words }}</div>
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
    writerLevel: '写作等级',
    expProgress: '经验进度',
    toNextLevel: '距离下一等级',
    streakDays: '连续活跃',
    daysStreak: '天连续记录',
    maxStreak: '最长',
    days: '天',
    nextReward: '下个奖励',
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
    fromStreak: '连签奖励',
    wealthRank: '财富等级',
    milestones: '里程碑',
    yearOverYear: '年同比',
    notes: '笔记',
    words: '字数',
  }),
})

const currentYear = new Date().getFullYear()

// ============ 等级系统 ============
const levels = [
  { tier: 'bronze', name: '笔记新手', icon: '🌱', minExp: 0, benefits: ['基础功能'] },
  { tier: 'bronze', name: '记录学徒', icon: '📝', minExp: 100, benefits: ['基础功能'] },
  { tier: 'silver', name: '知识探索者', icon: '🔍', minExp: 500, benefits: ['基础功能', '数据统计'] },
  { tier: 'silver', name: '写作达人', icon: '✍️', minExp: 1500, benefits: ['基础功能', '数据统计'] },
  { tier: 'gold', name: '知识管理者', icon: '📚', minExp: 5000, benefits: ['基础功能', '数据统计', '高级分析'] },
  { tier: 'gold', name: '笔记大师', icon: '🎓', minExp: 15000, benefits: ['基础功能', '数据统计', '高级分析'] },
  { tier: 'platinum', name: '知识架构师', icon: '🏛️', minExp: 50000, benefits: ['全部功能', '专属徽章'] },
  { tier: 'platinum', name: '智慧行者', icon: '🌟', minExp: 100000, benefits: ['全部功能', '专属徽章', '尊享特权'] },
  { tier: 'diamond', name: '传奇作者', icon: '💎', minExp: 250000, benefits: ['全部功能', '专属徽章', '尊享特权', '名人堂'] },
  { tier: 'diamond', name: '知识之神', icon: '👑', minExp: 500000, benefits: ['全部特权'] },
]

const currentLevel = computed(() => {
  const exp = calculateExp()
  let current = levels[0]
  let next = levels[1]

  for (let i = 0; i < levels.length; i++) {
    if (exp >= levels[i].minExp) {
      current = levels[i]
      next = levels[i + 1] || levels[i]
    }
  }

  const currentExp = exp - current.minExp
  const neededExp = next.minExp - current.minExp
  const progressPercent = Math.min((currentExp / neededExp) * 100, 100)

  return {
    ...current,
    currentExp: exp,
    nextLevelExp: next.minExp,
    nextLevelName: next.name,
    progressPercent,
    benefits: current.benefits,
  }
})

function calculateExp(): number {
  let exp = 0
  exp += props.totalNotes * 10 // 每篇笔记10经验
  exp += Math.floor(props.totalWords / 100) // 每100字1经验
  exp += streakDays.value * 5 // 每连续天5经验
  exp += props.totalBacklinks * 3 // 每个双链3经验
  return exp
}

// ============ 连续活跃 ============
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
      checkDate.setDate(checkDate.getDate() - 1)
      i--
    } else {
      break
    }
  }

  return streak
})

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

const nextStreakMilestone = computed(() => {
  const milestones = [7, 14, 30, 60, 100, 180, 365]
  for (const m of milestones) {
    if (streakDays.value < m) return m
  }
  return 365
})

function getNextStreakReward(): string {
  const rewards: Record<number, string> = {
    7: '周坚持徽章 🏅',
    14: '双周勇士 🗡️',
    30: '月度达人 🌙',
    60: '双月冠军 👑',
    100: '百日传奇 ⭐',
    180: '半年大师 🎖️',
    365: '年度巨星 🌟',
  }
  return rewards[nextStreakMilestone.value] || '终极荣誉 💎'
}

// ============ 本周目标 ============
const weeklyGoal = { created: 7, words: 7000 }

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
  const fromStreak = streakDays.value * 20

  return {
    fromNotes,
    fromWords,
    fromLinks,
    fromStreak,
    total: fromNotes + fromWords + fromLinks + fromStreak,
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
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

$github-green: #2da44e;
$github-red: #cf222e;
$gold: #f59e0b;
$bronze: #cd7f32;
$silver: #c0c0c0;
$platinum: #e5e4e2;
$diamond: #b9f2ff;

.insight-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;

  .insight-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;

    &.single {
      grid-template-columns: 1fr;
    }
  }

  .insight-card {
    @include stats.stats-card-base;
    border: 1px solid var(--b3-border-color);
    border-radius: 10px;
    overflow: hidden;
    background: var(--b3-theme-surface);
    transition: all 0.2s ease;

    &:hover {
      border-color: rgba(var(--b3-theme-primary-rgb), 0.3);
      box-shadow: 0 2px 8px rgba(var(--b3-theme-primary-rgb), 0.1);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(var(--b3-theme-primary-rgb), 0.06);
      border-bottom: 1px solid var(--b3-border-color);

      .card-icon {
        font-size: 14px;
      }

      .card-title {
        flex: 1;
        font-family: $font-heading;
        font-size: 11px;
        font-weight: 700;
        color: var(--b3-theme-primary);
      }

      .achieved-count {
        font-size: 10px;
        color: var(--b3-theme-on-surface);
        opacity: 0.6;
      }
    }

    .card-body {
      padding: 10px 12px;
    }
  }
}

// 等级卡片
.level-card {
  .level-display {
    margin-bottom: 10px;

    .level-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: 700;
      font-family: $font-heading;

      &.bronze {
        background: linear-gradient(135deg, rgba($bronze, 0.2), rgba($bronze, 0.1));
        color: darken($bronze, 10%);
        border: 1px solid rgba($bronze, 0.3);
      }

      &.silver {
        background: linear-gradient(135deg, rgba($silver, 0.3), rgba($silver, 0.1));
        color: darken($silver, 20%);
        border: 1px solid rgba($silver, 0.4);
      }

      &.gold {
        background: linear-gradient(135deg, rgba($gold, 0.3), rgba($gold, 0.1));
        color: darken($gold, 15%);
        border: 1px solid rgba($gold, 0.5);
      }

      &.platinum {
        background: linear-gradient(135deg, rgba($platinum, 0.4), rgba($platinum, 0.2));
        color: darken($platinum, 30%);
        border: 1px solid rgba($platinum, 0.5);
      }

      &.diamond {
        background: linear-gradient(135deg, rgba($diamond, 0.4), rgba($diamond, 0.2));
        color: darken($diamond, 40%);
        border: 1px solid rgba($diamond, 0.5);
      }

      .badge-icon {
        font-size: 16px;
      }

      .badge-name {
        font-size: 12px;
      }
    }
  }

  .level-progress {
    margin-bottom: 8px;

    .progress-info {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      margin-bottom: 4px;

      .progress-label {
        opacity: 0.6;
      }

      .progress-value {
        font-weight: 600;
        color: var(--b3-theme-primary);
      }
    }

    .progress-bar {
      height: 6px;
      background: rgba(var(--b3-theme-primary-rgb), 0.1);
      border-radius: 3px;
      overflow: hidden;
      position: relative;

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--b3-theme-primary), rgba(var(--b3-theme-primary-rgb), 0.7));
        border-radius: 3px;
        transition: width 0.5s ease;
      }

      .progress-glow {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
        animation: shimmer 2s infinite;
      }
    }

    .next-level-hint {
      font-size: 8px;
      color: var(--b3-theme-on-surface);
      opacity: 0.5;
      margin-top: 4px;
      text-align: center;
    }
  }

  .level-benefits {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;

    .benefit-tag {
      font-size: 8px;
      padding: 2px 6px;
      background: rgba(var(--b3-theme-primary-rgb), 0.08);
      border-radius: 4px;
      color: var(--b3-theme-on-surface);
      opacity: 0.7;
    }
  }
}

// 连续活跃卡片
.streak-card {
  .streak-display {
    text-align: center;
    margin-bottom: 10px;

    .streak-number {
      font-family: $font-heading;
      font-size: 32px;
      font-weight: 800;
      background: linear-gradient(135deg, $gold, #ff8c00);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }

    .streak-label {
      font-size: 10px;
      color: var(--b3-theme-on-surface);
      opacity: 0.6;
    }

    .max-streak {
      font-size: 9px;
      color: var(--b3-theme-on-surface);
      opacity: 0.4;
      margin-top: 4px;
    }
  }

  .streak-reward {
    .reward-title {
      font-size: 9px;
      color: var(--b3-theme-on-surface);
      opacity: 0.5;
      margin-bottom: 4px;
    }

    .reward-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: rgba($gold, 0.1);
      border-radius: 6px;
      font-size: 10px;
      margin-bottom: 8px;

      .reward-icon {
        font-size: 12px;
      }

      .reward-text {
        flex: 1;
        font-weight: 600;
        color: darken($gold, 10%);
      }

      .reward-progress {
        font-size: 9px;
        opacity: 0.7;
      }
    }

    .streak-flames {
      display: flex;
      justify-content: center;
      gap: 4px;

      .flame {
        font-size: 14px;
        opacity: 0.3;
        transition: all 0.3s ease;

        &.active {
          opacity: 1;
          animation: flicker 1s ease-in-out infinite;
        }

        &.locked {
          filter: grayscale(1);
        }
      }
    }
  }
}

// 本周目标卡片
.weekly-card {
  .weekly-progress {
    display: flex;
    gap: 12px;
    margin-bottom: 10px;

    .progress-ring {
      position: relative;
      width: 50px;
      height: 50px;

      svg {
        transform: rotate(-90deg);
        width: 100%;
        height: 100%;
      }

      .ring-bg {
        fill: none;
        stroke: rgba(var(--b3-theme-primary-rgb), 0.1);
        stroke-width: 3;
      }

      .ring-fill {
        fill: none;
        stroke: var(--b3-theme-primary);
        stroke-width: 3;
        stroke-linecap: round;
        transition: stroke-dasharray 0.5s ease;
      }

      .ring-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 10px;
        font-weight: 700;
        font-family: $font-heading;
        color: var(--b3-theme-primary);
      }
    }

    .weekly-stats {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;

      .stat-row {
        display: flex;
        justify-content: space-between;
        font-size: 9px;

        .stat-label {
          opacity: 0.6;
        }

        .stat-value {
          font-weight: 600;
          color: var(--b3-theme-primary);
        }
      }
    }
  }

  .weekly-days {
    display: flex;
    justify-content: space-between;
    padding: 6px 4px;
    background: rgba(var(--b3-theme-primary-rgb), 0.03);
    border-radius: 6px;

    .day-dot {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      border-radius: 50%;
      background: rgba(var(--b3-theme-on-surface-rgb), 0.05);
      color: var(--b3-theme-on-surface);
      opacity: 0.5;
      transition: all 0.2s ease;

      &.active {
        background: rgba($github-green, 0.2);
        color: $github-green;
        opacity: 1;
      }

      &.today {
        border: 2px solid var(--b3-theme-primary);
        font-weight: 700;
        opacity: 1;
      }
    }
  }
}

// 热力日历卡片
.heatmap-card {
  .heatmap-grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 3px;
    margin-bottom: 8px;

    .heatmap-cell {
      aspect-ratio: 1;
      border-radius: 2px;
      transition: transform 0.2s ease;

      &:hover {
        transform: scale(1.2);
      }

      &.level-0 {
        background: rgba(var(--b3-theme-on-surface-rgb), 0.05);
      }

      &.level-1 {
        background: rgba($github-green, 0.2);
      }

      &.level-2 {
        background: rgba($github-green, 0.4);
      }

      &.level-3 {
        background: rgba($github-green, 0.6);
      }

      &.level-4 {
        background: $github-green;
      }
    }
  }

  .heatmap-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 3px;
    margin-bottom: 6px;

    .legend-label {
      font-size: 8px;
      color: var(--b3-theme-on-surface);
      opacity: 0.5;
    }

    .legend-cell {
      width: 8px;
      height: 8px;
      border-radius: 1px;

      &.level-0 {
        background: rgba(var(--b3-theme-on-surface-rgb), 0.05);
      }

      &.level-1 {
        background: rgba($github-green, 0.2);
      }

      &.level-2 {
        background: rgba($github-green, 0.4);
      }

      &.level-3 {
        background: rgba($github-green, 0.6);
      }

      &.level-4 {
        background: $github-green;
      }
    }
  }

  .heatmap-summary {
    font-size: 9px;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
    text-align: center;
  }
}

// 知识财富卡片
.wealth-card {
  .wealth-display {
    .wealth-main {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 10px;

      .wealth-icon {
        font-size: 20px;
        animation: float 3s ease-in-out infinite;
      }

      .wealth-value {
        font-family: $font-heading;
        font-size: 24px;
        font-weight: 800;
        background: linear-gradient(135deg, $gold, #ff8c00);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .wealth-unit {
        font-size: 10px;
        color: var(--b3-theme-on-surface);
        opacity: 0.6;
      }
    }

    .wealth-breakdown {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;

      .breakdown-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 9px;
        padding: 4px 6px;
        background: rgba(var(--b3-theme-primary-rgb), 0.03);
        border-radius: 4px;

        .breakdown-icon {
          font-size: 10px;
        }

        .breakdown-label {
          flex: 1;
          opacity: 0.6;
        }

        .breakdown-value {
          font-weight: 600;
          color: $github-green;
        }
      }
    }
  }

  .wealth-rank {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed var(--b3-border-color);

    .rank-label {
      font-size: 9px;
      opacity: 0.6;
    }

    .rank-value {
      font-size: 11px;
      font-weight: 700;
      color: var(--b3-theme-primary);
    }

    .rank-icon {
      font-size: 14px;
    }
  }
}

// 里程碑卡片
.milestone-card {
  .milestones-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;

    .milestone-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 6px;
      background: rgba(var(--b3-theme-primary-rgb), 0.03);
      border-radius: 6px;
      transition: all 0.2s ease;

      &.achieved {
        background: rgba($github-green, 0.1);

        .milestone-icon {
          font-size: 18px;
        }

        .milestone-text {
          color: $github-green;
          font-weight: 600;
        }
      }

      &.locked {
        opacity: 0.6;

        .milestone-icon {
          font-size: 14px;
        }
      }

      .milestone-icon {
        margin-bottom: 4px;
      }

      .milestone-text {
        font-size: 9px;
        text-align: center;
      }

      .milestone-progress {
        width: 100%;
        margin-top: 4px;

        .mini-progress {
          height: 3px;
          background: rgba(var(--b3-theme-primary-rgb), 0.1);
          border-radius: 2px;
          overflow: hidden;

          .mini-fill {
            height: 100%;
            background: var(--b3-theme-primary);
            transition: width 0.3s ease;
          }
        }

        .progress-text {
          font-size: 8px;
          color: var(--b3-theme-primary);
          opacity: 0.7;
        }
      }
    }
  }
}

// 年同比卡片
.year-card {
  .year-comparison {
    .comparison-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px dashed var(--b3-border-color);

      &:last-child {
        border-bottom: none;
      }

      .year-col {
        flex: 1;
        text-align: center;

        &.current .year-value {
          color: var(--b3-theme-primary);
        }

        &.previous .year-value {
          opacity: 0.5;
        }

        .year-label {
          font-size: 9px;
          opacity: 0.5;
        }

        .year-value {
          font-size: 14px;
          font-weight: 700;
          font-family: $font-heading;
        }

        .year-unit {
          font-size: 8px;
          opacity: 0.4;
        }
      }

      .comparison-arrow {
        flex: 0 0 50px;
        text-align: center;

        .change-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 700;

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

// 动画
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

@keyframes flicker {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(0.95); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

// 响应式设计
@include tablet-only {
  .insight-cards .insight-row {
    grid-template-columns: 1fr;
  }
}

@include mobile-only {
  .insight-cards {
    margin-left: 4px;
    margin-right: 4px;

    .insight-row {
      grid-template-columns: 1fr;
    }
  }
}
</style>
