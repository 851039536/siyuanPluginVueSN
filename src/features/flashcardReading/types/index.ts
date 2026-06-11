/**
 * 单词阅读功能 - 类型定义
 */

/**
 * Flashcard 数据模型
 */
export interface Flashcard {
  id: string
  title: string
  content: string
  category: string
  createdAt: number
  updatedAt: number
  practiceCount: number
}

/**
 * 创建卡片数据传输对象
 */
export interface CreateFlashcardDTO {
  title: string
  content: string
  category: string
}

/**
 * 更新卡片数据传输对象（所有字段可选）
 */
export interface UpdateFlashcardDTO {
  title?: string
  content?: string
  category?: string
}

/**
 * 打字练习设置
 */
export interface TypingSettings {
  sessionSize: number
  timerEnabled: boolean
}

/**
 * 视图模式类型
 */
export type ViewMode = "list" | "single" | "statistics" | "typing"

/**
 * 统计数据类型
 */
export interface StatisticsData {
  totalPractice: number
  practicedCards: number
  totalCards: number
  categoryStats: Array<{ category: string, count: number }>
  cardStats: Array<{ title: string, category: string, count: number }>
}

/**
 * 表单错误类型
 */
export type FormErrors = Record<string, string>

/**
 * 国际化文本类型
 */
export interface I18n {
  panelTitle?: string
  category?: string
  allCategories?: string
  searchPlaceholder?: string
  total?: string
  filtered?: string
  listView?: string
  singleView?: string
  statisticsView?: string
  play?: string
  copyTitle?: string
  copyContent?: string
  editCard?: string
  deleteCard?: string
  addCard?: string
  refresh?: string
  previous?: string
  next?: string
  randomCard?: string
  practiceCount?: string
  noCards?: string
  noPracticeData?: string
  startPracticeHint?: string
  title?: string
  content?: string
  selectCategory?: string
  customCategory?: string
  customCategoryPlaceholder?: string
  cancel?: string
  save?: string
  close?: string
  titlePlaceholder?: string
  contentPlaceholder?: string
  titleEmpty?: string
  titleDuplicate?: string
  loadFailed?: string
  updateSuccess?: string
  createSuccess?: string
  saveFailed?: string
  deleteSuccess?: string
  deleteFailed?: string
  confirmDelete?: string
  playFailed?: string
  categoryStats?: string
  topCards?: string
  totalPractice?: string
  practicedCards?: string
  totalCards?: string
  masteryProgress?: string
  typingView?: string
  typeTheWord?: string
  clickToStartTyping?: string
  correct?: string
  skipCard?: string
  caseInsensitive?: string
  caseSensitive?: string
  instantReset?: string
  delayedReset?: string
  coverMode?: string
  revealMode?: string
  sessionCorrect?: string
  timerLabel?: string
  sessionSizeLabel?: string
  roundComplete?: string
}

