/**
 * 单词阅读功能 - 卡片列表侧操作 composable（弹窗开关 + 删除；表单 CRUD 已内聚到 CardDialog）
 */
import type { ComputedRef } from "vue"
import type {
  Flashcard,
  I18n,
} from "../types"
import type { FlashcardStorage } from "../types/storage"
import { showMessage } from "siyuan"
import { ref } from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import { getErrorMessage } from "@/utils/stringUtils"

export function useFlashcardOperations(
  storage: FlashcardStorage,
  reload: () => Promise<void>,
  t: ComputedRef<Required<I18n>>,
) {
  const showCreateDialog = ref(false)
  const editingCard = ref<Flashcard | null>(null)

  const openCreateDialog = () => {
    editingCard.value = null
    showCreateDialog.value = true
  }

  const closeDialog = () => {
    showCreateDialog.value = false
    editingCard.value = null
  }

  const editCard = (card: Flashcard) => {
    editingCard.value = card
    showCreateDialog.value = true
  }

  const deleteCard = async (card: Flashcard) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.value.confirmDelete)) {
      return
    }

    try {
      await storage.deleteCard(card.id)
      showMessage(t.value.deleteSuccess, 2000, "info")
      // 广播数据变更，保证 Dock/弹窗多入口同步
      emitCustomEvent("flashcardDataChanged")
      await reload()
    } catch (error: unknown) {
      showMessage(
        getErrorMessage(error) || t.value.deleteFailed,
        3000,
        "error",
      )
    }
  }

  return {
    showCreateDialog,
    editingCard,
    openCreateDialog,
    closeDialog,
    editCard,
    deleteCard,
  }
}
