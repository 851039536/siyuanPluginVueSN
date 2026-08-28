<!-- 单词阅读功能 - 主面板组件 -->
<template>
  <div class="flashcard-reading-panel">
    <PanelHeader
      :i18n="i18n"
      :plugin="plugin"
      :floating="isFloating"
      @addCard="openCreateDialog"
      @refresh="reload"
      @openWindow="openInWindow"
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
        @toggleTypingHidden="toggleTypingHidden"
        @play="playWord"
        @copyTitle="(c: Flashcard) => handleCopy(c.title, t.copiedTitle)"
        @copyContent="(c: Flashcard) => handleCopy(c.content, t.copiedContent)"
        @edit="editCard"
        @delete="deleteCard"
      />

      <StatisticsView
        v-else-if="viewMode === 'statistics'"
        :statistics="statisticsData"
        :i18n="i18n"
      />

      <!-- 打字练习视图（过滤已标记单词后为空时显示空态） -->
      <TypingPractice
        v-else-if="viewMode === 'typing' && typingCards.length > 0"
        :currentCard="typingQueue.currentCard.value"
        :currentIndex="typingQueue.currentIndex.value"
        :totalCards="typingQueue.queue.value.length"
        :caseInsensitive="caseInsensitive"
        :instantReset="instantReset"
        :coverMode="coverMode"
        :timerEnabled="timerEnabled"
        :hideMarked="hideMarked"
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
        @toggleHidden="toggleTypingHidden"
        @update:caseInsensitive="caseInsensitive = $event"
        @update:instantReset="instantReset = $event"
        @update:coverMode="coverMode = $event"
        @update:timerEnabled="onTimerToggle"
        @update:hideMarked="onHideMarkedToggle"
        @update:sessionSize="onSessionSizeChange"
      />

      <!-- 空态：筛选后无卡片可练习（文案："暂无卡片"） -->
      <div
        v-else-if="viewMode === 'typing'"
        class="empty-state"
      >
        <IconWrapper
          name="file"
          :size="48"
        />
        <p>{{ t.noCards }}</p>
      </div>

      <div
        v-if="viewMode === 'list' && totalPages > 1"
        class="pagination"
      >
        <Button
          variant="secondary"
          size="xsmall"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          {{ t.previous }}
        </Button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <Button
          variant="secondary"
          size="xsmall"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          {{ t.next }}
        </Button>
      </div>
    </div>

    <!-- 空态：无任何卡片（文案："暂无卡片" + "添加卡片"按钮） -->
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

    <!-- 底部视图切换栏（文案："列表" / "统计" / "边学边写"） -->
    <div
      v-if="cards.length > 0"
      class="view-mode-toggle"
    >
      <Button
        :variant="viewMode === 'list' ? 'primary' : 'secondary'"
        size="xsmall"
        @click="viewMode = 'list'"
      >
        {{ t.listView }}
      </Button>
      <Button
        :variant="viewMode === 'statistics' ? 'primary' : 'secondary'"
        size="xsmall"
        @click="viewMode = 'statistics'"
      >
        {{ t.statisticsView }}
      </Button>
      <Button
        :variant="viewMode === 'typing' ? 'primary' : 'secondary'"
        size="xsmall"
        @click="switchMode('typing')"
      >
        {{ t.typingView }}
      </Button>
    </div>

    <!-- 卡片创建/编辑弹窗（自包含：内部持有表单状态并直接调 storage） -->
    <CardDialog
      :visible="showCreateDialog"
      :editingCard="editingCard"
      :i18n="i18n"
      :plugin="plugin"
      @close="closeDialog"
      @saved="onCardSaved"
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
import { showMessage, getFrontend } from "siyuan"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { emitCustomEvent } from "@/utils/eventBus"
import CardDialog from "./components/CardDialog.vue"
import CardList from "./components/CardList.vue"
import CategoryFilter from "./components/CategoryFilter.vue"
import PanelHeader from "./components/PanelHeader.vue"
import StatisticsView from "./components/StatisticsView.vue"
import TypingPractice from "./components/TypingPractice.vue"
import { useFlashcardOperations } from "./composables/useFlashcardOperations"
import {
  CARD_CONFIG,
  useFlashcardStorage,
} from "./composables/useFlashcardStorage"
import { useI18n } from "./composables/useI18n"
import { usePlayWord } from "./composables/usePlayWord"
import { useTypingQueue } from "./composables/useTypingQueue"
import { copyAndNotify, syncIncrementPractice } from "./utils"

interface Props {
  i18n: I18n
  plugin: Plugin
  /** 承载形态：dock = 主窗口 Dock 面板（默认）/ tab = 独立窗口页签 */
  mode?: "dock" | "tab"
}

const props = withDefaults(defineProps<Props>(), {
  mode: "dock",
})

const t = useI18n(props.i18n)

// 独立浮动窗口识别：desktop = 主窗口 / desktop-window = 浮动窗口（隐藏重复标题与打开按钮）
const isFloating = computed(() => getFrontend() === "desktop-window")

/** 在独立浮动窗口打开单词阅读（经 FlashcardReading 挂载的 FlashcardTabManager 调度） */
const openInWindow = () => {
  void (props.plugin as any).__flashcardReading?.openFloating()
}

const {
  storage,
  cards,
  categories,
  loadCards,
} = useFlashcardStorage(props.plugin)
const { playWord } = usePlayWord(storage, cards, t)

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
  openCreateDialog,
  closeDialog,
  editCard,
  deleteCard,
} = useFlashcardOperations(storage, reload, t)

// 保存成功：关闭弹窗并刷新列表（存储写入由 CardDialog 内部完成）
const onCardSaved = async () => {
  closeDialog()
  await reload()
}

const selectedCategory = ref<string>("all")
const searchQuery = ref<string>("")
const viewMode = ref<ViewMode>("list")
const caseInsensitive = ref(false)
const instantReset = ref(false)
const coverMode = ref(false)
const timerEnabled = ref(true)
const hideMarked = ref(false)
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

// 边学边写专用列表：总开关开启时剔除已标记（typingHidden）的单词，列表/统计视图不受影响
const typingCards = computed(() => {
  if (!hideMarked.value) return filteredCards.value
  return filteredCards.value.filter((card) => !card.typingHidden)
})

const typingQueue = useTypingQueue(typingCards)

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

const switchMode = (mode: "typing") => {
  viewMode.value = mode
  typingQueue.rebuild()
  typingQueue.currentIndex.value = 0
}

const navigateAndPlay = (action: "previous" | "next" | "random") => {
  typingQueue[action]()
  playWord(typingQueue.currentCard.value)
}

const handleCopy = async (text: string, message: string) => {
  await copyAndNotify(text, message, t.value.copyFailed)
}

const onTypingCorrect = async (card: Flashcard | null) => {
  if (!card) return
  sessionTotal.value++
  sessionCorrect.value++
  try {
    await syncIncrementPractice(storage, cards, card.id)
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

const onHideMarkedToggle = (val: boolean) => {
  hideMarked.value = val
  saveTypingSettings()
  typingQueue.rebuild()
  typingQueue.currentIndex.value = 0
}

// 边学边写中标记当前词：从队列原位剔除并保持进度，不打断练习节奏
const removeFromTypingQueue = (cardId: string) => {
  const queue = typingQueue.queue.value
  const idx = queue.findIndex((c) => c.id === cardId)
  if (idx === -1) return
  queue.splice(idx, 1)
  if (idx < typingQueue.currentIndex.value) {
    typingQueue.currentIndex.value--
  } else if (typingQueue.currentIndex.value >= queue.length) {
    typingQueue.currentIndex.value = Math.max(0, queue.length - 1)
  }
}

const toggleTypingHidden = async (card: Flashcard) => {
  try {
    const next = !card.typingHidden
    await storage.updateCard(card.id, { typingHidden: next })
    // 广播数据变更，保证 Dock/弹窗多入口同步
    emitCustomEvent("flashcardDataChanged")
    await reload()
    if (viewMode.value === "typing" && hideMarked.value && next) {
      removeFromTypingQueue(card.id)
    } else {
      // 词留在队列时（非练习视图 / 总开关关闭），同步队列内旧对象的标记字段以即时刷新图标
      const queued = typingQueue.queue.value.find((c) => c.id === card.id)
      if (queued) queued.typingHidden = next
    }
  } catch {
    showMessage(t.value.saveFailed, 3000, "error")
  }
}

const onSessionSizeChange = (val: number) => {
  sessionSize.value = val
  saveTypingSettings()
}

const saveTypingSettings = () => {
  storage.saveTypingSettings({
    sessionSize: sessionSize.value,
    timerEnabled: timerEnabled.value,
    hideMarked: hideMarked.value,
  })
}

// 初始化时加载持久化设置
onMounted(async () => {
  const settings = await storage.getTypingSettings()
  timerEnabled.value = settings.timerEnabled
  sessionSize.value = settings.sessionSize
  hideMarked.value = settings.hideMarked
})

watch([searchQuery, selectedCategory], () => {
  currentPage.value = 1
  typingQueue.rebuild()
  typingQueue.currentIndex.value = 0
})
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
