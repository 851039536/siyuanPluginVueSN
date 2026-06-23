/**
 * 技能学习功能 - 类型定义
 */

/** 编程语言 */
export type Language = "csharp" | "javascript" | "typescript" | "vue" | "other"

/** 难度等级 */
export type Difficulty = "beginner" | "intermediate" | "advanced"

/** 视图模式 */
export type ViewMode = "list" | "flashcard" | "review" | "stats"

/** 代码片段练习卡片 */
export interface SkillCard {
  id: string
  title: string
  answer: string
  distractors: string[]
  codeSnippet: string
  language: Language
  category: string
  difficulty: Difficulty
  tags: string[]
  practiceCount: number
  reviewData?: ReviewData
  createdAt: number
  updatedAt: number
}

/** 创建卡片 DTO */
export interface CreateSkillDTO {
  title: string
  answer: string
  distractors?: string[]
  codeSnippet?: string
  language?: Language
  category?: string
  difficulty?: Difficulty
  tags?: string[]
}

/** 更新卡片 DTO */
export interface UpdateSkillDTO {
  title?: string
  answer?: string
  distractors?: string[]
  codeSnippet?: string
  language?: Language
  category?: string
  difficulty?: Difficulty
  tags?: string[]
}

/** 复习评分 */
export type ReviewRating = "remembered" | "fuzzy" | "forgot"

/** SM-2 间隔重复数据 */
export interface ReviewData {
  ef: number
  interval: number
  repetitions: number
  nextReview: number
}

/** 国际化文本类型 */
export interface SkillI18n {
  panelTitle?: string
  listView?: string
  flashcardView?: string
  reviewView?: string
  addCard?: string
  editCard?: string
  deleteCard?: string
  searchPlaceholder?: string
  allLanguages?: string
  allCategories?: string
  allDifficulties?: string
  category?: string
  language?: string
  difficulty?: string
  title_?: string
  answer?: string
  codeSnippet?: string
  tags?: string
  practiceCount?: string
  beginner?: string
  intermediate?: string
  advanced?: string
  remembered?: string
  fuzzy?: string
  forgot?: string
  prevCard?: string
  nextCard?: string
  randomCard?: string
  flipCard?: string
  progress?: string
  save?: string
  cancel?: string
  confirmDelete?: string
  deleteSuccess?: string
  saveSuccess?: string
  createSuccess?: string
  updateSuccess?: string
  noCards?: string
  noReviewCards?: string
  reviewComplete?: string
  totalCards?: string
  practicedCards?: string
  presetDataLoaded?: string
  distractors?: string
  distractor1?: string
  distractor2?: string
  distractor3?: string
  practiceTimes?: string
  emptyOption?: string
  aiGenerateFailed?: string
  nextReviewHint?: string
  tapToReveal?: string
  forgotHint?: string
  statsView?: string
  dueForReview?: string
  practiceProgress?: string
  [key: string]: string | undefined
}
