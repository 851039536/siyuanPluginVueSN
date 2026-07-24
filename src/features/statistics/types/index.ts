/**
 * 统计模块类型导出
 */
export * from "./storage"
export * from "./rows"

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
  time?: string
}

/**
 * 被删除的文档（来源：思源数据历史，无法再打开）
 */
export interface DeletedDoc {
  title: string
  time?: string
}

/** 热力图指标类型 */
export type HeatmapMetric = 'docsModified' | 'docsCreated' | 'blockEdits'

/**
 * 最近更新的文档
 */
export interface RecentUpdatedDoc {
  id: string
  title: string
  updated: string
  created: string
  notebookName: string
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
  notebookCount: number
  codeBlocks: number
  writingStreak: number
  activeDays: number
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
 * 笔记本块类型分布
 */
export interface NotebookBlockTypeStat {
  notebook: string
  blockTypes: Array<{ name: string, count: number, label: string }>
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

/**
 * 对比分析数据
 */
export interface ComparisonData {
  periodALabel: string
  periodBLabel: string
  a: ReportData
  b: ReportData
  deltas: {
    totalWords: number
    totalNotesCreated: number
    avgDailyWords: number
    activeDays: number
    longestStreak: number
  }
}
