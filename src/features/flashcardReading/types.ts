/**
 * 单词阅读功能 - 类型定义
 */

/**
 * Flashcard 数据模型
 */
export interface Flashcard {
  id: string           // 唯一标识 (timestamp-based)
  title: string        // 标题（唯一约束）
  content: string      // 内容（背面）
  category: string     // 类别
  createdAt: number    // 创建时间戳
  updatedAt: number    // 更新时间戳
  practiceCount: number // 练习次数
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
 * 类别筛选类型
 */
export type CategoryFilter = string | 'all'

/**
 * 卡片列表结果（带分页）
 */
export interface FlashcardListResult {
  cards: Flashcard[]
  total: number
  categories: string[]
}
