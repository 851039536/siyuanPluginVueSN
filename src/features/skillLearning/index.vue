<!-- 技能学习 - 主面板（Dock 容器），Tab 切换 4 个子视图 -->
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
        <button
          class="skill-learning-panel__btn"
          :title="t.addCard"
          @click="openAddDialog"
        >
          +
        </button>
      </div>
    </div>

    <!-- 视图内容 -->
    <div class="skill-learning-panel__content">
      <KeepAlive>
        <SkillListView
          v-if="viewMode === 'list'"
          :cards="cards"
          :i18n="fullI18n"
          @select="handleSelectCard"
          @delete="handleDeleteCard"
        />
        <FlashcardView
          v-else-if="viewMode === 'flashcard'"
          :cards="cards"
          :i18n="fullI18n"
          @practice="handlePractice"
        />
        <ReviewView
          v-else-if="viewMode === 'review'"
          :cards="cards"
          :i18n="fullI18n"
          @rate="handleRate"
        />
        <StatsView
          v-else-if="viewMode === 'stats'"
          :cards="cards"
          :i18n="fullI18n"
        />
      </KeepAlive>
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
      :plugin="plugin"
      :editCard="editingCard"
      @save="handleCreate"
      @update="handleUpdate"
      @close="closeDialog"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  CreateSkillDTO,
  ReviewData,
  ReviewRating,
  SkillCard,
  SkillI18n,
  ViewMode,
} from "./types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import FlashcardView from "./components/FlashcardView.vue"
import ReviewView from "./components/ReviewView.vue"
import SkillDialog from "./components/SkillDialog.vue"
import SkillListView from "./components/SkillListView.vue"
import StatsView from "./components/StatsView.vue"
import { useCardStats } from "./composables/useCardStats"
import { useI18n } from "./composables/useI18n"
import { useSkillStorage } from "./composables/useSkillStorage"
import { PRESET_CARDS } from "./data/presetData"

const props = defineProps<{
  i18n: SkillI18n | undefined
  plugin: Plugin
}>()

const t = computed(() => fullI18n.value as Record<string, string>)
const fullI18n = useI18n(props.i18n)
const {
  cards,
  loadCards,
  createCard,
  updateCard,
  deleteCard,
  incrementPracticeWithAccuracy,
  updateReviewAndPractice,
  storage,
} =
  useSkillStorage(props.plugin)

const { practicedCount } = useCardStats(cards)

const viewMode = ref<ViewMode>("list")
const showDialog = ref(false)
const editingCard = ref<SkillCard | null>(null)

const tabs = computed(() => [
  {
    id: "list" as ViewMode,
    label: fullI18n.value.listView || "列表",
  },
  {
    id: "flashcard" as ViewMode,
    label: fullI18n.value.flashcardView || "闪卡",
  },
  {
    id: "review" as ViewMode,
    label: fullI18n.value.reviewView || "复习",
  },
  {
    id: "stats" as ViewMode,
    label: fullI18n.value.statsView || "统计",
  },
])

onMounted(async () => {
  await loadCards()
  const presetLoaded = await storage.isPresetLoaded()
  if (!presetLoaded) {
    // 先标记再插入，防止标记保存失败导致后续重复插入
    await storage.markPresetLoaded()
    // 额外保护：如果已有卡片则不重复插入（如标记位异常但数据已存在）
    if (cards.value.length === 0) {
      await storage.bulkCreate(PRESET_CARDS)
      await loadCards()
      console.log(fullI18n.value.presetDataLoaded)
    }
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

async function handleDeleteCard(cardId: string) {
  if (!confirm(fullI18n.value.confirmDelete || "确定要删除这张卡片吗？")) return
  const ok = await deleteCard(cardId)
  if (ok) {
    console.log(fullI18n.value.deleteSuccess || "卡片已删除")
  }
}

async function handlePractice(cardId: string, isCorrect: boolean) {
  await incrementPracticeWithAccuracy(cardId, isCorrect)
}

async function handleRate(cardId: string, rating: ReviewRating, data: ReviewData) {
  const isCorrect = rating === "remembered"
  await updateReviewAndPractice(cardId, data, isCorrect)
}
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
