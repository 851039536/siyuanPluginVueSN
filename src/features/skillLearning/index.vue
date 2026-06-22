<template>
  <div class="skill-learning-panel">
    <!-- 顶部工具栏 -->
    <div class="skill-learning-panel__header">
      <div class="skill-learning-panel__tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="skill-learning-panel__tab"
          :class="{ 'skill-learning-panel__tab--active': viewMode === tab.id }"
          @click="viewMode = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="skill-learning-panel__actions">
        <button class="skill-learning-panel__btn" @click="openAddDialog" :title="t.addCard">
          +
        </button>
      </div>
    </div>

    <!-- 视图内容 -->
    <div class="skill-learning-panel__content">
      <SkillListView
        v-if="viewMode === 'list'"
        :cards="cards"
        :i18n="fullI18n"
        @select="handleSelectCard"
      />
      <FlashcardView
        v-else-if="viewMode === 'flashcard'"
        :cards="cards"
        :i18n="fullI18n"
      />
      <ReviewMode
        v-else-if="viewMode === 'review'"
        :cards="cards"
        :currentCard="reviewQueue.currentCard.value"
        :currentIndex="reviewQueue.currentIndex.value"
        :isFlipped="reviewQueue.isFlipped.value"
        :roundComplete="reviewQueue.roundComplete.value"
        :totalCount="reviewQueue.totalCount.value"
        :reviewed="reviewQueue.reviewed.value"
        :i18n="fullI18n"
        @flip="reviewQueue.flip()"
        @rate="handleRate"
        @restart="reviewQueue.restart()"
      />
    </div>

    <!-- 底部统计 -->
    <div class="skill-learning-panel__footer">
      <span>{{ t.totalCards }}: {{ cards.length }}</span>
      <span>{{ t.practicedCards }}: {{ practicedCount }}</span>
    </div>

    <!-- 新建/编辑弹窗 -->
    <SkillDialog
      v-if="showDialog"
      :i18n="fullI18n"
      :editCard="editingCard"
      @save="handleCreate"
      @update="handleUpdate"
      @close="closeDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import type { Plugin } from "siyuan"
import type { SkillCard, SkillI18n, ViewMode, CreateSkillDTO, ReviewRating } from "./types"
import { useSkillStorage } from "./composables/useSkillStorage"
import { useReviewQueue } from "./composables/useReviewQueue"
import { useI18n } from "./composables/useI18n"
import { PRESET_CARDS } from "./data/presetData"
import SkillListView from "./components/SkillListView.vue"
import FlashcardView from "./components/FlashcardView.vue"
import ReviewMode from "./components/ReviewMode.vue"
import SkillDialog from "./components/SkillDialog.vue"

const props = defineProps<{
  i18n: SkillI18n | undefined
  plugin: Plugin
}>()

const t = computed(() => fullI18n.value as Record<string, string>)
const fullI18n = useI18n(props.i18n)
const { cards, loadCards, createCard, updateCard, deleteCard, incrementPracticeCount, storage } =
  useSkillStorage(props.plugin)

const viewMode = ref<ViewMode>("list")
const reviewQueue = useReviewQueue(cards)
const showDialog = ref(false)
const editingCard = ref<SkillCard | null>(null)

const practicedCount = computed(() => cards.value.filter((c) => c.practiceCount > 0).length)

const tabs = computed(() => [
  { id: "list" as ViewMode, label: fullI18n.value.listView || "列表" },
  { id: "flashcard" as ViewMode, label: fullI18n.value.flashcardView || "闪卡" },
  { id: "review" as ViewMode, label: fullI18n.value.reviewView || "复习" },
])

onMounted(async () => {
  await loadCards()
  const presetLoaded = await storage.isPresetLoaded()
  if (!presetLoaded) {
    await storage.bulkCreate(PRESET_CARDS)
    await storage.markPresetLoaded()
    await loadCards()
    console.log(fullI18n.value.presetDataLoaded)
  }
})

function openAddDialog() {
  editingCard.value = null
  showDialog.value = true
}

function handleSelectCard(card: SkillCard) {
  editingCard.value = card
  showDialog.value = true
}

function closeDialog() {
  showDialog.value = false
  editingCard.value = null
}

async function handleCreate(dto: CreateSkillDTO) {
  await createCard(dto)
  closeDialog()
}

async function handleUpdate(id: string, dto: CreateSkillDTO) {
  await updateCard(id, dto)
  closeDialog()
}

function handleRate(rating: ReviewRating) {
  reviewQueue.rate(rating)
  const card = reviewQueue.currentCard.value
  if (card && rating === "remembered") {
    incrementPracticeCount(card.id)
  }
}
</script>

<style lang="scss" scoped>
.skill-learning-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--b3-theme-background, #fff);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    flex-shrink: 0;
  }

  &__tabs {
    display: flex;
    gap: 4px;
  }

  &__tab {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: rgba(99, 102, 241, 0.06);
      color: #6366f1;
    }

    &--active {
      background: rgba(99, 102, 241, 0.1);
      color: #6366f1;
    }
  }

  &__actions {
    display: flex;
    gap: 6px;
  }

  &__btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    border-radius: 6px;
    background: transparent;
    color: var(--b3-theme-on-background, #333);
    font-size: 16px;
    cursor: pointer;
    transition: all 0.15s;
    padding: 0;

    &:hover {
      border-color: #6366f1;
      color: #6366f1;
    }
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 12px;
  }

  &__footer {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    border-top: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    font-size: 11px;
    color: #94a3b8;
    flex-shrink: 0;
    font-feature-settings: "tnum";
    font-family: "Fira Code", "Cascadia Code", monospace;
  }
}
</style>
