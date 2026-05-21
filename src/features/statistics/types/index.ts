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
}
