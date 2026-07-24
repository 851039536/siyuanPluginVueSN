<!-- 技能学习 - SM-2 间隔重复复习视图 -->
<template>
  <div class="review-view">
    <!-- 空状态：没有卡片 -->
    <div
      v-if="cards.length === 0"
      class="review-view__empty"
    >
      {{ t.noCards }}
    </div>

    <!-- 全部复习完成 -->
    <div
      v-else-if="allReviewed"
      class="review-view__complete"
    >
      <IconWrapper
        name="mdi:check-circle-outline"
        class="review-view__complete-icon"
      />
      <div class="review-view__complete-text">
        {{ t.reviewComplete }}
      </div>
      <div class="review-view__complete-sub">
        {{ t.nextReviewHint || '下一轮复习将在卡片到期后自动出现' }}
      </div>
    </div>

    <!-- 复习中 -->
    <template v-else-if="currentCard">
      <!-- 进度条 -->
      <div class="review-view__header">
        <div class="review-view__progress-bar">
          <div
            class="review-view__progress-fill"
            :style="{ width: `${(queueIndex + 1) / queue.length * 100}%` }"
          />
        </div>
        <span class="review-view__counter">{{ queueIndex + 1 }} / {{ queue.length }}</span>
      </div>

      <!-- 卡片 -->
      <div
        class="review-view__card"
        :class="{ 'review-view__card--flipped': flipped }"
        @click="flip"
      >
        <!-- 正面：题目 -->
        <div class="review-view__front">
          <div class="review-view__q-title">
            {{ currentCard.title }}
          </div>
          <div class="review-view__q-meta">
            <span
              class="review-view__lang-tag"
              :class="`lang--${currentCard.language}`"
            >
              {{ langLabel(currentCard.language) }}
            </span>
            <DifficultyBadge
              :difficulty="currentCard.difficulty"
              :i18n="t"
            />
            <span class="review-view__category-tag">{{ currentCard.category }}</span>
          </div>
          <div class="review-view__flip-hint">
            {{ t.tapToReveal || '点击卡片查看答案' }}
          </div>
        </div>

        <!-- 背面：答案 -->
        <div class="review-view__back">
          <div class="review-view__a-label">
            {{ t.answer }}
          </div>
          <div class="review-view__a-text">
            {{ currentCard.answer }}
          </div>
          <div
            v-if="currentCard.codeSnippet"
            class="review-view__code-block"
          >
            <pre><code>{{ currentCard.codeSnippet }}</code></pre>
          </div>
        </div>
      </div>

      <!-- 评分按钮（只在翻转后显示） -->
      <div
        v-if="flipped"
        class="review-view__ratings"
      >
        <button
          class="review-view__rating review-view__rating--forgot"
          @click="rate('forgot')"
        >
          <IconWrapper
            name="close"
            class="review-view__rating-icon"
          />
          <span class="review-view__rating-label">{{ t.forgot }}</span>
          <span class="review-view__rating-hint">{{ t.forgotHint || '1天后重来' }}</span>
        </button>
        <button
          class="review-view__rating review-view__rating--fuzzy"
          @click="rate('fuzzy')"
        >
          <span class="review-view__rating-icon">~</span>
          <span class="review-view__rating-label">{{ t.fuzzy }}</span>
          <span class="review-view__rating-hint">{{ fuzzyHint }}</span>
        </button>
        <button
          class="review-view__rating review-view__rating--remembered"
          @click="rate('remembered')"
        >
          <IconWrapper
            name="check"
            class="review-view__rating-icon"
          />
          <span class="review-view__rating-label">{{ t.remembered }}</span>
          <span class="review-view__rating-hint">{{ rememberedHint }}</span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  ReviewData,
  ReviewRating,
  SkillCard,
  SkillI18n,
} from "../types"
import {
  computed,
  onActivated,
  onDeactivated,
  ref,

} from "vue"

import IconWrapper from "@/components/IconWrapper.vue"
import { langLabel } from "../composables/useLangLabel"
import {
  calcNextReview,
  useReviewQueue,
} from "../composables/useReviewQueue"

import DifficultyBadge from "./DifficultyBadge.vue"

const props = defineProps<{
  cards: SkillCard[]
  i18n: SkillI18n
}>()

const emit = defineEmits<{
  rate: [cardId: string, rating: ReviewRating, data: ReviewData]
}>()

const t = computed(() => props.i18n)
const cardsRef = computed(() => props.cards)

const {
  dueCards,
  allReviewed,
} = useReviewQueue(cardsRef)
const queue = computed(() => dueCards.value)
const queueIndex = ref(0)
const flipped = ref(false)

const currentCard = computed(() => queue.value[queueIndex.value] ?? null)

/** 预览下次复习间隔 */
const nextReviewPreview = (rating: ReviewRating): ReviewData =>
  calcNextReview(rating, currentCard.value?.reviewData)

const fuzzyHint = computed(() => {
  const d = nextReviewPreview("fuzzy")
  return formatInterval(d.interval)
})
const rememberedHint = computed(() => {
  const d = nextReviewPreview("remembered")
  return formatInterval(d.interval)
})

function formatInterval(days: number): string {
  if (days < 1) return `< 1天`
  if (days === 1) return "1天后"
  if (days < 30) return `${days}天后`
  const months = Math.round(days / 30)
  return `${months}个月后`
}

function flip() {
  flipped.value = !flipped.value
}

function rate(rating: ReviewRating) {
  const card = currentCard.value
  if (!card) return
  const data = calcNextReview(rating, card.reviewData)
  emit("rate", card.id, rating, data)

  // 移到下一张卡片
  if (queueIndex.value < queue.value.length - 1) {
    queueIndex.value++
    flipped.value = false
  } else {
    // 本轮完成
    queueIndex.value = 0
    flipped.value = false
  }
}

// --- 键盘快捷键 ---
function onKeydown(e: KeyboardEvent) {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault()
    if (!flipped.value) {
      flip()
    }
    return
  }
  if (flipped.value) {
    if (e.key === "1") rate("forgot")
    else if (e.key === "2") rate("fuzzy")
    else if (e.key === "3") rate("remembered")
  }
}
onActivated(() => window.addEventListener("keydown", onKeydown))
onDeactivated(() => window.removeEventListener("keydown", onKeydown))
</script>

<style lang="scss" scoped>
@use "../styles/ReviewView.scss";
</style>
