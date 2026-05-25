<template>
  <div class="flashcard-reading-panel">
    <PanelHeader
      :i18n="i18n"
      :plugin="plugin"
      @addCard="openCreateDialog"
      @refresh="handleRefresh"
    />

    <CategoryFilter
      v-model:selectedCategory="selectedCategory"
      v-model:searchQuery="searchQuery"
      :i18n="i18n"
      :categoryOptions="categoryOptions"
      :totalCards="cards.length"
      :filteredCount="filteredCards.length"
    />

    <div
      v-if="cards.length > 0"
      class="card-container"
    >
      <CardList
        v-if="viewMode === 'list'"
        :cards="paginatedCards"
        :i18n="i18n"
        @play="playWord"
        @copyTitle="copyTitle"
        @copyContent="copyContent"
        @edit="editCard"
        @delete="deleteCard"
      />

      <SingleCardView
        v-else-if="viewMode === 'single'"
        :currentCard="currentCard"
        :currentIndex="currentIndex"
        :totalCards="filteredCards.length"
        :i18n="i18n"
        @play="playWord"
        @previous="previousCard"
        @next="nextCard"
        @random="randomCard"
      />

      <StatisticsView
        v-else-if="viewMode === 'statistics'"
        :statistics="statisticsData"
        :i18n="i18n"
      />

      <div
        v-if="viewMode === 'list' && totalPages > 1"
        class="pagination"
      >
        <Button
          variant="secondary"
          size="small"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          {{ i18n.previous || '上一页' }}
        </Button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <Button
          variant="secondary"
          size="small"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          {{ i18n.next || '下一页' }}
        </Button>
      </div>
    </div>

    <div
      v-else
      class="empty-state"
    >
      <IconWrapper
        name="file"
        :size="48"
      />
      <p>{{ i18n.noCards || '暂无卡片' }}</p>
      <Button
        variant="primary"
        icon="add"
        @click="openCreateDialog"
      >
        {{ i18n.addCard || '添加卡片' }}
      </Button>
    </div>

    <div
      v-if="cards.length > 0"
      class="view-mode-toggle"
    >
      <Button
        :variant="viewMode === 'list' ? 'primary' : 'secondary'"
        size="small"
        @click="viewMode = 'list'"
      >
        {{ i18n.listView || '列表' }}
      </Button>
      <Button
        :variant="viewMode === 'single' ? 'primary' : 'secondary'"
        size="small"
        @click="switchToSingleMode"
      >
        {{ i18n.singleView || '单卡' }}
      </Button>
      <Button
        :variant="viewMode === 'statistics' ? 'primary' : 'secondary'"
        size="small"
        @click="viewMode = 'statistics'"
      >
        {{ i18n.statisticsView || '统计' }}
      </Button>
    </div>

    <CardDialog
      :visible="showCreateDialog"
      :editingCard="editingCard"
      :formData="formData"
      :formErrors="formErrors"
      :customCategory="customCategory"
      :categoryOptions="formCategoryOptions"
      :isValid="isFormValid"
      :i18n="i18n"
      @close="closeDialog"
      @save="saveCard"
      @inputTitle="handleTitleInput"
      @validateTitle="validateTitle"
      @changeCategory="handleCategorySelect"
      @update:formData="formData = $event"
      @update:customCategory="customCategory = $event"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  CreateFlashcardDTO,
  Flashcard,
  I18n,
  StatisticsData,
  ViewMode,
} from "./types"

import type { SelectOption } from "@/components/Select.vue"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import CardDialog from "./components/CardDialog.vue"
import CardList from "./components/CardList.vue"
import CategoryFilter from "./components/CategoryFilter.vue"
import PanelHeader from "./components/PanelHeader.vue"
import SingleCardView from "./components/SingleCardView.vue"
import StatisticsView from "./components/StatisticsView.vue"
import { useCardNavigation } from "./composables/useCardNavigation"
import {
  CARD_CONFIG,
  useFlashcardStorage,
} from "./composables/useFlashcardStorage"
import { usePlayWord } from "./composables/usePlayWord"

interface Props {
  i18n: I18n
  plugin: Plugin
}

const props = defineProps<Props>()

const {
  storage,
  cards,
  categories,
  loadCards,
} = useFlashcardStorage(props.plugin)
const { playWord } = usePlayWord(storage, cards, props.i18n)

const selectedCategory = ref<string>("all")
const searchQuery = ref<string>("")
const viewMode = ref<ViewMode>("list")
const currentPage = ref(1)

const showCreateDialog = ref(false)
const editingCard = ref<Flashcard | null>(null)
const formData = ref<CreateFlashcardDTO>({
  title: "",
  content: "",
  category: "",
})
const formErrors = ref<Record<string, string>>({})
const customCategory = ref("")

const normalizedSearchQuery = computed(() =>
  searchQuery.value.toLowerCase().trim(),
)

const categoryOptions = computed<SelectOption[]>(() => [
  {
    value: "all",
    label: props.i18n.allCategories || "全部",
  },
  ...categories.value.map((cat) => ({
    value: cat,
    label: cat,
  })),
])

const allCategories = computed(() => {
  const uniqueCategories = new Set([
    ...CARD_CONFIG.PRESET_CATEGORIES,
    ...categories.value,
  ])
  return Array.from(uniqueCategories).sort()
})

const formCategoryOptions = computed<SelectOption[]>(() => [
  {
    value: "",
    label: props.i18n.selectCategory || "请选择类别",
  },
  {
    value: "__custom__",
    label: props.i18n.customCategory || "自定义...",
  },
  ...allCategories.value.map((cat) => ({
    value: cat,
    label: cat,
  })),
])

const filteredCards = computed(() => {
  let result = cards.value
  const category = selectedCategory.value
  const query = normalizedSearchQuery.value

  if (category !== "all") {
    result = result.filter((card) => card.category === category)
  }

  if (query) {
    result = result.filter(
      (card) =>
        card.title.toLowerCase().includes(query)
        || card.content.toLowerCase().includes(query),
    )
  }

  return result
})

const {
  currentIndex,
  currentCard,
  previous,
  next,
  random,
} = useCardNavigation(filteredCards)

const totalPages = computed(() =>
  Math.ceil(filteredCards.value.length / CARD_CONFIG.PAGE_SIZE),
)

const paginatedCards = computed(() => {
  const start = (currentPage.value - 1) * CARD_CONFIG.PAGE_SIZE
  const end = start + CARD_CONFIG.PAGE_SIZE
  return filteredCards.value.slice(start, end)
})

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

const statisticsData = computed<StatisticsData>(() => {
  const cardList = cards.value
  const categoryStats = new Map<string, number>()
  const cardStats: Array<{ title: string, category: string, count: number }> =
    []
  let totalPractice = 0
  let practicedCards = 0

  for (const card of cardList) {
    const count = card.practiceCount || 0
    totalPractice += count
    if (count > 0) practicedCards++

    categoryStats.set(
      card.category,
      (categoryStats.get(card.category) || 0) + count,
    )

    if (count > 0) {
      cardStats.push({
        title: card.title,
        category: card.category,
        count,
      })
    }
  }

  cardStats.sort((a, b) => b.count - a.count)
  const categoryArray = Array.from(categoryStats.entries())
    .map(([category, count]) => ({
      category,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    totalPractice,
    practicedCards,
    totalCards: cardList.length,
    categoryStats: categoryArray,
    cardStats: cardStats.slice(0, 20),
  }
})

const handleRefresh = async () => {
  try {
    await loadCards()
  } catch {
    showMessage(props.i18n.loadFailed || "加载卡片失败", 3000, "error")
  }
}

const reloadAfterMutation = async () => {
  try {
    await loadCards()
  } catch {
    showMessage(props.i18n.loadFailed || "加载卡片失败", 3000, "error")
  }
}

const switchToSingleMode = () => {
  viewMode.value = "single"
  const len = filteredCards.value.length
  currentIndex.value = len > 0 ? Math.floor(Math.random() * len) : 0
}

const previousCard = () => {
  previous()
  playWord(currentCard.value)
}

const nextCard = () => {
  next()
  playWord(currentCard.value)
}

const randomCard = () => {
  random()
  playWord(currentCard.value)
}

const handleTitleInput = () => {
  if (formErrors.value.title) {
    delete formErrors.value.title
  }
}

const validateTitle = async () => {
  if (!formData.value.title.trim()) {
    formErrors.value.title = props.i18n.titleEmpty || "标题不能为空"
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
    formErrors.value.title = props.i18n.titleDuplicate || "标题已存在"
  } else {
    delete formErrors.value.title
  }
}

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
    showMessage(props.i18n.selectCategory || "请选择类别", 2000, "error")
    return
  }

  try {
    const cardData = {
      ...formData.value,
      category: categoryToSave,
    }

    if (editingCard.value) {
      await storage.updateCard(editingCard.value.id, cardData)
      showMessage(props.i18n.updateSuccess || "卡片已更新", 2000, "info")
    } else {
      await storage.createCard(cardData)
      showMessage(props.i18n.createSuccess || "卡片已创建", 2000, "info")
    }

    closeDialog()
    await reloadAfterMutation()
  } catch (error: any) {
    showMessage(
      error.message || props.i18n.saveFailed || "保存失败",
      3000,
      "error",
    )
  }
}

const handleCategorySelect = () => {
  if (formData.value.category === "__custom__") {
    customCategory.value = ""
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
  if (!window.confirm(props.i18n.confirmDelete || "确定要删除这张卡片吗？")) {
    return
  }

  try {
    await storage.deleteCard(card.id)
    showMessage(props.i18n.deleteSuccess || "卡片已删除", 2000, "info")
    await reloadAfterMutation()
  } catch (error: any) {
    showMessage(
      error.message || props.i18n.deleteFailed || "删除失败",
      3000,
      "error",
    )
  }
}

const copyTitle = async (card: Flashcard) => {
  try {
    await navigator.clipboard.writeText(card.title)
    showMessage("已复制单词", 2000, "info")
  } catch {
    showMessage("复制失败", 2000, "error")
  }
}

const copyContent = async (card: Flashcard) => {
  try {
    await navigator.clipboard.writeText(card.content)
    showMessage("已复制内容", 2000, "info")
  } catch {
    showMessage("复制失败", 2000, "error")
  }
}

watch(searchQuery, () => {
  currentPage.value = 1
  currentIndex.value = 0
})

watch(selectedCategory, () => {
  currentPage.value = 1
  currentIndex.value = 0
})
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
