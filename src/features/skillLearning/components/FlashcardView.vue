<template>
  <div class="flashcard-quiz">
    <!-- 空状态 -->
    <div v-if="quizItems.length === 0" class="flashcard-quiz__empty">
      {{ t.noCards || '暂无卡片' }}
    </div>

    <!-- 结果页 -->
    <template v-else-if="phase === 'result'">
      <div class="flashcard-quiz__result">
        <div class="flashcard-quiz__result-score">{{ correctCount }} / {{ quizItems.length }}</div>
        <div class="flashcard-quiz__result-label">{{ t.quizScore || '正确率' }}: {{ accuracy }}%</div>
        <div
          class="flashcard-quiz__result-emoji"
        >{{ accuracy >= 80 ? '🎉' : accuracy >= 50 ? '👍' : '💪' }}</div>

        <div class="flashcard-quiz__result-detail" v-if="detailExpanded">
          <div
            v-for="(item, qi) in quizItems"
            :key="item.card.id"
            class="flashcard-quiz__result-item"
            :class="{ 'flashcard-quiz__result-item--ok': item.isCorrect, 'flashcard-quiz__result-item--fail': !item.isCorrect }"
          >
            <span class="flashcard-quiz__result-mark">{{ item.isCorrect ? '✓' : '✗' }}</span>
            <span class="flashcard-quiz__result-title">{{ qi + 1 }}. {{ item.card.title }}</span>
          </div>
        </div>

        <div class="flashcard-quiz__result-actions">
          <button
            v-if="quizItems.length > 0"
            class="flashcard-quiz__result-detail-btn"
            @click="detailExpanded = !detailExpanded"
          >
            {{ detailExpanded ? (t.hideDetails || '收起详情') : (t.showDetails || '查看详情') }}
          </button>
          <button class="flashcard-quiz__btn flashcard-quiz__btn--primary" @click="resetQuiz">
            ↺ {{ t.retry || '重来' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 答题页 -->
    <template v-else>
      <!-- 进度条 -->
      <div class="flashcard-quiz__header">
        <div class="flashcard-quiz__progress-bar">
          <div
            class="flashcard-quiz__progress-fill"
            :style="{ width: ((currentIndex + (phase === 'feedback' ? 1 : 0)) / quizItems.length * 100) + '%' }"
          />
        </div>
        <span class="flashcard-quiz__counter">{{ currentIndex + 1 }} / {{ quizItems.length }}</span>
      </div>

      <!-- 当前题目 -->
      <div
        v-if="currentItem"
        class="flashcard-quiz__card"
        :class="{
          'flashcard-quiz__card--correct': phase === 'feedback' && currentItem.isCorrect,
          'flashcard-quiz__card--wrong': phase === 'feedback' && !currentItem.isCorrect,
        }"
      >
        <!-- 题目标题 -->
        <div class="flashcard-quiz__question">
          <div class="flashcard-quiz__q-body">
            <span class="flashcard-quiz__q-title">{{ currentItem.card.title }}</span>
            <div class="flashcard-quiz__q-meta">
              <span class="flashcard-quiz__lang-tag" :class="`lang--${currentItem.card.language}`">
                {{ langLabel(currentItem.card.language) }}
              </span>
              <DifficultyBadge :difficulty="currentItem.card.difficulty" :i18n="fullI18n" />
            </div>
          </div>
        </div>

        <!-- 选项 -->
        <div class="flashcard-quiz__options">
          <button
            v-for="(opt, oi) in currentItem.options"
            :key="oi"
            class="flashcard-quiz__option"
            :class="{
              'flashcard-quiz__option--correct-reveal': phase === 'feedback' && opt.correct,
              'flashcard-quiz__option--wrong-reveal': phase === 'feedback' && currentItem.selectedIndex === oi && !opt.correct,
            }"
            :disabled="phase === 'feedback'"
            @click="selectAnswer(oi)"
          >
            <span class="flashcard-quiz__option-letter">{{ optionLetter(oi) }}</span>
            <span class="flashcard-quiz__option-text">{{ opt.text || '(空)' }}</span>
            <span v-if="phase === 'feedback' && opt.correct" class="flashcard-quiz__option-icon">✓</span>
            <span v-else-if="phase === 'feedback' && currentItem.selectedIndex === oi && !opt.correct" class="flashcard-quiz__option-icon">✗</span>
          </button>
        </div>

        <!-- 答题后反馈区 -->
        <div v-if="phase === 'feedback'" class="flashcard-quiz__feedback-area">
          <div
            class="flashcard-quiz__feedback-banner"
            :class="currentItem.isCorrect ? 'flashcard-quiz__feedback-banner--ok' : 'flashcard-quiz__feedback-banner--fail'"
          >
            {{ currentItem.isCorrect ? '✓ ' + (t.correct || '正确') : '✗ ' + (t.incorrect || '错误') }}
          </div>

          <button
            v-if="currentItem.card.codeSnippet"
            class="flashcard-quiz__toggle-code"
            @click="showCode = !showCode"
          >
            {{ showCode ? (t.hideCode || '收起代码') : (t.viewCode || '查看代码') }}
          </button>

          <div v-if="showCode && currentItem.card.codeSnippet" class="flashcard-quiz__code-block">
            <pre><code>{{ currentItem.card.codeSnippet }}</code></pre>
          </div>

          <button class="flashcard-quiz__btn flashcard-quiz__btn--primary flashcard-quiz__btn--next" @click="goNext">
            {{ currentIndex < quizItems.length - 1 ? (t.nextQuestion || '下一题') + ' →' : (t.viewResult || '查看结果') }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue"
import type { SkillCard, SkillI18n } from "../types"
import DifficultyBadge from "./DifficultyBadge.vue"

interface CardOption {
  text: string
  correct: boolean
}
interface QuizItem {
  card: SkillCard
  options: CardOption[]
  selectedIndex: number | null
  isCorrect: boolean | null
}

const props = defineProps<{
  cards: SkillCard[]
  i18n: SkillI18n
}>()

const t = computed(() => props.i18n)
const fullI18n = computed<Required<SkillI18n>>(() => ({
  ...({
    beginner: "初级", intermediate: "中级", advanced: "高级",
    noCards: "暂无卡片", correct: "正确", incorrect: "错误",
    retry: "重来", viewCode: "查看代码", hideCode: "收起代码",
    nextQuestion: "下一题", viewResult: "查看结果",
    quizScore: "正确率", showDetails: "查看详情", hideDetails: "收起详情",
  } as Required<SkillI18n>),
  ...props.i18n,
}))

// --- 工具函数 ---
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildQuiz(cards: SkillCard[]): QuizItem[] {
  if (cards.length === 0) return []
  const allAnswers = cards.map((c) => ({ id: c.id, text: c.answer }))

  return cards.map((card) => {
    const correctOpt: CardOption = { text: card.answer, correct: true }
    let distractors: CardOption[] = []

    if (card.distractors && card.distractors.length > 0) {
      distractors = card.distractors
        .filter((d) => d.trim())
        .slice(0, 3)
        .map((d) => ({ text: d, correct: false }))
    } else {
      const sameLang = allAnswers.filter((a) => {
        const c = cards.find((x) => x.id === a.id)
        return a.id !== card.id && a.text && c?.language === card.language
      })
      const otherLang = allAnswers.filter((a) => {
        const c = cards.find((x) => x.id === a.id)
        return a.id !== card.id && a.text && c?.language !== card.language
      })
      let pool = [...shuffle(sameLang), ...shuffle(otherLang)]
      const seen = new Set<string>()
      pool = pool.filter((a) => {
        if (seen.has(a.text) || a.text === card.answer) return false
        seen.add(a.text)
        return true
      })
      distractors = pool.slice(0, 3).map((a) => ({ text: a.text, correct: false }))
    }

    while (distractors.length < 3) {
      distractors.push({ text: `——`, correct: false })
    }

    const options = shuffle([correctOpt, ...distractors])
    return { card, options, selectedIndex: null, isCorrect: null }
  })
}

// --- 状态 ---
const quizItems = ref<QuizItem[]>(buildQuiz(props.cards))
const currentIndex = ref(0)
// phase: 'question' | 'feedback' | 'result'
const phase = ref<"question" | "feedback" | "result">("question")
const showCode = ref(false)
const detailExpanded = ref(false)

const currentItem = computed(() => quizItems.value[currentIndex.value] ?? null)
const correctCount = computed(() => quizItems.value.filter((q) => q.isCorrect === true).length)
const accuracy = computed(() => {
  if (quizItems.value.length === 0) return 0
  return Math.round((correctCount.value / quizItems.value.length) * 100)
})

watch(() => props.cards, () => {
  quizItems.value = buildQuiz(props.cards)
  currentIndex.value = 0
  phase.value = "question"
}, { deep: true })

// --- 操作 ---
function selectAnswer(oi: number) {
  const item = quizItems.value[currentIndex.value]
  if (!item || item.selectedIndex !== null) return
  item.selectedIndex = oi
  item.isCorrect = item.options[oi].correct
  phase.value = "feedback"
}

function goNext() {
  showCode.value = false
  if (currentIndex.value < quizItems.value.length - 1) {
    currentIndex.value++
    phase.value = "question"
  } else {
    phase.value = "result"
  }
}

function resetQuiz() {
  quizItems.value = buildQuiz(props.cards)
  currentIndex.value = 0
  phase.value = "question"
  showCode.value = false
  detailExpanded.value = false
}

function optionLetter(i: number): string {
  return String.fromCharCode(65 + i)
}

function langLabel(lang: string): string {
  const map: Record<string, string> = {
    csharp: "C#", javascript: "JS", typescript: "TS", vue: "Vue",
  }
  return map[lang] || lang
}
</script>

<style lang="scss" scoped>
.flashcard-quiz {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px 0;

  &__empty {
    text-align: center;
    color: #94a3b8;
    padding: 80px 20px;
    font-size: 14px;
  }

  // ---- 进度条 ----
  &__header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    padding: 4px 0 8px;
  }

  &__progress-bar {
    flex: 1;
    height: 4px;
    background: rgba(99, 102, 241, 0.12);
    border-radius: 2px;
    overflow: hidden;
  }

  &__progress-fill {
    height: 100%;
    background: #6366f1;
    border-radius: 2px;
    transition: width 0.35s ease;
  }

  &__counter {
    font-size: 12px;
    color: #94a3b8;
    font-feature-settings: "tnum";
    font-family: "Fira Code", "Cascadia Code", monospace;
    flex-shrink: 0;
  }

  // ---- 卡片 ----
  &__card {
    flex: 1;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    border-radius: 12px;
    padding: 20px;
    background: var(--b3-theme-background, #fff);
    overflow-y: auto;
    transition: border-color 0.2s;

    &--correct { border-color: #22c55e; }
    &--wrong   { border-color: #ef4444; }
  }

  // ---- 题目 ----
  &__q-body {
    margin-bottom: 16px;
  }

  &__q-title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.6;
    color: var(--b3-theme-on-background, #1e293b);
    display: block;
    font-family: "Fira Code", "Cascadia Code", monospace;
  }

  &__q-meta {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 8px;
  }

  &__lang-tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 3px;
    color: #fff;
    &.lang--csharp     { background: #a855f7; }
    &.lang--javascript { background: #f59e0b; }
    &.lang--typescript { background: #3b82f6; }
    &.lang--vue        { background: #10b981; }
    &.lang--other      { background: #94a3b8; }
  }

  // ---- 选项 ----
  &__options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  &__option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    border-radius: 10px;
    background: var(--b3-theme-background, #f8fafc);
    cursor: pointer;
    text-align: left;
    font-size: 13px;
    color: var(--b3-theme-on-background, #333);
    transition: all 0.15s;
    &:hover:not(:disabled) {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.05);
    }
    &:disabled { cursor: default; }

    &--correct-reveal {
      border-color: #22c55e;
      background: rgba(34, 197, 94, 0.08);
      color: #16a34a;
    }
    &--wrong-reveal {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.08);
      color: #dc2626;
    }
  }

  &__option-letter {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.1);
    color: #6366f1;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  &__option-text {
    flex: 1;
    line-height: 1.5;
  }

  &__option-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  // ---- 反馈区 ----
  &__feedback-area {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
  }

  &__feedback-banner {
    font-size: 14px;
    font-weight: 600;
    padding: 10px 14px;
    border-radius: 8px;

    &--ok {
      background: rgba(34, 197, 94, 0.08);
      color: #16a34a;
    }
    &--fail {
      background: rgba(239, 68, 68, 0.08);
      color: #dc2626;
    }
  }

  &__toggle-code {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: #6366f1;
    font-size: 12px;
    cursor: pointer;
    padding: 4px 0;
    &:hover { text-decoration: underline; }
  }

  &__code-block {
    background: #1e293b;
    border-radius: 8px;
    padding: 12px 14px;
    overflow-x: auto;
    max-height: 200px;
    overflow-y: auto;
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

  // ---- 按钮 ----
  &__btn {
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.15s;

    &--primary {
      background: #6366f1;
      color: #fff;
      &:hover { background: #4f46e5; }
    }

    &--next {
      align-self: center;
      margin-top: 4px;
    }
  }

  // ---- 结果页 ----
  &__result {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  &__result-score {
    font-size: 36px;
    font-weight: 700;
    color: #6366f1;
    font-feature-settings: "tnum";
    font-family: "Fira Code", "Cascadia Code", monospace;
  }

  &__result-label {
    font-size: 14px;
    color: #64748b;
  }

  &__result-emoji {
    font-size: 40px;
    margin: 4px 0;
  }

  &__result-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }

  &__result-detail-btn {
    padding: 8px 16px;
    border: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    border-radius: 8px;
    background: transparent;
    color: #64748b;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    &:hover { border-color: #6366f1; color: #6366f1; }
  }

  &__result-detail {
    width: 100%;
    max-height: 200px;
    overflow-y: auto;
    margin-top: 12px;
    border-top: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    padding-top: 8px;
  }

  &__result-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 8px;
    font-size: 12px;
    line-height: 1.5;
    border-radius: 6px;

    &--ok { color: #16a34a; }
    &--fail { color: #dc2626; }
  }

  &__result-mark {
    flex-shrink: 0;
    font-weight: 700;
    margin-top: 1px;
  }

  &__result-title {
    word-break: break-word;
  }
}
</style>
