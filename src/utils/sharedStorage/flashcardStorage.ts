/**
 * Flashcard 数据模型与存储层（共享模块）
 * 从 flashcardReading 提取，供 flashcardReading 和 floatingToolbar 共用
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"

// ========================================
// 数据模型
// ========================================

/** Flashcard 数据模型 */
export interface Flashcard {
  id: string
  title: string
  content: string
  category: string
  createdAt: number
  updatedAt: number
  practiceCount: number
}

/** 创建卡片数据传输对象 */
export interface CreateFlashcardDTO {
  title: string
  content: string
  category: string
}

/** 更新卡片数据传输对象（所有字段可选） */
export interface UpdateFlashcardDTO {
  title?: string
  content?: string
  category?: string
}

/** 打字练习设置 */
export interface TypingSettings {
  sessionSize: number
  timerEnabled: boolean
}

// ========================================
// Flashcard 存储类
// ========================================

/** 存储键 */
export const STORAGE_KEY = "flashcard-cards"

export class FlashcardStorage {
  private storage: PluginStorage
  private readonly SETTINGS_KEY = "flashcard-typing-settings"

  static readonly DEFAULT_SETTINGS: TypingSettings = {
    sessionSize: 10,
    timerEnabled: true,
  }

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }

  /** 初始化存储（首次使用时创建示例数据） */
  async init(): Promise<void> {
    const cards = await this.getAllCards()
    if (cards.length === 0) {
      await this.createCard({
        title: "示例卡片",
        content: "这是一个示例卡片的内容",
        category: "示例",
      })
    }
  }

  /** 获取所有卡片 */
  async getAllCards(): Promise<Flashcard[]> {
    try {
      const data = await this.storage.load<Flashcard[]>(STORAGE_KEY)
      return (data || []).map((card: Flashcard) => ({
        ...card,
        practiceCount: card.practiceCount ?? 0,
      }))
    } catch (error) {
      console.error("Failed to load cards:", error)
      return []
    }
  }

  /** 获取所有唯一的类别列表 */
  async getCategories(): Promise<string[]> {
    const cards = await this.getAllCards()
    const categories = new Set(cards.map((card) => card.category))
    return Array.from(categories).sort()
  }

  /** 检查标题是否唯一（排除指定ID用于更新时的检查） */
  async isTitleUnique(title: string, excludeId?: string): Promise<boolean> {
    const cards = await this.getAllCards()
    return !cards.some((card) => card.title === title && card.id !== excludeId)
  }

  /** 创建新卡片 */
  async createCard(data: CreateFlashcardDTO): Promise<Flashcard> {
    const isUnique = await this.isTitleUnique(data.title)
    if (!isUnique) {
      throw new Error("Title already exists")
    }

    const now = Date.now()
    const newCard: Flashcard = {
      id: `flashcard-${now}`,
      title: data.title,
      content: data.content,
      category: data.category || "默认",
      createdAt: now,
      updatedAt: now,
      practiceCount: 0,
    }

    const cards = await this.getAllCards()
    cards.push(newCard)
    await this.storage.save(STORAGE_KEY, cards)

    return newCard
  }

  /** 更新现有卡片 */
  async updateCard(id: string, data: UpdateFlashcardDTO): Promise<boolean> {
    const cards = await this.getAllCards()
    const index = cards.findIndex((card) => card.id === id)

    if (index === -1) {
      return false
    }

    if (data.title && data.title !== cards[index].title) {
      const isUnique = await this.isTitleUnique(data.title, id)
      if (!isUnique) {
        throw new Error("Title already exists")
      }
    }

    cards[index] = {
      ...cards[index],
      ...data,
      updatedAt: Date.now(),
    }

    await this.storage.save(STORAGE_KEY, cards)
    return true
  }

  /** 删除卡片 */
  async deleteCard(id: string): Promise<boolean> {
    const cards = await this.getAllCards()
    const filteredCards = cards.filter((card) => card.id !== id)

    if (filteredCards.length === cards.length) {
      return false
    }

    await this.storage.save(STORAGE_KEY, filteredCards)
    return true
  }

  /** 读取打字练习设置 */
  async getTypingSettings(): Promise<TypingSettings> {
    try {
      const data = await this.storage.load<TypingSettings>(this.SETTINGS_KEY)
      return {
        ...FlashcardStorage.DEFAULT_SETTINGS,
        ...data,
      }
    } catch {
      return { ...FlashcardStorage.DEFAULT_SETTINGS }
    }
  }

  /** 保存打字练习设置 */
  async saveTypingSettings(settings: TypingSettings): Promise<boolean> {
    return this.storage.save(this.SETTINGS_KEY, settings)
  }

  /** 增加卡片练习次数 */
  async incrementPracticeCount(id: string): Promise<boolean> {
    const cards = await this.getAllCards()
    const index = cards.findIndex((card) => card.id === id)

    if (index === -1) {
      return false
    }

    cards[index].practiceCount = (cards[index].practiceCount || 0) + 1
    cards[index].updatedAt = Date.now()

    await this.storage.save(STORAGE_KEY, cards)
    return true
  }
}
