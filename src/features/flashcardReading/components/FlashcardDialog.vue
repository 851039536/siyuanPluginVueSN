<!-- 单词阅读功能 - 弹窗式快速浏览 -->
<template>
  <div class="flashcard-dialog">
    <Button
      variant="ghost"
      size="xsmall"
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
      <p>{{ t.noCards }}</p>
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
        <label>{{ t.category }}:</label>
        <Select
          v-model="selectedCategory"
          :options="categoryOptions"
          size="small"
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
import {
  computed,
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import { useFlashcardStorage } from "../composables/useFlashcardStorage"
import { useI18n } from "../composables/useI18n"
import { usePlayWord } from "../composables/usePlayWord"
import { copyAndNotify } from "../utils"
import SingleCardView from "./SingleCardView.vue"

interface Props {
  i18n: I18n
  plugin: Plugin
}

const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'close'): void }>()

const t = useI18n(props.i18n)
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

const currentIndex = ref(0)
const currentCard = computed(() =>
  filteredCards.value[currentIndex.value] ?? null,
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

const previousCard = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    playWord(currentCard.value)
  }
}

const nextCard = () => {
  if (currentIndex.value < filteredCards.value.length - 1) {
    currentIndex.value++
    playWord(currentCard.value)
  }
}

const randomCard = () => {
  if (filteredCards.value.length <= 1) return
  let newIndex: number
  do {
    newIndex = Math.floor(Math.random() * filteredCards.value.length)
  } while (newIndex === currentIndex.value && filteredCards.value.length > 1)
  currentIndex.value = newIndex
  playWord(currentCard.value)
}

const handleCopy = async (text?: string) => {
  await copyAndNotify(text || "", "已复制")
}

onMounted(() => {
  loadCards()
})
</script>

<style scoped lang="scss">
@use '../styles/FlashcardDialog.scss';
@use '../styles/index.scss';
</style>
