import type {
  CreateSkillDTO,
  ReviewData,
  SkillCard,
  UpdateSkillDTO,
} from "./index"
/**
 * 技能学习功能 - 数据存储层
 */
import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"

export const STORAGE_KEY = "skill-learning-cards"
const PRESET_FLAG_KEY = "skill-learning-preset-loaded"

export class SkillStorage {
  private storage: PluginStorage

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }

  /** 检查预设数据是否已加载 */
  async isPresetLoaded(): Promise<boolean> {
    const val = await this.storage.load<string>(PRESET_FLAG_KEY)
    // 用字符串存储标志位，兼容思源 API 对 boolean 序列化的不可靠行为
    return val === "1"
  }

  /** 标记预设数据已加载 */
  async markPresetLoaded(): Promise<void> {
    await this.storage.save(PRESET_FLAG_KEY, "1")
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

  /** 获取所有卡片（自动去重） */
  async getAllCards(): Promise<SkillCard[]> {
    const data = await this.storage.load<SkillCard[]>(STORAGE_KEY)
    const rawCards = (data || []).map((card) => ({
      ...card,
      distractors: card.distractors || [],
      practiceCount: card.practiceCount ?? 0,
      language: card.language || "other",
      difficulty: card.difficulty || "beginner",
      tags: card.tags || [],
    }))

    // 按标题去重（保留最早创建的），修复之前因标记位异常导致的重复数据
    const seen = new Set<string>()
    const deduped = rawCards.filter((c) => {
      if (seen.has(c.title)) return false
      seen.add(c.title)
      return true
    })

    // 检测到重复时自动回写清理
    if (deduped.length < rawCards.length) {
      await this.storage.save(STORAGE_KEY, deduped)
    }

    return deduped
  }

  /** 检查标题唯一性（内部校验） */
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

    cards[idx] = {
      ...cards[idx],
      ...dto,
      updatedAt: Date.now(),
    }
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

  /** 更新复习数据（SM-2 间隔重复） */
  async updateReviewData(id: string, data: ReviewData): Promise<boolean> {
    const cards = await this.getAllCards()
    const idx = cards.findIndex((c) => c.id === id)
    if (idx === -1) return false
    cards[idx].reviewData = { ...data }
    cards[idx].updatedAt = Date.now()
    await this.storage.save(STORAGE_KEY, cards)
    return true
  }

  /** 更新复习数据 + 练习计数（合并为单次存储操作） */
  async updateReviewAndPractice(id: string, data: ReviewData, isCorrect?: boolean): Promise<boolean> {
    const cards = await this.getAllCards()
    const idx = cards.findIndex((c) => c.id === id)
    if (idx === -1) return false
    cards[idx].reviewData = { ...data }
    cards[idx].practiceCount = (cards[idx].practiceCount || 0) + 1
    if (isCorrect === true) {
      cards[idx].correctCount = (cards[idx].correctCount || 0) + 1
    } else if (isCorrect === false) {
      cards[idx].wrongCount = (cards[idx].wrongCount || 0) + 1
    }
    cards[idx].updatedAt = Date.now()
    await this.storage.save(STORAGE_KEY, cards)
    return true
  }
}
