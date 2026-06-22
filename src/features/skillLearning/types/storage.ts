/**
 * 技能学习功能 - 数据存储层
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import type { SkillCard, CreateSkillDTO, UpdateSkillDTO } from "./index"

export const STORAGE_KEY = "skill-learning-cards"
const PRESET_FLAG_KEY = "skill-learning-preset-loaded"

export class SkillStorage {
  private storage: PluginStorage

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }

  /** 检查预设数据是否已加载 */
  async isPresetLoaded(): Promise<boolean> {
    const val = await this.storage.load<boolean>(PRESET_FLAG_KEY)
    return val === true
  }

  /** 标记预设数据已加载 */
  async markPresetLoaded(): Promise<void> {
    await this.storage.save(PRESET_FLAG_KEY, true)
  }

  /** 批量导入（用于初始预设数据和 Markdown 导入） */
  async bulkCreate(cards: CreateSkillDTO[]): Promise<SkillCard[]> {
    const existing = await this.getAllCards()
    const now = Date.now()
    const newCards: SkillCard[] = cards.map((dto, i) => ({
      id: `skill-${now}-${i}`,
      title: dto.title,
      answer: dto.answer,
      distractors: dto.distractors || [],
      codeSnippet: dto.codeSnippet || "",
      language: dto.language || "other",
      category: dto.category || "默认",
      difficulty: dto.difficulty || "beginner",
      tags: dto.tags || [],
      practiceCount: 0,
      createdAt: now + i,
      updatedAt: now + i,
    }))
    await this.storage.save(STORAGE_KEY, [...existing, ...newCards])
    return newCards
  }

  /** 获取所有卡片 */
  async getAllCards(): Promise<SkillCard[]> {
    const data = await this.storage.load<SkillCard[]>(STORAGE_KEY)
    return (data || []).map((card) => ({
      ...card,
      distractors: card.distractors || [],
      practiceCount: card.practiceCount ?? 0,
      language: card.language || "other",
      difficulty: card.difficulty || "beginner",
      tags: card.tags || [],
    }))
  }

  /** 获取唯一语言列表 */
  async getLanguages(): Promise<string[]> {
    const cards = await this.getAllCards()
    return [...new Set(cards.map((c) => c.language))].sort()
  }

  /** 获取唯一分类列表 */
  async getCategories(): Promise<string[]> {
    const cards = await this.getAllCards()
    return [...new Set(cards.map((c) => c.category))].sort()
  }

  /** 检查标题唯一性 */
  async isTitleUnique(title: string, excludeId?: string): Promise<boolean> {
    const cards = await this.getAllCards()
    return !cards.some((c) => c.title === title && c.id !== excludeId)
  }

  /** 创建卡片 */
  async createCard(dto: CreateSkillDTO): Promise<SkillCard> {
    const isUnique = await this.isTitleUnique(dto.title)
    if (!isUnique) throw new Error("Title already exists")

    const now = Date.now()
    const card: SkillCard = {
      id: `skill-${now}`,
      title: dto.title,
      answer: dto.answer,
      distractors: dto.distractors || [],
      codeSnippet: dto.codeSnippet || "",
      language: dto.language || "other",
      category: dto.category || "默认",
      difficulty: dto.difficulty || "beginner",
      tags: dto.tags || [],
      practiceCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    const cards = await this.getAllCards()
    cards.push(card)
    await this.storage.save(STORAGE_KEY, cards)
    return card
  }

  /** 更新卡片 */
  async updateCard(id: string, dto: UpdateSkillDTO): Promise<boolean> {
    const cards = await this.getAllCards()
    const idx = cards.findIndex((c) => c.id === id)
    if (idx === -1) return false

    if (dto.title && dto.title !== cards[idx].title) {
      const unique = await this.isTitleUnique(dto.title, id)
      if (!unique) throw new Error("Title already exists")
    }

    cards[idx] = { ...cards[idx], ...dto, updatedAt: Date.now() }
    await this.storage.save(STORAGE_KEY, cards)
    return true
  }

  /** 删除卡片 */
  async deleteCard(id: string): Promise<boolean> {
    const cards = await this.getAllCards()
    const filtered = cards.filter((c) => c.id !== id)
    if (filtered.length === cards.length) return false
    await this.storage.save(STORAGE_KEY, filtered)
    return true
  }

  /** 增加练习次数 */
  async incrementPracticeCount(id: string): Promise<boolean> {
    const cards = await this.getAllCards()
    const idx = cards.findIndex((c) => c.id === id)
    if (idx === -1) return false
    cards[idx].practiceCount = (cards[idx].practiceCount || 0) + 1
    cards[idx].updatedAt = Date.now()
    await this.storage.save(STORAGE_KEY, cards)
    return true
  }
}
