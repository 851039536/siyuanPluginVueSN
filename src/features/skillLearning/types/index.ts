/**
 * 技能学习功能 - 类型定义
 */

/** 编程语言 */
export type Language = "csharp" | "javascript" | "typescript" | "vue" | "other"

/** 难度等级 */
export type Difficulty = "beginner" | "intermediate" | "advanced"

/** 视图模式 */
export type ViewMode = "list" | "flashcard" | "review"

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

/** 国际化文本类型 */
export interface SkillI18n {
  panelTitle?: string
  listView?: string
  flashcardView?: string
  reviewView?: string
  addCard?: string
  editCard?: string
  deleteCard?: string
  importCards?: string
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
  importSuccess?: string
  noCards?: string
  noReviewCards?: string
  reviewComplete?: string
  totalCards?: string
  practicedCards?: string
  presetDataLoaded?: string
  importPreview?: string
  importMarkdown?: string
  importHint?: string
  parseResult?: string
  willImport?: string
  cards?: string
  close?: string
  confirmImport?: string
  noValidCards?: string
  distractors?: string
  distractor1?: string
  distractor2?: string
  distractor3?: string
  [key: string]: string | undefined
}
