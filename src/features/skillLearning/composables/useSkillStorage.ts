/**
 * 技能学习 - 存储响应式封装
 */
import { ref, type Ref } from "vue"
import type { Plugin } from "siyuan"
import type { SkillCard, CreateSkillDTO, UpdateSkillDTO } from "../types"
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
    const card = await storage.createCard(dto)
    await loadCards()
    return card
  }

  async function updateCard(id: string, dto: UpdateSkillDTO): Promise<boolean> {
    const ok = await storage.updateCard(id, dto)
    if (ok) await loadCards()
    return ok
  }

  async function deleteCard(id: string): Promise<boolean> {
    const ok = await storage.deleteCard(id)
    if (ok) await loadCards()
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

  return {
    storage,
    cards,
    loading,
    loadCards,
    createCard,
    updateCard,
    deleteCard,
    incrementPracticeCount,
  }
}
