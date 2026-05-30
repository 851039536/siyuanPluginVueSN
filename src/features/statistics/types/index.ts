/**
 * 统计模块类型导出
 */
export * from "./storage"

/**
 * 每日字数统计
 */
export interface DailyWordCount {
  date: string
  words: number
  dateLabel: string
}

/**
 * 变更文档详情
 */
export interface ChangedDoc {
  id: string
  title: string
  updated?: string
}

/**
 * 范围统计项（柱状图数据）
 */
export interface RangeStatItem {
  date: string
  newCount: number
  modifiedCount: number
}

/**
 * 块类型分布统计
 */
export interface BlockTypeStat {
  name: string
  count: number
  label: string
}

/**
 * 统计数据接口
 */
export interface StatisticsData {
  totalNotes: number
  totalWords: number
  totalBlocks: number
  totalAssets: number
  totalImages: number
  totalTags: number
  totalBacklinks: number
  todayCreated: number
  todayModified: number
  avgWordsPerDoc: number
  dailyStats: DailyWordCount[]
  currentPeriod: string
  periodTotalWords: number
  blockTypeStats: BlockTypeStat[]
}

/**
 * 笔记本字数统计（饼图用）
 */
export interface NotebookWordStat {
  name: string
  words: number
  percentage: number
  color: string
}

/**
 * 笔记本每日活跃度数据
 */
export interface NotebookActivityItem {
  notebook: string
  data: DailyWordCount[]
  color: string
}

/**
 * 报告数据
 */
export interface ReportData {
  periodLabel: string
  totalWords: number
  totalNotesCreated: number
  avgDailyWords: number
  activeDays: number
  maxWordsDay: { date: string, words: number }
  mostProductiveNotebook: { name: string, words: number }
  longestStreak: number
  monthlyBreakdown: Array<{ month: string, words: number, created: number }>
}

/**
 * 趋势预测数据
 */
export interface TrendPrediction {
  historical: DailyWordCount[]
  predicted: DailyWordCount[]
  slope: number
  intercept: number
  rSquared: number
  weeklyProjection: number
  monthlyProjection: number
}
