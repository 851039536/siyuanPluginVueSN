// 单词阅读功能 - 卡片存储状态管理与监听（模块级共享单例，Dock/弹窗复用同一份状态）
import type { Plugin } from "siyuan"
import type { Flashcard } from "../types"
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { FlashcardStorage } from "../types/storage"

// CARD_CONFIG 已迁移至 types 层（共享常量分层规则），此处 re-export 兼容既有导入
export { CARD_CONFIG } from "../types"

// 模块级共享状态：storage 单例 + 响应式卡片/类别，多组件共享避免重复 IO 与数据不同步
let sharedStorage: FlashcardStorage | null = null
const cards = ref<Flashcard[]>([])
const categories = ref<string[]>([])

// flashcardDataChanged 监听采用引用计数：首个组件挂载时注册，最后一个卸载时移除
let listenerCount = 0
let dataChangeHandler: (() => void) | null = null

const loadCards = async () => {
  if (!sharedStorage) return
  try {
    cards.value = await sharedStorage.getAllCards()
    categories.value = await sharedStorage.getCategories()
  } catch (error) {
    console.error("Failed to load cards:", error)
  }
}

/** 获取（或创建）模块级共享 storage 实例，供 FlashcardReading 类与组件复用 */
export function getSharedFlashcardStorage(plugin: Plugin): FlashcardStorage {
  if (!sharedStorage) {
    sharedStorage = new FlashcardStorage(plugin)
  }
  return sharedStorage
}

/** 插件卸载时重置模块级状态，避免残留旧 plugin 实例引用 */
export function resetFlashcardStorage() {
  if (dataChangeHandler) {
    window.removeEventListener("flashcardDataChanged", dataChangeHandler)
    dataChangeHandler = null
  }
  listenerCount = 0
  sharedStorage = null
  cards.value = []
  categories.value = []
}

export function useFlashcardStorage(plugin: Plugin) {
  const storage = getSharedFlashcardStorage(plugin)

  onMounted(() => {
    loadCards()
    listenerCount++
    if (!dataChangeHandler) {
      dataChangeHandler = () => loadCards()
      window.addEventListener("flashcardDataChanged", dataChangeHandler)
    }
  })

  onUnmounted(() => {
    listenerCount--
    if (listenerCount <= 0 && dataChangeHandler) {
      window.removeEventListener("flashcardDataChanged", dataChangeHandler)
      dataChangeHandler = null
      listenerCount = 0
    }
  })

  return {
    storage,
    cards,
    categories,
    loadCards,
  }
}
