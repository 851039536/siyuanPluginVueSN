/**
 * 技能学习 - 存储响应式封装
 */
import { ref, type Ref } from "vue"
import type { Plugin } from "siyuan"
import type { SkillCard, CreateSkillDTO, UpdateSkillDTO, ReviewData } from "../types"
import { SkillStorage } from "../types/storage"

export function useSkillStorage(plugin: Plugin) {
  const storage = new SkillStorage(plugin)
  const cards: Ref<SkillCard[]> = ref([])
  const loading = ref(false)

  async function loadCards() {
    loading.value = true
    cards.value = await storage.getAllCards()
    loading.value = false
  }

  async function createCard(dto: CreateSkillDTO): Promise<SkillCard | null> {
    try {
      const card = await storage.createCard(dto)
      cards.value = [...cards.value, card]
      return card
    } catch {
      return null
    }
  }

  async function updateCard(id: string, dto: UpdateSkillDTO): Promise<boolean> {
    try {
      const ok = await storage.updateCard(id, dto)
      if (ok) {
        const idx = cards.value.findIndex((c) => c.id === id)
        if (idx !== -1) {
          cards.value[idx] = { ...cards.value[idx], ...dto, updatedAt: Date.now() }
        }
      }
      return ok
    } catch {
      return false
    }
  }

  async function deleteCard(id: string): Promise<boolean> {
    const ok = await storage.deleteCard(id)
    if (ok) {
      cards.value = cards.value.filter((c) => c.id !== id)
    }
    return ok
  }

  async function incrementPracticeCount(id: string): Promise<boolean> {
    const ok = await storage.incrementPracticeCount(id)
    if (ok) {
      const card = cards.value.find((c) => c.id === id)
      if (card) card.practiceCount++
    }
    return ok
  }

  /** 闪卡答题后更新：练习计数 + 对错计数（乐观更新） */
  async function incrementPracticeWithAccuracy(id: string, isCorrect: boolean): Promise<boolean> {
    const ok = await storage.incrementPracticeCount(id)
    if (ok) {
      const card = cards.value.find((c) => c.id === id)
      if (card) {
        card.practiceCount++
        if (isCorrect) {
          card.correctCount = (card.correctCount || 0) + 1
        } else {
          card.wrongCount = (card.wrongCount || 0) + 1
        }
      }
    }
    return ok
  }

  /** 复习评分：合并 reviewData + practiceCount 为单次存储（乐观更新） */
  async function updateReviewAndPractice(id: string, data: ReviewData, isCorrect?: boolean): Promise<boolean> {
    const ok = await storage.updateReviewAndPractice(id, data, isCorrect)
    if (ok) {
      const card = cards.value.find((c) => c.id === id)
      if (card) {
        card.reviewData = { ...data }
        card.practiceCount++
        if (isCorrect === true) {
          card.correctCount = (card.correctCount || 0) + 1
        } else if (isCorrect === false) {
          card.wrongCount = (card.wrongCount || 0) + 1
        }
      }
    }
    return ok
  }

  async function updateReviewData(id: string, data: ReviewData): Promise<boolean> {
    const ok = await storage.updateReviewData(id, data)
    if (ok) {
      const card = cards.value.find((c) => c.id === id)
      if (card) card.reviewData = { ...data }
    }
    return ok
  }

  return {
    storage,
    cards,
    loading,
    loadCards,
    createCard,
    updateCard,
    deleteCard,
    incrementPracticeCount,
    incrementPracticeWithAccuracy,
    updateReviewData,
    updateReviewAndPractice,
  }
}
