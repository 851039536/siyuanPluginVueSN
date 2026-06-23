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
        <IconWrapper
          :name="accuracy >= 80 ? 'mdi:trophy-outline' : accuracy >= 50 ? 'mdi:thumb-up-outline' : 'mdi:arm-flex-outline'"
          class="flashcard-quiz__result-icon"
        />

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
              <DifficultyBadge :difficulty="currentItem.card.difficulty" :i18n="t" />
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
            <span class="flashcard-quiz__option-text">{{ opt.text || t.emptyOption }}</span>
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
import { ref, computed, watch, onActivated, onDeactivated } from "vue"
import type { SkillCard, SkillI18n } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"
import DifficultyBadge from "./DifficultyBadge.vue"
import { langLabel } from "../composables/useLangLabel"

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

const emit = defineEmits<{
  practice: [cardId: string]
}>()

const t = computed(() => props.i18n)

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

  // 1. 随机打乱卡片顺序
  const shuffled = shuffle([...cards])

  // 2. 预建按语言分组的答案池（避免 O(n²) 嵌套查找）
  const answersByLang = new Map<string, { id: string; text: string }[]>()
  for (const c of shuffled) {
    if (c.answer && c.answer.trim()) {
      if (!answersByLang.has(c.language)) answersByLang.set(c.language, [])
      answersByLang.get(c.language)!.push({ id: c.id, text: c.answer })
    }
  }

  // 所有答案的平铺池（跨语言回退）
  const allPool = [...answersByLang.values()].flat()

  return shuffled.map((card) => {
    const correctOpt: CardOption = { text: card.answer, correct: true }
    let distractors: CardOption[] = []

    // 优先使用手动指定的干扰项
    if (card.distractors && card.distractors.length > 0) {
      distractors = card.distractors
        .filter(Boolean)
        .slice(0, 3)
        .map((d) => ({ text: d.trim(), correct: false }))
    } else {
      // 从同语言池中抽取 + 跨语言池补充
      const sameLang = (answersByLang.get(card.language) || [])
        .filter((a) => a.id !== card.id)
      const rest = allPool.filter((a) => a.id !== card.id && !sameLang.some((s) => s.id === a.id))

      const pool = [...shuffle(sameLang), ...shuffle(rest)]
      const seen = new Set<string>()
      pool.forEach((a) => {
        if (distractors.length >= 3) return
        if (!seen.has(a.text) && a.text !== card.answer) {
          seen.add(a.text)
          distractors.push({ text: a.text, correct: false })
        }
      })
    }

    // 不够 3 个时用占位补足
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

// 仅卡片数量变化时重置测验（新增/删除），单个卡片内容更新不影响进行中的测验
watch(() => props.cards.length, () => {
  quizItems.value = buildQuiz(props.cards)
  currentIndex.value = 0
  phase.value = "question"
})

// --- 操作 ---
function selectAnswer(oi: number) {
  const item = quizItems.value[currentIndex.value]
  if (!item || item.selectedIndex !== null) return
  item.selectedIndex = oi
  item.isCorrect = item.options[oi].correct
  phase.value = "feedback"
  // 记录练习（无论对错都计数）
  emit("practice", item.card.id)
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

// --- 键盘快捷键 ---
function onKeydown(e: KeyboardEvent) {
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault()
    if (phase.value === "feedback") {
      goNext()
    } else if (phase.value === "result") {
      resetQuiz()
    }
  }
  // A/B/C/D 快速选择（仅在 question 阶段）
  const quiz = currentItem.value
  if (phase.value === "question" && quiz) {
    const key = e.key.toUpperCase()
    const idx = key.charCodeAt(0) - 65
    if (idx >= 0 && idx < quiz.options.length) {
      e.preventDefault()
      selectAnswer(idx)
    }
  }
}

onActivated(() => {
  window.addEventListener("keydown", onKeydown)
})
onDeactivated(() => {
  window.removeEventListener("keydown", onKeydown)
})

</script>

<style lang="scss" scoped>
@use "../styles/FlashcardView.scss";
</style>
