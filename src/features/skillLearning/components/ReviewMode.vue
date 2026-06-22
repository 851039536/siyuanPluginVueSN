<template>
  <div class="review-mode">
    <div v-if="cards.length === 0" class="review-mode__empty">
      {{ t.noCards }}
    </div>
    <template v-else>
      <!-- 进度条 -->
      <div class="review-mode__progress-bar">
        <div class="review-mode__progress-fill" :style="{ width: progressPct + '%' }" />
      </div>
      <div class="review-mode__progress-text">
        {{ reviewed }} / {{ totalCount }}
      </div>

      <!-- 完成状态 -->
      <div v-if="roundComplete" class="review-mode__complete">
        <div class="review-mode__complete-icon">🎉</div>
        <p>{{ t.reviewComplete }}</p>
        <button class="review-mode__restart-btn" @click="restart">
          ↺ {{ t.retry || '重来' }}
        </button>
      </div>

      <!-- 复习中 -->
      <template v-else-if="currentCard">
        <div
          class="review-mode__card"
          :class="{ 'review-mode__card--flipped': isFlipped }"
          @click="flip"
        >
          <div class="review-mode__card-inner">
            <div class="review-mode__front">
              <div class="review-mode__front-title">{{ currentCard.title }}</div>
              <div class="review-mode__front-meta">
                <span class="review-mode__lang" :class="`lang--${currentCard.language}`">
                  {{ langLabel(currentCard.language) }}
                </span>
                <DifficultyBadge :difficulty="currentCard.difficulty" :i18n="fullI18n" />
              </div>
              <div class="review-mode__flip-hint">点击翻转查看答案</div>
            </div>

            <div class="review-mode__back">
              <div class="review-mode__back-answer">{{ currentCard.answer }}</div>
              <div v-if="currentCard.codeSnippet" class="review-mode__code-block">
                <pre><code>{{ currentCard.codeSnippet }}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 评分按钮 -->
        <div v-if="isFlipped" class="review-mode__actions">
          <button
            class="review-mode__rate-btn review-mode__rate-btn--remembered"
            @click="handleRate('remembered')"
          >
            👍 {{ t.remembered }}
          </button>
          <button
            class="review-mode__rate-btn review-mode__rate-btn--fuzzy"
            @click="handleRate('fuzzy')"
          >
            🤔 {{ t.fuzzy }}
          </button>
          <button
            class="review-mode__rate-btn review-mode__rate-btn--forgot"
            @click="handleRate('forgot')"
          >
            😰 {{ t.forgot }}
          </button>
        </div>
      </template>

      <!-- 加载中 -->
      <div v-else class="review-mode__loading">
        {{ t.noReviewCards || '正在加载...' }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { SkillCard, SkillI18n, ReviewRating } from "../types"
import DifficultyBadge from "./DifficultyBadge.vue"

const props = defineProps<{
  cards: SkillCard[]
  currentCard: SkillCard | undefined
  currentIndex: number
  isFlipped: boolean
  roundComplete: boolean
  totalCount: number
  reviewed: number
  i18n: SkillI18n
}>()

const emit = defineEmits<{
  flip: []
  rate: [rating: ReviewRating]
  restart: []
}>()

const t = computed(() => props.i18n)

const fullI18n = computed<Required<SkillI18n>>(() => ({
  ...({ beginner: "初级", intermediate: "中级", advanced: "高级" } as Required<SkillI18n>),
  ...props.i18n,
}))

const progressPct = computed(() =>
  props.totalCount > 0 ? Math.round((props.reviewed / props.totalCount) * 100) : 0,
)

function flip() {
  emit("flip")
}

function handleRate(rating: ReviewRating) {
  emit("rate", rating)
}

function restart() {
  emit("restart")
}

function langLabel(lang: string): string {
  const map: Record<string, string> = {
    csharp: "C#",
    javascript: "JS",
    typescript: "TS",
    vue: "Vue",
  }
  return map[lang] || lang
}
</script>

<style lang="scss" scoped>
.review-mode {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 10px;
  padding: 8px 0;

  &__empty,
  &__loading {
    text-align: center;
    color: #94a3b8;
    padding: 60px 20px;
    font-size: 14px;
  }

  &__progress-bar {
    width: 100%;
    height: 4px;
    background: var(--b3-theme-surface-lighter, #e2e8f0);
    border-radius: 2px;
    overflow: hidden;
  }

  &__progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #818cf8);
    border-radius: 2px;
    transition: width 0.3s;
  }

  &__progress-text {
    text-align: center;
    font-size: 11px;
    color: #94a3b8;
    font-feature-settings: "tnum";
    font-family: "Fira Code", "Cascadia Code", monospace;
  }

  &__complete {
    text-align: center;
    padding: 40px 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    &-icon { font-size: 48px; margin-bottom: 12px; }
    p { font-size: 16px; font-weight: 600; color: var(--b3-theme-on-background, #333); margin: 0 0 16px; }
  }

  &__restart-btn {
    padding: 10px 28px;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    &:hover { background: #4f46e5; }
  }

  &__card {
    perspective: 1000px;
    cursor: pointer;
    flex: 1;
  }

  &__card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 280px;
    transition: transform 0.6s;
    transform-style: preserve-3d;
  }

  &__card--flipped &__card-inner {
    transform: rotateY(180deg);
  }

  &__front, &__back {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: 12px;
    border: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    padding: 24px;
    box-sizing: border-box;
    overflow-y: auto;
  }

  &__front {
    background: var(--b3-theme-background, #f8fafc);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  &__front-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background, #1e293b);
    line-height: 1.5;
    margin-bottom: 16px;
    font-family: "Fira Code", "Cascadia Code", monospace;
  }

  &__front-meta {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__lang {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 4px;
    color: #fff;
    &.lang--csharp { background: #a855f7; }
    &.lang--javascript { background: #f59e0b; }
    &.lang--typescript { background: #3b82f6; }
    &.lang--vue { background: #10b981; }
    &.lang--other { background: #94a3b8; }
  }

  &__flip-hint {
    margin-top: 20px;
    font-size: 11px;
    color: #94a3b8;
  }

  &__back {
    background: var(--b3-theme-background, #fff);
    transform: rotateY(180deg);
    display: flex;
    flex-direction: column;
  }

  &__back-answer {
    font-size: 14px;
    line-height: 1.7;
    color: var(--b3-theme-on-background, #333);
    margin-bottom: 16px;
  }

  &__code-block {
    background: #1e293b;
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    pre { margin: 0; }
    code {
      font-family: "Fira Code", "Cascadia Code", monospace;
      font-size: 12px;
      line-height: 1.7;
      color: #e2e8f0;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  &__rate-btn {
    flex: 1;
    padding: 10px 8px;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;

    &--remembered {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.3);
      &:hover { background: rgba(34, 197, 94, 0.2); }
    }
    &--fuzzy {
      background: rgba(234, 179, 8, 0.1);
      color: #eab308;
      border: 1px solid rgba(234, 179, 8, 0.3);
      &:hover { background: rgba(234, 179, 8, 0.2); }
    }
    &--forgot {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
      &:hover { background: rgba(239, 68, 68, 0.2); }
    }
  }
}
</style>
