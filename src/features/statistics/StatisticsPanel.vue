<template>
  <div class="statistics-panel" :class="`theme-${currentTheme}`">
    <!-- 顶部操作栏 -->
    <div class="statistics-header">
      <button class="refresh-btn" :title="i18n.refresh || '刷新'" @click="refreshData" :disabled="loading">
        <svg class="icon" :class="{ rotating: loading }"><use xlink:href="#iconRefresh"></use></svg>
      </button>
      <button class="theme-toggle-btn" @click="toggleTheme" :title="i18n.toggleTheme || '切换主题'">
        <span class="theme-icon">{{ currentTheme === 'default' ? '🌈' : '🐙' }}</span>
        <span class="theme-text">{{ currentTheme === 'default' ? (i18n.defaultTheme || '默认') : (i18n.githubTheme || 'GitHub') }}</span>
      </button>
      <div class="last-update">{{ i18n.lastUpdate }}: {{ lastUpdateTime }}</div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && !stats" class="loading-state">
      <div class="loading-spinner"></div>
      <p>{{ i18n.loading || '加载中...' }}</p>
    </div>

    <!-- 主要内容 -->
    <div v-else-if="stats" class="statistics-content">
      <!-- 顶部卡片统计 - 紧凑布局 -->
      <div class="stats-cards-compact">
        <!-- 主要统计：笔记和字数 -->
        <div class="stat-card-main">
          <div class="stat-item-inline">
            <span class="stat-icon">📓</span>
            <div class="stat-content">
              <div class="stat-value">{{ formatNumber(stats.totalNotes) }}</div>
              <div class="stat-label">{{ i18n.totalNotes }}</div>
            </div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item-inline">
            <span class="stat-icon">✍️</span>
            <div class="stat-content">
              <div class="stat-value">{{ formatNumber(stats.totalWords) }}</div>
              <div class="stat-label">{{ i18n.totalWords }}</div>
            </div>
          </div>
        </div>

        <!-- 次要统计：内容和关系 -->
        <div class="stat-card-secondary">
          <div class="stat-item-small">
            <span class="stat-icon-small">🧩</span>
            <span class="stat-value-small">{{ formatShortNumber(stats.totalBlocks) }}</span>
            <span class="stat-label-small">{{ i18n.totalBlocks }}</span>
          </div>
          <div class="stat-item-small">
            <span class="stat-icon-small">📎</span>
            <span class="stat-value-small">{{ formatShortNumber(stats.totalAssets) }}</span>
            <span class="stat-label-small">{{ i18n.totalAssets }}</span>
          </div>
          <div class="stat-item-small">
            <span class="stat-icon-small">🏷️</span>
            <span class="stat-value-small">{{ formatShortNumber(stats.totalTags) }}</span>
            <span class="stat-label-small">{{ i18n.totalTags }}</span>
          </div>
          <div class="stat-item-small">
            <span class="stat-icon-small">🔗</span>
            <span class="stat-value-small">{{ formatShortNumber(stats.totalBacklinks) }}</span>
            <span class="stat-label-small">{{ i18n.totalBacklinks }}</span>
          </div>
        </div>
      </div>

      <!-- 新增统计卡片 - 卡片形式 -->
      <div class="extended-stats-cards">
        <div class="stat-card-small gradient-1">
          <div class="card-icon">📅</div>
          <div class="card-content">
            <div class="card-value-small">{{ stats.todayCreated }}</div>
            <div class="card-label-small">{{ i18n.todayCreated || '今日新增' }}</div>
          </div>
        </div>
        <div class="stat-card-small gradient-2">
          <div class="card-icon">✏️</div>
          <div class="card-content">
            <div class="card-value-small">{{ stats.todayModified }}</div>
            <div class="card-label-small">{{ i18n.todayModified || '今日修改' }}</div>
          </div>
        </div>
        <div class="stat-card-small gradient-3">
          <div class="card-icon">📊</div>
          <div class="card-content">
            <div class="card-value-small">{{ stats.avgWordsPerDoc }}</div>
            <div class="card-label-small">{{ i18n.avgWordsPerDoc || '平均字数' }}</div>
          </div>
        </div>
      </div>

      <!-- 查看模式切换 -->
      <div class="view-mode-section">
        <div class="mode-tabs">
          <button
            v-for="mode in viewModes"
            :key="mode.value"
            class="mode-tab"
            :class="{ active: viewMode === mode.value }"
            @click="viewMode = mode.value"
          >
            {{ mode.icon }} {{ mode.label }}
          </button>
        </div>

        <!-- 时段平均每日字数 -->
        <div v-if="periodAvgWords > 0" class="period-avg-card">
          <span class="avg-label">{{ getPeriodAvgLabel() }}</span>
          <span class="avg-value">{{ formatNumber(periodAvgWords) }} {{ i18n.words || '字' }}</span>
        </div>

        <!-- 日视图范围选择 -->
        <div v-if="viewMode === 'day'" class="range-selector">
          <button
            v-for="range in dayRanges"
            :key="range.value"
            class="range-btn"
            :class="{ active: dayRange === range.value }"
            @click="dayRange = range.value; loadChartData()"
          >
            {{ range.label }}
          </button>
        </div>

        <!-- 月视图范围选择 -->
        <div v-if="viewMode === 'month'" class="range-selector">
          <button
            v-for="range in monthRanges"
            :key="range.value"
            class="range-btn"
            :class="{ active: monthYearRange === range.value }"
            @click="monthYearRange = range.value; loadChartData()"
          >
            {{ range.label }}
          </button>
        </div>

        <!-- 年视图选择 -->
        <div v-if="viewMode === 'year'" class="year-selector">
          <select v-model="selectedYear" @change="loadChartData" class="year-select">
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
          </select>
        </div>
      </div>

      <!-- 图表区域 -->
      <div class="chart-section">
        <h3 class="section-title">{{ chartTitle }}</h3>
        
        <!-- 柱状图 -->
        <div v-if="chartData.length > 0" class="bar-chart">
          <div class="chart-container">
            <div
              v-for="(item, index) in chartData"
              :key="index"
              class="bar-item"
              :style="{ flex: chartData.length > 12 ? '0 0 auto' : '1' }"
            >
              <div
                v-if="item.words > 0"
                class="bar-value"
                :style="{ bottom: getBarHeight(item.words) + 'px' }"
              >
                {{ formatShortNumber(item.words) }}
              </div>
              <div
                class="bar"
                :class="{ today: isToday(item.date) }"
                :style="{ height: getBarHeight(item.words) + 'px' }"
                :title="`${item.dateLabel}: ${formatNumber(item.words)} ${i18n.words}`"
              ></div>
              <div class="bar-label" :class="{ today: isToday(item.date) }">
                {{ formatChartLabel(item.dateLabel) }}
              </div>
            </div>
          </div>
        </div>

        <!-- 数据列表 -->
        <div class="data-list">
          <div
            v-for="item in chartData"
            :key="item.date"
            class="data-item"
            :class="{ active: item.words > 0, today: isToday(item.date) }"
          >
            <span class="data-date">{{ item.dateLabel }}</span>
            <span class="data-value">{{ formatNumber(item.words) }}</span>
          </div>
          <div v-if="chartData.length === 0" class="empty-state">
            {{ i18n.noData }}
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <p>{{ i18n.noData || '暂无数据' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

interface Props {
  i18n?: Record<string, any>
  theme?: 'default' | 'github'
  onThemeChange?: (theme: 'default' | 'github') => void
  onRefresh?: (params: {
    viewMode: 'day' | 'week' | 'month' | 'year'
    dayRange?: 7 | 15 | 30 | 90 | 180 | 365
    monthYearRange?: 1 | 2 | 3
    selectedYear?: number
  }) => Promise<StatisticsData>
}

interface StatisticsData {
  totalNotes: number
  totalWords: number
  totalBlocks: number
  totalAssets: number
  totalTags: number
  totalBacklinks: number
  todayCreated: number
  todayModified: number
  avgWordsPerDoc: number
  dailyStats: DailyWordCount[]
  currentPeriod: string
  topTags: Array<{ name: string; count: number }>
  recentDocs: Array<{ id: string; title: string; updated: string; words: number }>
}

interface DailyWordCount {
  date: string
  words: number
  dateLabel: string
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  theme: 'default',
})

// 状态
const loading = ref(false)
const stats = ref<StatisticsData | null>(null)
const lastUpdateTime = ref('')
const viewMode = ref<'day' | 'week' | 'month' | 'year'>('day')
const dayRange = ref<7 | 15 | 30 | 90 | 180 | 365>(7)
const monthYearRange = ref<1 | 2 | 3>(1)
const selectedYear = ref<number>(new Date().getFullYear())
const chartData = ref<DailyWordCount[]>([])
const currentTheme = ref<'default' | 'github'>(props.theme || 'default')

// 视图模式选项
const viewModes = computed(() => [
  { value: 'day' as const, label: props.i18n.dayView || '日', icon: '📅' },
  { value: 'week' as const, label: props.i18n.weekView || '周', icon: '📊' },
  { value: 'month' as const, label: props.i18n.monthView || '月', icon: '📆' },
  { value: 'year' as const, label: props.i18n.yearView || '年', icon: '📈' },
])

// 日视图范围选项
const dayRanges = computed(() => [
  { value: 7 as const, label: props.i18n.recent7Days || '7天' },
  { value: 15 as const, label: props.i18n.recent15Days || '15天' },
  { value: 30 as const, label: props.i18n.recent30Days || '30天' },
  { value: 90 as const, label: props.i18n.recent90Days || '季度' },
  { value: 180 as const, label: props.i18n.recent180Days || '半年' },
  { value: 365 as const, label: props.i18n.recent365Days || '整年' },
])

// 月视图范围选项
const monthRanges = computed(() => [
  { value: 1 as const, label: props.i18n.recentYear || '最近一年' },
  { value: 2 as const, label: props.i18n.recent2Years || '最近两年' },
  { value: 3 as const, label: props.i18n.recent3Years || '最近三年' },
])

// 可用年份
const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let year = currentYear; year >= 2020; year--) {
    years.push(year)
  }
  return years
})

// 图表标题
const chartTitle = computed(() => {
  return stats.value?.currentPeriod || ''
})

// 计算时段平均每日字数
const periodAvgWords = computed(() => {
  if (!chartData.value || chartData.value.length === 0) return 0
  
  const totalWords = chartData.value.reduce((sum, item) => sum + item.words, 0)
  const days = chartData.value.length
  
  return days > 0 ? Math.round(totalWords / days) : 0
})

// 获取时段平均标签
function getPeriodAvgLabel(): string {
  const labels: Record<string, string> = {
    'day': props.i18n.dailyAvgWords || '日均字数',
    'week': props.i18n.weeklyAvgWords || '周均字数',
    'month': props.i18n.monthlyAvgWords || '月均字数',
    'year': props.i18n.yearlyAvgWords || '年均字数',
  }
  return labels[viewMode.value] || props.i18n.avgWords || '平均字数'
}

// 监听视图模式变化
watch(viewMode, () => {
  refreshData()
})

// 监听主题变化
watch(() => props.theme, (newTheme) => {
  if (newTheme) {
    currentTheme.value = newTheme
  }
})

// 刷新数据
async function refreshData() {
  if (!props.onRefresh) return
  
  loading.value = true
  try {
    stats.value = await props.onRefresh({
      viewMode: viewMode.value,
      dayRange: dayRange.value,
      monthYearRange: monthYearRange.value,
      selectedYear: selectedYear.value,
    })
    chartData.value = stats.value.dailyStats || []
    lastUpdateTime.value = new Date().toLocaleString('zh-CN')
  } catch (error) {
    console.error('刷新统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载图表数据（已废弃，直接调用 refreshData）
function loadChartData() {
  refreshData()
}

// 格式化数字
function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

// 格式化简短数字
function formatShortNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return String(num)
}

// 获取柱状图高度
function getBarHeight(words: number): number {
  if (!chartData.value.length) return 0
  const maxWords = Math.max(...chartData.value.map(d => d.words))
  if (maxWords === 0) return 0
  const maxHeight = 150
  const height = (words / maxWords) * maxHeight
  return Math.max(height, words > 0 ? 5 : 0)
}

// 判断是否为今天
function isToday(dateStr: string): boolean {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`
  
  if (dateStr.length === 10) {
    return dateStr === todayStr
  } else if (dateStr.length === 7) {
    return dateStr === todayStr.substring(0, 7)
  } else if (dateStr.length === 4) {
    return dateStr === String(today.getFullYear())
  }
  return false
}

// 格式化图表标签
function formatChartLabel(label: string): string {
  if (viewMode.value === 'day') {
    return label
  } else if (viewMode.value === 'month') {
    return label.split(' ')[1] || label.split('/')[1] || label
  }
  return label
}

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return props.i18n.today || '今天'
  if (days === 1) return props.i18n.yesterday || '昨天'
  if (days < 7) return `${days} ${props.i18n.daysAgo || '天前'}`

  return date.toLocaleDateString('zh-CN')
}

// 数字补零
function padZero(num: number): string {
  return num < 10 ? '0' + num : String(num)
}

// 切换主题
function toggleTheme() {
  const newTheme = currentTheme.value === 'default' ? 'github' : 'default'
  currentTheme.value = newTheme
  if (props.onThemeChange) {
    props.onThemeChange(newTheme)
  }
}

// 初始化
onMounted(() => {
  // 立即显示加载状态
  loading.value = true
  refreshData()
})

// 暴露方法给父组件
defineExpose({
  refreshData,
})
</script>

<style scoped lang="scss">
.statistics-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  overflow: hidden;
}

.statistics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  flex-shrink: 0;

  .refresh-btn {
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: transparent;
    color: var(--b3-theme-primary);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-background);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .icon {
      width: 14px;
      height: 14px;

      &.rotating {
        animation: rotate 1s linear infinite;
      }
    }
  }

  .theme-toggle-btn {
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: transparent;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;

    &:hover {
      background: var(--b3-theme-surface-lighter);
      border-color: var(--b3-theme-primary);
    }

    .theme-icon {
      font-size: 14px;
    }

    .theme-text {
      font-weight: 500;
    }
  }

  .last-update {
    font-size: 10px;
    color: var(--b3-theme-on-surface-light);
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--b3-theme-on-surface-light);

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--b3-border-color);
    border-top-color: var(--b3-theme-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 12px;
  }

  p {
    font-size: 12px;
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--b3-theme-on-surface-light);
  font-size: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.statistics-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--b3-theme-surface-lighter);
    border-radius: 3px;

    &:hover {
      background: var(--b3-theme-on-surface-variant);
    }
  }
}

.stats-cards-compact {
  margin-bottom: 16px;

  .stat-card-main {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 8px;
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .theme-github & {
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      border: 1px solid var(--b3-border-color);
      box-shadow: none;

      &:hover {
        transform: none;
        border-color: var(--b3-theme-primary);
      }
    }

    .stat-item-inline {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;

      .stat-icon {
        font-size: 32px;
        flex-shrink: 0;
      }

      .stat-content {
        flex: 1;

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 2px;
        }

        .stat-label {
          font-size: 11px;
          opacity: 0.9;
        }
      }
    }

    .stat-divider {
      width: 1px;
      height: 40px;
      background: rgba(255, 255, 255, 0.3);
      margin: 0 8px;
    }
  }

  .stat-card-secondary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border-radius: 8px;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .theme-github & {
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      border: 1px solid var(--b3-border-color);
      box-shadow: none;

      &:hover {
        transform: none;
        border-color: var(--b3-theme-primary);
      }
    }

    .stat-item-small {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      justify-content: center;

      .stat-icon-small {
        font-size: 16px;
      }

      .stat-value-small {
        font-size: 16px;
        font-weight: 700;
        color: white;
      }

      .stat-label-small {
        font-size: 10px;
        opacity: 0.9;
      }
    }
  }
}

.extended-stats-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;

  .stat-card-small {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 8px;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &.gradient-1 {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    &.gradient-2 {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    &.gradient-3 {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .theme-github & {
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      border: 1px solid var(--b3-border-color);
      box-shadow: none;

      &:hover {
        transform: none;
        border-color: var(--b3-theme-primary);
      }

      &.gradient-1,
      &.gradient-2,
      &.gradient-3 {
        background: var(--b3-theme-surface);
      }
    }

    .card-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .card-content {
      flex: 1;
      min-width: 0;

      .card-value-small {
        font-size: 20px;
        font-weight: 700;
        line-height: 1.2;
        margin-bottom: 2px;
      }

      .card-label-small {
        font-size: 10px;
        opacity: 0.9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}

.view-mode-section {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--b3-theme-surface);
  border-radius: 8px;

  .mode-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;

    .mode-tab {
      flex: 1;
      padding: 8px;
      border: 2px solid var(--b3-border-color);
      border-radius: 6px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: var(--b3-theme-primary);
      }

      &.active {
        border-color: var(--b3-theme-primary);
        background: var(--b3-theme-primary-light);
        color: var(--b3-theme-primary);
      }
    }
  }

  .range-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;

    .range-btn {
      padding: 6px 8px;
      border: 2px solid var(--b3-border-color);
      border-radius: 4px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: var(--b3-theme-primary);
      }

      &.active {
        border-color: var(--b3-theme-primary);
        background: var(--b3-theme-primary-light);
        color: var(--b3-theme-primary);
      }
    }
  }

  .year-selector {
    .year-select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
      font-size: 12px;
      cursor: pointer;
      outline: none;

      &:focus {
        border-color: var(--b3-theme-primary);
      }
    }
  }

  .period-avg-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px 16px;
    margin-top: 12px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: all 0.2s;

    &:hover {
      border-color: var(--b3-theme-primary);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }

    .avg-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--b3-theme-on-surface);
    }

    .avg-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--b3-theme-primary);
    }
  }
}

.chart-section {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--b3-theme-surface);
  border-radius: 8px;

  .section-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
  }

  .bar-chart {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--b3-theme-background);
    border-radius: 6px;
    overflow-x: auto;

    .chart-container {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      min-height: 190px;
      padding-bottom: 30px;
      position: relative;

      .bar-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 32px;
        position: relative;

        .bar-value {
          position: absolute;
          font-size: 10px;
          color: var(--b3-theme-on-surface-light);
          white-space: nowrap;
          transform: translateX(-50%);
          left: 50%;
          font-weight: 500;
        }

        .bar {
          width: 100%;
          min-height: 5px;
          background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
          border-radius: 4px 4px 0 0;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
          cursor: pointer;

          &:hover {
            opacity: 0.8;
          }

          &.today {
            background: linear-gradient(180deg, #f093fb 0%, #f5576c 100%);
            box-shadow: 0 4px 8px rgba(245, 87, 108, 0.4);
            border: 2px solid #f5576c;
          }

          .theme-github & {
            background: #0969da;
            box-shadow: none;

            &:hover {
              opacity: 0.7;
            }

            &.today {
              background: #1a7f37;
              border: 2px solid #1a7f37;
            }
          }
        }

        .bar-label {
          position: absolute;
          bottom: -25px;
          font-size: 10px;
          color: var(--b3-theme-on-surface-light);
          transform: rotate(-45deg);
          transform-origin: top left;
          white-space: nowrap;
          left: 50%;

          &.today {
            color: #f5576c;
            font-weight: 700;
          }
        }
      }
    }
  }

  .data-list {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .data-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: var(--b3-theme-background);
      border-radius: 6px;
      border-left: 3px solid #ddd;
      transition: all 0.2s;

      &.active {
        border-left-color: #667eea;
      }

      &.today {
        border-left-color: #f5576c;
        background: rgba(245, 87, 108, 0.05);
      }

      .theme-github & {
        border-left-color: #d0d7de;

        &.active {
          border-left-color: #0969da;
        }

        &.today {
          border-left-color: #1a7f37;
          background: rgba(26, 127, 55, 0.05);
        }
      }

      .data-date {
        font-size: 12px;
        color: var(--b3-theme-on-surface);
        font-weight: 500;
      }

      .data-value {
        font-size: 13px;
        font-weight: 700;
        color: var(--b3-theme-primary);
      }

      &.today .data-value {
        color: #f5576c;
      }
    }

    .empty-state {
      text-align: center;
      padding: 20px;
      color: var(--b3-theme-on-surface-light);
      font-size: 12px;
    }
  }
}
</style>
