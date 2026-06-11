/**
 * 单词阅读功能 - 卡片 CRUD 操作 composable
 */
import type { ComputedRef } from "vue"
import type {
  CreateFlashcardDTO,
  Flashcard,
} from "../types"
import type { FlashcardStorage } from "../types/storage"
import { showMessage } from "siyuan"
import { computed, ref } from "vue"
import { CARD_CONFIG } from "./useFlashcardStorage"

export function useFlashcardOperations(
  storage: FlashcardStorage,
  reload: () => Promise<void>,
  t: ComputedRef<Required<import("../types").I18n>>,
) {
  const showCreateDialog = ref(false)
  const editingCard = ref<Flashcard | null>(null)
  const formData = ref<CreateFlashcardDTO>({
    title: "",
    content: "",
    category: "",
  })
  const formErrors = ref<Record<string, string>>({})
  const customCategory = ref("")

  const isFormValid = computed(() => {
    const hasValidCategory =
      formData.value.category === "__custom__"
        ? customCategory.value.trim() !== ""
        : formData.value.category.trim() !== ""

    return (
      formData.value.title.trim() !== ""
      && formData.value.content.trim() !== ""
      && hasValidCategory
      && Object.keys(formErrors.value).length === 0
    )
  })

  const openCreateDialog = () => {
    showCreateDialog.value = true
  }

  const closeDialog = () => {
    showCreateDialog.value = false
    editingCard.value = null
    formData.value = {
      title: "",
      content: "",
      category: "",
    }
    formErrors.value = {}
    customCategory.value = ""
  }

  const handleTitleInput = () => {
    if (formErrors.value.title) {
      delete formErrors.value.title
    }
  }

  const validateTitle = async () => {
    if (!formData.value.title.trim()) {
      formErrors.value.title = t.value.titleEmpty
      return
    }

    if (editingCard.value && formData.value.title === editingCard.value.title) {
      delete formErrors.value.title
      return
    }

    const isUnique = await storage.isTitleUnique(
      formData.value.title,
      editingCard.value?.id,
    )

    if (!isUnique) {
      formErrors.value.title = t.value.titleDuplicate
    } else {
      delete formErrors.value.title
    }
  }

  const handleCategorySelect = () => {
    if (formData.value.category === "__custom__") {
      customCategory.value = ""
    }
  }

  const saveCard = async () => {
    await validateTitle()

    if (!isFormValid.value) {
      return
    }

    const categoryToSave =
      formData.value.category === "__custom__"
        ? customCategory.value.trim()
        : formData.value.category

    if (!categoryToSave) {
      showMessage(t.value.selectCategory, 2000, "error")
      return
    }

    try {
      const cardData = {
        ...formData.value,
        category: categoryToSave,
      }

      if (editingCard.value) {
        await storage.updateCard(editingCard.value.id, cardData)
        showMessage(t.value.updateSuccess, 2000, "info")
      } else {
        await storage.createCard(cardData)
        showMessage(t.value.createSuccess, 2000, "info")
      }

      closeDialog()
      await reload()
    } catch (error: any) {
      showMessage(
        error.message || t.value.saveFailed,
        3000,
        "error",
      )
    }
  }

  const editCard = (card: Flashcard) => {
    editingCard.value = card
    const category = card.category
    const isCustomCategory = !CARD_CONFIG.PRESET_CATEGORIES.includes(category)
    formData.value = {
      title: card.title,
      content: card.content,
      category: isCustomCategory ? "__custom__" : category,
    }
    customCategory.value = isCustomCategory ? category : ""
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
      await reload()
    } catch (error: any) {
      showMessage(
        error.message || t.value.deleteFailed,
        3000,
        "error",
      )
    }
  }

  return {
    showCreateDialog,
    editingCard,
    formData,
    formErrors,
    customCategory,
    isFormValid,
    openCreateDialog,
    closeDialog,
    handleTitleInput,
    validateTitle,
    handleCategorySelect,
    saveCard,
    editCard,
    deleteCard,
  }
}
