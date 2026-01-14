/**
 * 单词阅读功能 - 数据存储层
 */
import { Plugin } from 'siyuan'
import type { Flashcard, CreateFlashcardDTO, UpdateFlashcardDTO } from './types'

/**
 * Flashcard 存储类
 */
export class FlashcardStorage {
  private plugin: Plugin
  private readonly STORAGE_KEY = 'flashcard-cards'

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  /**
   * 初始化存储（首次使用时创建示例数据）
   */
  async init(): Promise<void> {
    const cards = await this.getAllCards()
    if (cards.length === 0) {
      // 可选：为首次使用的用户创建示例卡片
      await this.createCard({
        title: '示例卡片',
        content: '这是一个示例卡片的内容',
        category: '示例'
      })
    }
  }

  /**
   * 获取所有卡片
   */
  async getAllCards(): Promise<Flashcard[]> {
    try {
      const data = await this.plugin.loadData(this.STORAGE_KEY)
      return data || []
    } catch (error) {
      console.error('Failed to load cards:', error)
      return []
    }
  }

  /**
   * 按类别获取卡片
   */
  async getCardsByCategory(category: string): Promise<Flashcard[]> {
    const allCards = await this.getAllCards()
    if (category === 'all') {
      return allCards
    }
    return allCards.filter(card => card.category === category)
  }

  /**
   * 获取所有唯一的类别列表
   */
  async getCategories(): Promise<string[]> {
    const cards = await this.getAllCards()
    const categories = new Set(cards.map(card => card.category))
    return Array.from(categories).sort()
  }

  /**
   * 按ID获取卡片
   */
  async getCardById(id: string): Promise<Flashcard | null> {
    const cards = await this.getAllCards()
    return cards.find(card => card.id === id) || null
  }

  /**
   * 检查标题是否唯一（排除指定ID用于更新时的检查）
   */
  async isTitleUnique(title: string, excludeId?: string): Promise<boolean> {
    const cards = await this.getAllCards()
    return !cards.some(card =>
      card.title === title && card.id !== excludeId
    )
  }

  /**
   * 创建新卡片
   */
  async createCard(data: CreateFlashcardDTO): Promise<Flashcard> {
    // 检查标题唯一性
    const isUnique = await this.isTitleUnique(data.title)
    if (!isUnique) {
      throw new Error('Title already exists')
    }

    const now = Date.now()
    const newCard: Flashcard = {
      id: `flashcard-${now}`,
      title: data.title,
      content: data.content,
      category: data.category || '默认',
      createdAt: now,
      updatedAt: now
    }

    const cards = await this.getAllCards()
    cards.push(newCard)
    await this.plugin.saveData(this.STORAGE_KEY, cards)

    return newCard
  }

  /**
   * 更新现有卡片
   */
  async updateCard(id: string, data: UpdateFlashcardDTO): Promise<boolean> {
    const cards = await this.getAllCards()
    const index = cards.findIndex(card => card.id === id)

    if (index === -1) {
      return false
    }

    // 如果更新标题，检查唯一性
    if (data.title && data.title !== cards[index].title) {
      const isUnique = await this.isTitleUnique(data.title, id)
      if (!isUnique) {
        throw new Error('Title already exists')
      }
    }

    // 更新字段
    cards[index] = {
      ...cards[index],
      ...data,
      updatedAt: Date.now()
    }

    await this.plugin.saveData(this.STORAGE_KEY, cards)
    return true
  }

  /**
   * 删除卡片
   */
  async deleteCard(id: string): Promise<boolean> {
    const cards = await this.getAllCards()
    const filteredCards = cards.filter(card => card.id !== id)

    if (filteredCards.length === cards.length) {
      return false // 卡片未找到
    }

    await this.plugin.saveData(this.STORAGE_KEY, filteredCards)
    return true
  }

  /**
   * 批量删除卡片
   */
  async deleteCards(ids: string[]): Promise<number> {
    const cards = await this.getAllCards()
    const idSet = new Set(ids)
    const filteredCards = cards.filter(card => !idSet.has(card.id))
    const deletedCount = cards.length - filteredCards.length

    if (deletedCount > 0) {
      await this.plugin.saveData(this.STORAGE_KEY, filteredCards)
    }

    return deletedCount
  }
}
