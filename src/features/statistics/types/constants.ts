import type { StatisticsData } from "./index"

export const NOTEBOOK_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#f97316",
  "#84cc16",
  "#14b8a6",
  "#6366f1",
  "#e11d48",
  "#0ea5e9",
  "#a855f7",
  "#10b981",
]

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  d: "文档",
  p: "段落",
  h: "标题",
  l: "列表项",
  i: "列表项",
  c: "代码块",
  t: "表格",
  b: "引用块",
  html: "HTML块",
  query_embed: "嵌入查询",
  img: "图片",
  audio: "音频",
  video: "视频",
  widget: "挂件",
  iframe: "框架",
  super: "超级块",
  tag: "标签",
}

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]

export const ZERO_STATISTICS: StatisticsData = {
  totalNotes: 0,
  totalWords: 0,
  totalBlocks: 0,
  totalAssets: 0,
  totalTags: 0,
  totalBacklinks: 0,
  todayCreated: 0,
  todayModified: 0,
  avgWordsPerDoc: 0,
  dailyStats: [],
  currentPeriod: "",
  periodTotalWords: 0,
  totalImages: 0,
  blockTypeStats: [],
  notebookCount: 0,
  codeBlocks: 0,
  writingStreak: 0,
  activeDays: 0,
}
