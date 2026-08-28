/**
 * 单词本练习次数缓存（FloatingToolbar 与 HeatmapMarker 共享）
 * 统一从闪卡存储加载单词，避免两份独立缓存
 */
import { Plugin } from "siyuan"
import { FlashcardStorage } from "@/utils/sharedStorage/flashcardStorage"

/** 缓存 TTL（毫秒） */
const CACHE_TTL_MS = 30000

export class WordPracticeCache {
  private flashcardStorage: FlashcardStorage
  private wordHeatMap = new Map<string, number>()
  private cacheTimestamp = 0

  constructor(plugin: Plugin) {
    this.flashcardStorage = new FlashcardStorage(plugin)
  }

  /** 全量刷新缓存（失败静默，下次重试） */
  async refresh(): Promise<void> {
    try {
      const cards = await this.flashcardStorage.getAllCards()
      this.wordHeatMap.clear()
      for (const card of cards) {
        const word = card.title.toLowerCase().trim()
        if (word && /^[a-z]+$/i.test(word)) {
          const existing = this.wordHeatMap.get(word)
          if (existing === undefined || card.practiceCount > existing) {
            this.wordHeatMap.set(word, card.practiceCount)
          }
        }
      }
      this.cacheTimestamp = Date.now()
    } catch (error) {
      console.error("[WordPracticeCache] 刷新单词缓存失败:", error)
    }
  }

  /** 确保缓存未过期，过期则刷新 */
  async ensureFresh(): Promise<void> {
    if (Date.now() - this.cacheTimestamp > CACHE_TTL_MS) {
      await this.refresh()
    }
  }

  /** 查询单词练习次数（未收录返回 undefined） */
  getPracticeCount(word: string): number | undefined {
    return this.wordHeatMap.get(word.toLowerCase().trim())
  }

  /** 已收录单词数 */
  get size(): number {
    return this.wordHeatMap.size
  }
}
