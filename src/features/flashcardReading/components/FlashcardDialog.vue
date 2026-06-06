<template>
  <div class="flashcard-dialog">
    <Button
      variant="ghost"
      size="small"
      icon="close"
      class="close-btn"
      @click="emit('close')"
    />

    <div
      v-if="filteredCards.length === 0"
      class="empty-state"
    >
      <IconWrapper
        name="file"
        :size="64"
      />
      <p>{{ i18n.noCards || '暂无卡片' }}</p>
    </div>

    <template v-else>
      <SingleCardView
        :currentCard="currentCard"
        :currentIndex="currentIndex"
        :totalCards="filteredCards.length"
        :i18n="i18n"
        hideNavigation
        hideActions
        @play="(card) => playWord(card)"
        @copyTitle="(card) => handleCopy(card?.title)"
        @copyContent="(card) => handleCopy(card?.content)"
      />

      <div class="category-filter">
        <label>{{ i18n.category || '类别' }}:</label>
        <Select
          v-model="selectedCategory"
          :options="categoryOptions"
          @change="currentIndex = 0"
        />
      </div>

      <div class="card-navigation">
        <Button
          variant="ghost"
          icon="chevronLeft"
          :disabled="currentIndex === 0"
          @click="previousCard"
        />
        <Button
          variant="ghost"
          icon="shuffle"
          @click="randomCard"
        />
        <span class="card-counter">
          {{ currentIndex + 1 }} / {{ filteredCards.length }}
        </span>
        <Button
          variant="ghost"
          icon="chevronRight"
          :disabled="currentIndex === filteredCards.length - 1"
          @click="nextCard"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { I18n } from "../types"
import type { SelectOption } from "@/components/Select.vue"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import { useCardNavigation } from "../composables/useCardNavigation"
import { useFlashcardStorage } from "../composables/useFlashcardStorage"
import { usePlayWord } from "../composables/usePlayWord"
import SingleCardView from "./SingleCardView.vue"

interface Props {
  i18n: I18n
  plugin: Plugin
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'close'): void }>()

const selectedCategory = ref<string>("all")

const {
  storage,
  cards,
  categories,
  loadCards,
} = useFlashcardStorage(props.plugin)
const { playWord } = usePlayWord(storage, cards, props.i18n)

const filteredCards = computed(() => {
  if (selectedCategory.value === "all") return cards.value
  return cards.value.filter((card) => card.category === selectedCategory.value)
})

const {
  currentIndex,
  currentCard,
  previous,
  next,
  random,
} = useCardNavigation(filteredCards)

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

const handleCopy = async (text?: string) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    showMessage("已复制", 2000, "info")
  } catch {
    showMessage("复制失败", 2000, "error")
  }
}

onMounted(() => {
  loadCards()
})
</script>

<style scoped lang="scss">
@use '../styles/index.scss' as *;

.flashcard-dialog {
  width: 100%;
  max-height: 85vh;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;

  .close-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1;
  }
}

.card-counter {
  font-size: 13px;
  font-weight: 600;
  font-family: $fc-mono;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  min-width: 60px;
  text-align: center;
}
</style>
