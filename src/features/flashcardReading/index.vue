<template>
  <div class="flashcard-reading-panel">
    <PanelHeader
      :i18n="i18n"
      :plugin="plugin"
      @addCard="openCreateDialog"
      @refresh="reload"
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
        @copyTitle="(c: Flashcard) => handleCopy(c.title, '已复制单词')"
        @copyContent="(c: Flashcard) => handleCopy(c.content, '已复制内容')"
        @edit="editCard"
        @delete="deleteCard"
      />

      <SingleCardView
        v-else-if="viewMode === 'single'"
        :currentCard="typingQueue.currentCard.value"
        :currentIndex="typingQueue.currentIndex.value"
        :totalCards="typingQueue.queue.value.length"
        :i18n="i18n"
        @play="playWord"
        @previous="() => navigateAndPlay('previous')"
        @next="() => navigateAndPlay('next')"
        @random="() => navigateAndPlay('random')"
        @copyTitle="(c: Flashcard) => handleCopy(c.title, '已复制单词')"
        @copyContent="(c: Flashcard) => handleCopy(c.content, '已复制内容')"
        @edit="editCard"
        @delete="deleteCard"
      />

      <StatisticsView
        v-else-if="viewMode === 'statistics'"
        :statistics="statisticsData"
        :i18n="i18n"
      />

      <TypingPractice
        v-else-if="viewMode === 'typing'"
        :currentCard="typingQueue.currentCard.value"
        :currentIndex="typingQueue.currentIndex.value"
        :totalCards="typingQueue.queue.value.length"
        :caseInsensitive="caseInsensitive"
        :instantReset="instantReset"
        :coverMode="coverMode"
        :timerEnabled="timerEnabled"
        :sessionSize="sessionSize"
        :sessionTotal="sessionTotal"
        :sessionCorrect="sessionCorrect"
        :roundComplete="roundComplete"
        :i18n="i18n"
        @play="playWord"
        @previous="() => navigateAndPlay('previous')"
        @next="() => navigateAndPlay('next')"
        @random="() => navigateAndPlay('random')"
        @skip="() => navigateAndPlay('next')"
        @correct="onTypingCorrect"
        @wrong="() => sessionTotal++"
        @restartRound="restartRound"
        @update:caseInsensitive="caseInsensitive = $event"
        @update:instantReset="instantReset = $event"
        @update:coverMode="coverMode = $event"
        @update:timerEnabled="onTimerToggle"
        @update:sessionSize="onSessionSizeChange"
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
          {{ t.previous }}
        </Button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <Button
          variant="secondary"
          size="small"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          {{ t.next }}
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
      <p>{{ t.noCards }}</p>
      <Button
        variant="primary"
        icon="add"
        @click="openCreateDialog"
      >
        {{ t.addCard }}
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
        {{ t.listView }}
      </Button>
      <Button
        :variant="viewMode === 'single' ? 'primary' : 'secondary'"
        size="small"
        @click="switchMode('single')"
      >
        {{ t.singleView }}
      </Button>
      <Button
        :variant="viewMode === 'statistics' ? 'primary' : 'secondary'"
        size="small"
        @click="viewMode = 'statistics'"
      >
        {{ t.statisticsView }}
      </Button>
      <Button
        :variant="viewMode === 'typing' ? 'primary' : 'secondary'"
        size="small"
        @click="switchMode('typing')"
      >
        {{ t.typingView }}
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
  Flashcard,
  I18n,
  StatisticsData,
  ViewMode,
} from "./types"

import type { SelectOption } from "@/components/Select.vue"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import CardDialog from "./components/CardDialog.vue"
import CardList from "./components/CardList.vue"
import CategoryFilter from "./components/CategoryFilter.vue"
import PanelHeader from "./components/PanelHeader.vue"
import SingleCardView from "./components/SingleCardView.vue"
import StatisticsView from "./components/StatisticsView.vue"
import TypingPractice from "./components/TypingPractice.vue"
import {
  CARD_CONFIG,
  useFlashcardStorage,
} from "./composables/useFlashcardStorage"
import { usePlayWord } from "./composables/usePlayWord"
import { useTypingQueue } from "./composables/useTypingQueue"
import { useI18n } from "./composables/useI18n"
import { useFlashcardOperations } from "./composables/useFlashcardOperations"

interface Props {
  i18n: I18n
  plugin: Plugin
}

const props = defineProps<Props>()

const t = useI18n(props.i18n)

const {
  storage,
  cards,
  categories,
  loadCards,
} = useFlashcardStorage(props.plugin)
const { playWord } = usePlayWord(storage, cards, props.i18n)

const reload = async () => {
  try {
    await loadCards()
  } catch {
    showMessage(t.value.loadFailed, 3000, "error")
  }
}

const {
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
} = useFlashcardOperations(storage, reload, t)

const selectedCategory = ref<string>("all")
const searchQuery = ref<string>("")
const viewMode = ref<ViewMode>("list")
const caseInsensitive = ref(false)
const instantReset = ref(false)
const coverMode = ref(false)
const timerEnabled = ref(true)
const sessionSize = ref(10)
const sessionTotal = ref(0)
const sessionCorrect = ref(0)
const currentPage = ref(1)

const normalizedSearchQuery = computed(() =>
  searchQuery.value.toLowerCase().trim(),
)

const categoryOptions = computed<SelectOption[]>(() => [
  {
    value: "all",
    label: t.value.allCategories,
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
    label: t.value.selectCategory,
  },
  {
    value: "__custom__",
    label: t.value.customCategory,
  },
  ...allCategories.value.map((cat) => ({
    value: cat,
    label: cat,
  })),
])

const roundComplete = computed(
  () => sessionTotal.value > 0 && sessionTotal.value >= sessionSize.value,
)

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

const typingQueue = useTypingQueue(filteredCards)

const totalPages = computed(() =>
  Math.ceil(filteredCards.value.length / CARD_CONFIG.PAGE_SIZE),
)

const paginatedCards = computed(() => {
  const start = (currentPage.value - 1) * CARD_CONFIG.PAGE_SIZE
  const end = start + CARD_CONFIG.PAGE_SIZE
  return filteredCards.value.slice(start, end)
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

const switchMode = (mode: "single" | "typing") => {
  viewMode.value = mode
  typingQueue.rebuild()
  typingQueue.currentIndex.value = 0
}

const navigateAndPlay = (action: "previous" | "next" | "random") => {
  typingQueue[action]()
  playWord(typingQueue.currentCard.value)
}

const handleCopy = async (text: string, message: string) => {
  const ok = await copyToClipboard(text)
  showMessage(ok ? message : "复制失败", 2000, ok ? "info" : "error")
}

const onTypingCorrect = async (card: Flashcard | null) => {
  if (!card) return
  sessionTotal.value++
  sessionCorrect.value++
  try {
    await storage.incrementPracticeCount(card.id)
    const index = cards.value.findIndex((c) => c.id === card.id)
    if (index !== -1) {
      cards.value[index].practiceCount =
        (cards.value[index].practiceCount || 0) + 1
    }
  } catch {
    // 静默处理
  }
}

const restartRound = () => {
  sessionTotal.value = 0
  sessionCorrect.value = 0
  typingQueue.rebuild()
  typingQueue.currentIndex.value = 0
}

const onTimerToggle = (val: boolean) => {
  timerEnabled.value = val
  saveTypingSettings()
}

const onSessionSizeChange = (val: number) => {
  sessionSize.value = val
  saveTypingSettings()
}

const saveTypingSettings = () => {
  storage.saveTypingSettings({
    sessionSize: sessionSize.value,
    timerEnabled: timerEnabled.value,
  })
}

// 初始化时加载持久化设置
onMounted(async () => {
  const settings = await storage.getTypingSettings()
  timerEnabled.value = settings.timerEnabled
  sessionSize.value = settings.sessionSize
})

watch([searchQuery, selectedCategory], () => {
  currentPage.value = 1
  typingQueue.currentIndex.value = 0
})
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
