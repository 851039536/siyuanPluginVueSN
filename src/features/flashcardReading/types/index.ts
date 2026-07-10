/**
 * 单词阅读功能 - 类型定义
 */

// 共享类型从公共模块重导出
export type {
  Flashcard,
  CreateFlashcardDTO,
  UpdateFlashcardDTO,
  TypingSettings,
} from "@/utils/sharedStorage/flashcardStorage"

/**
 * 视图模式类型
 */
export type ViewMode = "list" | "statistics" | "typing"

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
  /** 打字练习标题提示 */
  typingTitleCaseInsensitive?: string
  typingTitleCaseSensitive?: string
  typingTitleInstantReset?: string
  typingTitleDelayedReset?: string
  typingTitleCoverMode?: string
  typingTitleRevealMode?: string
  typingTitleTimerOn?: string
  typingTitleTimerOff?: string
  typingTimerOn?: string
  typingTimerOff?: string
  typingCardUnit?: string
  retryTyping?: string
  summaryCorrect?: string
  startNextRound?: string
}

