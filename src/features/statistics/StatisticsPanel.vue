<template>
  <div class="statistics-panel" :class="`theme-${currentTheme}`">
    <!-- 顶部操作栏 -->
    <div class="statistics-header">
      <div class="header-left">
        <Button size="small" class="refresh-btn" icon="pi pi-refresh" title="刷新" @click="refreshData" :disabled="loading" :loading="loading" severity="secondary" text rounded />
        <Button class="theme-toggle-btn" @click="toggleTheme" title="切换主题" severity="secondary" text>
          <span class="theme-icon">{{ currentTheme === 'default' ? '🌈' : '🐙' }}</span>
          <span class="theme-text">{{ currentTheme === 'default' ? '默认' : 'GitHub' }}</span>
        </Button>
      </div>
      <div class="header-right">
        <div class="auto-update-info">
          <span class="update-icon">⏱️</span>
          <span class="update-text">{{ updateIntervalText }}</span>
        </div>
        <div class="last-update">最后更新: {{ lastUpdateTime }}</div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading && !stats" class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
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
              <div class="stat-label">笔记总数</div>
            </div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item-inline">
            <span class="stat-icon">✍️</span>
            <div class="stat-content">
              <div class="stat-value">{{ formatNumber(stats.totalWords) }}</div>
              <div class="stat-label">总字数</div>
            </div>
          </div>
        </div>

        <!-- 次要统计：内容和关系 -->
        <div class="stat-card-secondary">
          <div class="stat-item-small">
            <span class="stat-icon-small">🧩</span>
            <span class="stat-value-small">{{ formatShortNumber(stats.totalBlocks) }}</span>
            <span class="stat-label-small">内容块</span>
          </div>
          <div class="stat-item-small">
            <span class="stat-icon-small">📎</span>
            <span class="stat-value-small">{{ formatShortNumber(stats.totalAssets) }}</span>
            <span class="stat-label-small">附件</span>
          </div>
          <div class="stat-item-small">
            <span class="stat-icon-small">🏷️</span>
            <span class="stat-value-small">{{ formatShortNumber(stats.totalTags) }}</span>
            <span class="stat-label-small">标签</span>
          </div>
          <div class="stat-item-small">
            <span class="stat-icon-small">🔗</span>
            <span class="stat-value-small">{{ formatShortNumber(stats.totalBacklinks) }}</span>
            <span class="stat-label-small">双链</span>
          </div>
        </div>
      </div>

      <!-- 新增统计卡片 - 卡片形式 -->
      <div class="extended-stats-cards">
        <div class="stat-card-small gradient-1">
          <div class="card-icon">📅</div>
          <div class="card-content">
            <div class="card-value-small">{{ stats.todayCreated }}</div>
            <div class="card-label-small">今日新增</div>
          </div>
        </div>
        <div class="stat-card-small gradient-2">
          <div class="card-icon">✏️</div>
          <div class="card-content">
            <div class="card-value-small">{{ stats.todayModified }}</div>
            <div class="card-label-small">今日修改</div>
          </div>
        </div>
        <div class="stat-card-small gradient-3">
          <div class="card-icon">📊</div>
          <div class="card-content">
            <div class="card-value-small">{{ stats.avgWordsPerDoc }}</div>
            <div class="card-label-small">平均字数</div>
          </div>
        </div>
      </div>

      <!-- 查看模式切换 -->
      <div class="view-mode-section">
        <div class="mode-tabs">
          <Button
            v-for="mode in viewModes"
            :key="mode.value"
            class="mode-tab"
            :class="{ active: viewMode === mode.value }"
            @click="viewMode = mode.value"
            :severity="viewMode === mode.value ? 'primary' : 'secondary'"
            :text="viewMode !== mode.value"
            :outlined="viewMode !== mode.value"
            rounded
          >
            {{ mode.icon }} {{ mode.label }}
          </Button>
        </div>

        <!-- 时段统计：平均字数和总字数 -->
        <div v-if="periodAvgWords > 0 || (stats && stats.periodTotalWords > 0)" class="period-stats-cards">
          <div v-if="periodAvgWords > 0" class="period-stat-card">
            <span class="stat-label">{{ getPeriodAvgLabel() }}</span>
            <span class="stat-value">{{ formatNumber(periodAvgWords) }} 字</span>
          </div>
          <div v-if="stats && stats.periodTotalWords > 0" class="period-stat-card">
            <span class="stat-label">{{ getPeriodTotalLabel() }}</span>
            <span class="stat-value">{{ formatNumber(stats.periodTotalWords) }} 字</span>
          </div>
        </div>

        <!-- 日视图范围选择 -->
        <div v-if="viewMode === 'day'" class="range-selector">
          <Button
            v-for="range in dayRanges"
            :key="range.value"
            class="range-btn"
            :class="{ active: dayRange === range.value }"
            @click="dayRange = range.value; refreshData()"
            :severity="dayRange === range.value ? 'primary' : 'secondary'"
            :text="dayRange !== range.value"
            :outlined="dayRange !== range.value"
            rounded
            size="small"
          >
            {{ range.label }}
          </Button>
        </div>

        <!-- 月视图范围选择 -->
        <div v-if="viewMode === 'month'" class="range-selector">
          <Button
            v-for="range in monthRanges"
            :key="range.value"
            class="range-btn"
            :class="{ active: monthYearRange === range.value }"
            @click="monthYearRange = range.value; refreshData()"
            :severity="monthYearRange === range.value ? 'primary' : 'secondary'"
            :text="monthYearRange !== range.value"
            :outlined="monthYearRange !== range.value"
            rounded
            size="small"
          >
            {{ range.label }}
          </Button>
        </div>

        <!-- 年视图选择 -->
        <div v-if="viewMode === 'year'" class="year-selector">
          <select v-model="selectedYear" @change="refreshData" class="year-select">
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
                :title="`${item.dateLabel}: ${formatNumber(item.words)} 字`"
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
          <!-- <div v-if="chartData.length === 0" class="empty-state">
            {{ i18n.noData }}
          </div> -->
        </div>

        <!-- 趋势视图 -->
        <div v-if="viewMode === 'trend'" class="trend-view">
          <h3 class="section-title">趋势分析</h3>

          <!-- 趋势统计列表 -->
          <div v-if="trendStats" class="trend-stats-list">
            <div class="trend-stat-item">
              <span class="stat-icon">📈</span>
              <span class="stat-label">笔记增长</span>
              <span class="stat-value">{{ formatNumber(trendStats.notesGrowth) }}</span>
            </div>
            <div class="trend-stat-item">
              <span class="stat-icon">✍️</span>
              <span class="stat-label">字数增长</span>
              <span class="stat-value">{{ formatNumber(trendStats.wordsGrowth) }}</span>
            </div>
            <div class="trend-stat-item">
              <span class="stat-icon">📅</span>
              <span class="stat-label">日均新增</span>
              <span class="stat-value">{{ trendStats.avgDailyCreated }}</span>
            </div>
            <div class="trend-stat-item">
              <span class="stat-icon">✏️</span>
              <span class="stat-label">日均修改</span>
              <span class="stat-value">{{ trendStats.avgDailyModified }}</span>
            </div>
          </div>

          <!-- 历史数据列表 -->
          <div class="historical-data-list">
            <h4 class="subsection-title">历史数据</h4>
            <div class="historical-table-container">
              <table class="historical-table">
                <thead>
                  <tr>
                    <th class="col-date">日期</th>
                    <th class="col-notes">
                      <span class="th-icon">📓</span>
                      笔记
                    </th>
                    <th class="col-words">
                      <span class="th-icon">✍️</span>
                      字数
                    </th>
                    <th class="col-created">
                      <span class="th-icon">📅</span>
                      新增
                    </th>
                    <th class="col-modified">
                      <span class="th-icon">✏️</span>
                      修改
                    </th>
                    <th class="col-change">变化</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, index) in historicalData"
                    :key="item.date"
                    class="historical-row"
                    :class="{ today: isToday(item.date) }"
                  >
                    <td class="col-date">{{ item.dateLabel }}</td>
                    <td class="col-notes">{{ formatNumber(item.totalNotes) }}</td>
                    <td class="col-words">{{ formatNumber(item.totalWords) }}</td>
                    <td class="col-created">{{ item.todayCreated }}</td>
                    <td class="col-modified">{{ item.todayModified }}</td>
                    <td class="col-change">
                      <template v-if="index < historicalData.length - 1">
                        <Tag
                          v-if="getWordDiff(item, historicalData[index + 1]) !== 0"
                          size="small"
                          :value="(getWordDiff(item, historicalData[index + 1]) > 0 ? '+' : '') + formatShortNumber(getWordDiff(item, historicalData[index + 1])) + ' 字'"
                          :severity="getWordDiff(item, historicalData[index + 1]) > 0 ? 'success' : 'danger'"
                        />
                        <Tag
                          v-if="getNoteDiff(item, historicalData[index + 1]) !== 0"
                          size="small"
                          :value="(getNoteDiff(item, historicalData[index + 1]) > 0 ? '+' : '') + getNoteDiff(item, historicalData[index + 1]) + ' 笔记'"
                          :severity="getNoteDiff(item, historicalData[index + 1]) > 0 ? 'success' : 'danger'"
                        />
                      </template>
                      <Tag v-else value="-" severity="secondary" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- 快照视图 -->
        <div v-if="viewMode === 'snapshot'" class="snapshot-view">
          <h3 class="section-title">
            快照分析
            <Button @click="clearSnapshots" class="clear-btn" title="清除快照" icon="pi pi-trash" severity="danger" text rounded />
          </h3>

          <div v-if="snapshotData.length > 0" class="snapshot-stats">
            <p class="snapshot-info">
              📸 已保存 {{ snapshotData.length }} 个快照
            </p>
          </div>

          <!-- 快照数据列表 -->
          <div class="snapshot-data-list">
            <div
              v-for="(snapshot, index) in snapshotData"
              :key="snapshot.timestamp"
              class="snapshot-item"
            >
              <div class="snapshot-header">
                <div class="snapshot-time">
                  <span class="time-icon">⏰</span>
                  <span class="time-text">{{ snapshot.datetime }}</span>
                  <Tag v-if="index === 0" value="最新" severity="success" />
                </div>
              </div>
              <div class="snapshot-stats-grid">
                <div class="snapshot-stat">
                  <span class="stat-icon">📓</span>
                  <span class="stat-value">{{ formatNumber(snapshot.totalNotes) }}</span>
                  <span class="stat-label">笔记</span>
                </div>
                <div class="snapshot-stat">
                  <span class="stat-icon">✍️</span>
                  <span class="stat-value">{{ formatNumber(snapshot.totalWords) }}</span>
                  <span class="stat-label">字数</span>
                </div>
                <div class="snapshot-stat">
                  <span class="stat-icon">🧩</span>
                  <span class="stat-value">{{ formatShortNumber(snapshot.totalBlocks) }}</span>
                  <span class="stat-label">块</span>
                </div>
                <div class="snapshot-stat">
                  <span class="stat-icon">📎</span>
                  <span class="stat-value">{{ formatShortNumber(snapshot.totalAssets) }}</span>
                  <span class="stat-label">附件</span>
                </div>
                <div class="snapshot-stat">
                  <span class="stat-icon">📅</span>
                  <span class="stat-value">{{ snapshot.todayCreated }}</span>
                  <span class="stat-label">新增</span>
                </div>
                <div class="snapshot-stat">
                  <span class="stat-icon">✏️</span>
                  <span class="stat-value">{{ snapshot.todayModified }}</span>
                  <span class="stat-label">修改</span>
                </div>
              </div>
              <!-- 显示与上一个快照的差异 -->
              <div v-if="index < snapshotData.length - 1" class="snapshot-diff">
                <span class="diff-label">变化：</span>
                <Tag size="small"
                  :value="getSnapshotWordDiff(snapshot, snapshotData[index + 1]) > 0 ? '+' : '' + formatNumber(getSnapshotWordDiff(snapshot, snapshotData[index + 1])) + ' 字'"
                  :severity="getSnapshotWordDiff(snapshot, snapshotData[index + 1]) > 0 ? 'success' : getSnapshotWordDiff(snapshot, snapshotData[index + 1]) < 0 ? 'danger' : 'secondary'"
                />
                <Tag size="small"
                  :value="getSnapshotNoteDiff(snapshot, snapshotData[index + 1]) > 0 ? '+' : '' + getSnapshotNoteDiff(snapshot, snapshotData[index + 1]) + ' 笔记'"
                  :severity="getSnapshotNoteDiff(snapshot, snapshotData[index + 1]) > 0 ? 'success' : getSnapshotNoteDiff(snapshot, snapshotData[index + 1]) < 0 ? 'danger' : 'secondary'"
                />
              </div>
            </div>
            <div v-if="snapshotData.length === 0" class="empty-snapshot">
              📸 还没有快照数据，等待系统自动收集...
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

interface Props {
  theme?: 'default' | 'github'
  onThemeChange?: (theme: 'default' | 'github') => void
  onRefresh?: (params: {
    viewMode: 'day' | 'week' | 'month' | 'year' | 'trend' | 'snapshot'
    dayRange?: 7 | 15 | 30 | 90 | 180 | 365
    monthYearRange?: 1 | 2 | 3
    selectedYear?: number
  }) => Promise<StatisticsData>
  onGetHistoricalData?: (days?: number) => Promise<any[]>
  onGetSnapshots?: (count?: number) => Promise<any[]>
  onClearSnapshots?: () => Promise<void>
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
  periodTotalWords: number
  topTags: Array<{ name: string; count: number }>
  recentDocs: Array<{ id: string; title: string; updated: string; words: number }>
}

interface DailyWordCount {
  date: string
  words: number
  dateLabel: string
}

const props = withDefaults(defineProps<Props>(), {
  theme: 'default',
})

// 状态
const loading = ref(false)
const stats = ref<StatisticsData | null>(null)
const lastUpdateTime = ref('')
const viewMode = ref<'day' | 'week' | 'month' | 'year' | 'trend' | 'snapshot'>('day')
const dayRange = ref<7 | 15 | 30 | 90 | 180 | 365>(7)
const monthYearRange = ref<1 | 2 | 3>(1)
const selectedYear = ref<number>(new Date().getFullYear())
const chartData = ref<DailyWordCount[]>([])
const currentTheme = ref<'default' | 'github'>(props.theme || 'default')
const historicalData = ref<any[]>([])
const snapshotData = ref<any[]>([])

// 视图模式选项
const viewModes = computed(() => [
  { value: 'day' as const, label: '日', icon: '📅' },
  { value: 'week' as const, label: '周', icon: '📊' },
  { value: 'month' as const, label: '月', icon: '📆' },
  { value: 'year' as const, label: '年', icon: '📈' },
  { value: 'trend' as const, label: '趋势', icon: '📈' },
  { value: 'snapshot' as const, label: '快照', icon: '📸' },
])

// 日视图范围选项
const dayRanges = computed(() => [
  { value: 7 as const, label: '7天' },
  { value: 15 as const, label: '15天' },
  { value: 30 as const, label: '30天' },
  { value: 90 as const, label: '季度' },
  { value: 180 as const, label: '半年' },
  { value: 365 as const, label: '整年' },
])

// 月视图范围选项
const monthRanges = computed(() => [
  { value: 1 as const, label: '最近一年' },
  { value: 2 as const, label: '最近两年' },
  { value: 3 as const, label: '最近三年' },
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

// 更新间隔显示文本
const updateIntervalText = computed(() => {
  const seconds = 60
  if (seconds < 60) {
    return `${seconds}秒`
  } else {
    const minutes = seconds / 60
    return `${minutes}分钟`
  }
})

// 趋势数据统计
const trendStats = computed(() => {
  if (historicalData.value.length === 0) return null

  const totalNotes = historicalData.value[historicalData.value.length - 1]?.totalNotes || 0
  const firstNotes = historicalData.value[0]?.totalNotes || 0
  const notesGrowth = totalNotes - firstNotes

  const totalWords = historicalData.value[historicalData.value.length - 1]?.totalWords || 0
  const firstWords = historicalData.value[0]?.totalWords || 0
  const wordsGrowth = totalWords - firstWords

  const totalCreated = historicalData.value.reduce((sum, item) => sum + item.todayCreated, 0)
  const totalModified = historicalData.value.reduce((sum, item) => sum + item.todayModified, 0)

  return {
    notesGrowth,
    wordsGrowth,
    totalCreated,
    totalModified,
    avgDailyCreated: Math.round(totalCreated / historicalData.value.length),
    avgDailyModified: Math.round(totalModified / historicalData.value.length)
  }
})

// 获取时段平均标签
function getPeriodAvgLabel(): string {
  const labels: Record<string, string> = {
    'day': '日均字数',
    'week': '周均字数',
    'month': '月均字数',
    'year': '年均字数',
  }
  return labels[viewMode.value] || '平均字数'
}

// 获取时段总字数标签
function getPeriodTotalLabel(): string {
  const labels: Record<string, string> = {
    'day': '总字数',
    'week': '总字数',
    'month': '总字数',
    'year': '总字数',
  }
  return labels[viewMode.value] || '总字数'
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

    // 如果是趋势视图，获取历史数据
    if (viewMode.value === 'trend') {
      await loadHistoricalData()
    }

    // 如果是快照视图，加载快照数据
    if (viewMode.value === 'snapshot') {
      await loadSnapshotData()
    }
  } catch (error) {
    console.error('刷新统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载历史数据
async function loadHistoricalData() {
  if (!props.onGetHistoricalData) return

  try {
    const data = await props.onGetHistoricalData() // 获取所有历史数据（永久展示）
    // 最新日期在最前面排序
    historicalData.value = data.reverse()
  } catch (error) {
    console.error('加载历史数据失败:', error)
  }
}

// 加载快照数据
async function loadSnapshotData() {
  if (!props.onGetSnapshots) return

  try {
    snapshotData.value = await props.onGetSnapshots(50) // 获取最近50个快照
    console.log('已加载快照数据:', snapshotData.value.length)
  } catch (error) {
    console.error('加载快照数据失败:', error)
  }
}

// 清除快照数据
async function clearSnapshots() {
  if (!props.onClearSnapshots) return

  if (!confirm('确认清除所有快照数据吗？')) {
    return
  }

  try {
    await props.onClearSnapshots()
    snapshotData.value = []
    console.log('快照数据已清除')
  } catch (error) {
    console.error('清除快照数据失败:', error)
  }
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

// 计算字数差异（智能处理缺失数据）
function getWordDiff(current: any, previous: any): number {
  if (!current || !previous) return 0

  // 如果前一天没有新增/修改数据（都是0），说明那天可能没有记录统计
  // 这种情况下不显示差异，因为不知道实际变化
  if (previous.todayCreated === 0 && previous.todayModified === 0 && current.totalWords > 0) {
    // 但如果当前的总字数确实增加了，使用实际差值
    const diff = current.totalWords - previous.totalWords
    return diff > 0 ? diff : 0
  }

  // 如果前一天没有数据，不显示差异（避免负增长）
  if (previous.totalWords === 0 && current.totalWords > 0) {
    return 0
  }

  return current.totalWords - previous.totalWords
}

// 计算笔记数差异（智能处理缺失数据）
function getNoteDiff(current: any, previous: any): number {
  if (!current || !previous) return 0

  // 如果前一天没有新增/修改数据（都是0），说明那天可能没有记录统计
  // 这种情况下不显示差异，因为不知道实际变化
  if (previous.todayCreated === 0 && previous.todayModified === 0 && current.totalNotes > 0) {
    // 但如果当前的笔记数确实增加了，使用实际差值
    const diff = current.totalNotes - previous.totalNotes
    return diff > 0 ? diff : 0
  }

  // 如果前一天没有数据，不显示差异（避免负增长）
  if (previous.totalNotes === 0 && current.totalNotes > 0) {
    return 0
  }

  return current.totalNotes - previous.totalNotes
}

// 计算快照字数差异
function getSnapshotWordDiff(current: any, previous: any): number {
  if (!current || !previous) return 0
  return current.totalWords - previous.totalWords
}

// 计算快照笔记数差异
function getSnapshotNoteDiff(current: any, previous: any): number {
  if (!current || !previous) return 0
  return current.totalNotes - previous.totalNotes
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
@use "./index.scss"
</style>
