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
        <button class="skill-learning-panel__btn" @click="showImport = true" :title="fullI18n.importCards">
          ⇧
        </button>
        <button class="skill-learning-panel__btn" @click="openAddDialog" :title="t.addCard">
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

    <!-- 批量导入弹窗 -->
    <ImportDialog
      v-if="showImport"
      :i18n="fullI18n"
      @import="handleBulkImport"
      @close="showImport = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue"
import type { Plugin } from "siyuan"
import type { SkillCard, SkillI18n, ViewMode, CreateSkillDTO, ReviewRating, ReviewData } from "./types"
import { useSkillStorage } from "./composables/useSkillStorage"
import { useI18n } from "./composables/useI18n"
import { PRESET_CARDS } from "./data/presetData"
import SkillListView from "./components/SkillListView.vue"
import FlashcardView from "./components/FlashcardView.vue"
import SkillDialog from "./components/SkillDialog.vue"
import ReviewView from "./components/ReviewView.vue"
import ImportDialog from "./components/ImportDialog.vue"
import StatsView from "./components/StatsView.vue"

const props = defineProps<{
  i18n: SkillI18n | undefined
  plugin: Plugin
}>()

const t = computed(() => fullI18n.value as Record<string, string>)
const fullI18n = useI18n(props.i18n)
const { cards, loadCards, createCard, updateCard, deleteCard, incrementPracticeCount, updateReviewData, storage } =
  useSkillStorage(props.plugin)

const viewMode = ref<ViewMode>("list")
const showDialog = ref(false)
const showImport = ref(false)
const editingCard = ref<SkillCard | null>(null)

const practicedCount = computed(() => cards.value.filter((c) => c.practiceCount > 0).length)

const tabs = computed(() => [
  { id: "list" as ViewMode, label: fullI18n.value.listView || "列表" },
  { id: "flashcard" as ViewMode, label: fullI18n.value.flashcardView || "闪卡" },
  { id: "review" as ViewMode, label: fullI18n.value.reviewView || "复习" },
  { id: "stats" as ViewMode, label: fullI18n.value.statsView || "统计" },
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

async function handlePractice(cardId: string) {
  await incrementPracticeCount(cardId)
}

async function handleRate(cardId: string, _rating: ReviewRating, data: ReviewData) {
  await updateReviewData(cardId, data)
  await incrementPracticeCount(cardId)
}

async function handleBulkImport(dtos: CreateSkillDTO[]) {
  await storage.bulkCreate(dtos)
  await loadCards()
  showImport.value = false
}
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
