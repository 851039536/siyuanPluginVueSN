<!-- 单词阅读功能 - 打字练习组件 -->
<template>
  <div class="typing-practice">
    <div class="typing-controls">
      <div class="typing-controls__options">
        <button
          class="typing-case-toggle"
          :class="{ 'typing-case-toggle--active': caseInsensitive }"
          :title="caseInsensitive ? t.typingTitleCaseInsensitive : t.typingTitleCaseSensitive"
          @click="emit('update:caseInsensitive', !caseInsensitive)"
        >
          <span class="typing-case-toggle__label">Aa</span>
          <span class="typing-case-toggle__text">
            {{ caseInsensitive ? t.caseInsensitive : t.caseSensitive }}
          </span>
        </button>
        <button
          class="typing-case-toggle"
          :class="{ 'typing-case-toggle--active': instantReset }"
          :title="instantReset ? '当前：输错立即重试' : '当前：输错稍后重试'"
          @click="emit('update:instantReset', !instantReset)"
        >
          <IconWrapper
            name="refresh"
            :size="14"
            class="typing-case-toggle__icon"
          />
          <span class="typing-case-toggle__text">
            {{ instantReset ? t.instantReset : t.delayedReset }}
          </span>
        </button>
        <button
          class="typing-case-toggle"
          :class="{ 'typing-case-toggle--active': coverMode }"
          :title="coverMode ? t.typingTitleCoverMode : t.typingTitleRevealMode"
          @click="emit('update:coverMode', !coverMode)"
        >
          <IconWrapper
            :name="coverMode ? 'eyeOff' : 'eye'"
            :size="14"
            class="typing-case-toggle__icon"
          />
          <span class="typing-case-toggle__text">
            {{ coverMode ? t.coverMode : t.revealMode }}
          </span>
        </button>
        <button
          class="typing-case-toggle"
          :class="{ 'typing-case-toggle--active': timerEnabled }"
          :title="timerEnabled ? t.typingTitleTimerOn : t.typingTitleTimerOff"
          @click="emit('update:timerEnabled', !timerEnabled)"
        >
          <IconWrapper
            name="timerOutline"
            :size="14"
            class="typing-case-toggle__icon"
          />
          <span class="typing-case-toggle__text">
            {{ timerEnabled ? '计时' : '计时关' }}
          </span>
        </button>
      </div>
      <div class="typing-controls__config">
        <span class="typing-session-config__label">{{ t.sessionSizeLabel }}</span>
        <button
          class="typing-session-config__btn"
          @click="changeSessionSize(-5)"
        >
          −
        </button>
        <span class="typing-session-config__value">{{ sessionSize }}</span>
        <button
          class="typing-session-config__btn"
          @click="changeSessionSize(5)"
        >
          +
        </button>
        <span class="typing-session-config__unit">{{ t.typingCardUnit }}</span>
      </div>
    </div>

    <div class="typing-area">
      <div class="typing-hint">
        {{ t.typeTheWord }}:
      </div>

      <div class="typing-target">
        <span
          v-for="(char, i) in targetChars"
          :key="i"
          class="typing-char"
          :class="charClass(i)"
        >{{ coverMode && typedWord.length <= i ? '_' : char }}</span>
      </div>

      <div
        v-if="currentCard"
        class="typing-reference"
      >
        <p class="typing-reference__content">{{ currentCard.content }}</p>
        <div class="typing-reference__footer">
          <span class="typing-reference__meta">
            <span class="tag tag-small tag-info">{{ currentCard.category }}</span>
            <span class="tag tag-small tag-contrast">{{ t.practiceCount }}: {{ currentCard.practiceCount || 0 }}</span>
          </span>
          <Button
            variant="ghost"
            size="xsmall"
            icon="play"
            :iconSize="12"
            :title="t.play"
            @click="$emit('play', currentCard)"
          />
        </div>
      </div>

      <div class="typing-input-wrapper">
        <input
          ref="inputEl"
          v-model="typedWord"
          class="typing-input"
          :placeholder="typingPlaceholder"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          @keydown="handleKeydown"
          @focus="onFocus"
          @blur="onBlur"
        />
      </div>

      <div
        v-if="resultState !== 'idle'"
        class="typing-result"
        :class="`typing-result--${resultState}`"
      >
        <template v-if="resultState === 'correct'">
          <IconWrapper
            name="success"
            :size="20"
          />
          <span>{{ t.correct }}</span>
          <IconWrapper
            v-if="streak >= 2"
            name="warning"
            :size="14"
            class="typing-streak"
          /> x{{ streak }}
        </template>
        <template v-else-if="resultState === 'incorrect'">
          <span>{{ coverMode ? currentCard?.title : typedWord }}</span>
          <Button
            variant="ghost"
            size="xsmall"
            icon="refreshLeft"
            :iconSize="14"
            :title="t.retryTyping"
            @click="resetTyping"
          />
        </template>
      </div>
    </div>

    <div class="card-navigation">
      <Button
        variant="ghost"
        icon="chevronLeft"
        :disabled="currentIndex === 0"
        :title="t.previous"
        @click="$emit('previous')"
      />
      <Button
        variant="ghost"
        icon="shuffle"
        :title="t.randomCard"
        @click="$emit('random')"
      />
      <span class="tag tag-rounded">{{ currentIndex + 1 }} / {{ totalCards }}</span>
      <Button
        variant="ghost"
        icon="skipNext"
        :title="t.skipCard"
        @click="$emit('skip')"
      />
      <Button
        variant="ghost"
        icon="chevronRight"
        :disabled="currentIndex === totalCards - 1"
        :title="t.next"
        @click="$emit('next')"
      />
    </div>

    <div
      v-if="sessionTotal > 0"
      class="typing-session-stats"
    >
      <span>{{ sessionCorrect }} / {{ sessionTotal }}</span>
      <span class="typing-session-stats__sep">·</span>
      <span>{{ Math.round(sessionCorrect / sessionTotal * 100) }}%</span>
      <IconWrapper
        v-if="streak >= 2"
        name="warning"
        :size="12"
        class="typing-streak typing-streak--inline"
      /> x{{ streak }}
      <template v-if="timerEnabled">
        <span class="typing-session-stats__sep">·</span>
        <span class="typing-timer"><IconWrapper name="timerOutline" :size="12" class="typing-timer__icon" /> {{ formatTime(elapsedSeconds) }}</span>
      </template>
    </div>

    <div
      v-if="roundComplete"
      class="typing-round-summary"
    >
      <div class="typing-round-summary__title">
        {{ t.roundComplete }}
      </div>
      <div class="typing-round-summary__stats">
        <span>{{ sessionCorrect }} / {{ sessionTotal }} {{ t.summaryCorrect }}</span>
        <span class="typing-session-stats__sep">·</span>
        <span>{{ Math.round(sessionCorrect / sessionTotal * 100) }}%</span>
        <template v-if="timerEnabled">
          <span class="typing-session-stats__sep">·</span>
          <span><IconWrapper name="timerOutline" :size="12" class="typing-timer__icon" /> {{ formatTime(elapsedSeconds) }}</span>
        </template>
      </div>
      <Button
        variant="primary"
        size="xsmall"
        @click="emit('restartRound')"
      >
        {{ t.startNextRound }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  Flashcard,
  I18n,
} from "../types"
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useI18n } from "../composables/useI18n"

const props = defineProps<{
  currentCard: Flashcard | null
  currentIndex: number
  totalCards: number
  caseInsensitive: boolean
  instantReset: boolean
  coverMode: boolean
  timerEnabled: boolean
  sessionSize: number
  sessionTotal: number
  sessionCorrect: number
  roundComplete: boolean
  i18n: I18n
}>()

const emit = defineEmits<{
  "play": [card: Flashcard | null]
  "previous": []
  "next": []
  "random": []
  "skip": []
  "correct": [card: Flashcard | null]
  "wrong": [card: Flashcard | null]
  "restartRound": []
  "update:caseInsensitive": [value: boolean]
  "update:instantReset": [value: boolean]
  "update:coverMode": [value: boolean]
  "update:timerEnabled": [value: boolean]
  "update:sessionSize": [value: number]
}>()

const t = useI18n(props.i18n)

/** 会话大小合法范围 */
const MIN_SESSION_SIZE = 5
const MAX_SESSION_SIZE = 100

const inputEl = ref<HTMLInputElement | null>(null)
const typedWord = ref("")
const isFocused = ref(false)
const resultState = ref<"idle" | "correct" | "incorrect">("idle")
const streak = ref(0)
const elapsedSeconds = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null
let correctTimeout: ReturnType<typeof setTimeout> | null = null
let resetTimeout: ReturnType<typeof setTimeout> | null = null

function startTimer() {
  if (timerInterval) return
  timerInterval = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function resetTimer() {
  stopTimer()
  elapsedSeconds.value = 0
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function changeSessionSize(delta: number) {
  const next = Math.max(MIN_SESSION_SIZE, Math.min(MAX_SESSION_SIZE, props.sessionSize + delta))
  emit("update:sessionSize", next)
}

const targetWord = computed(() => props.currentCard?.title || "")

const targetChars = computed(() => targetWord.value.split(""))

/** 根据大小写敏感设置返回用于比较的字符 */
function normalizeChar(ch: string): string {
  return props.caseInsensitive ? ch.toLowerCase() : ch
}

const typingPlaceholder = computed(() => {
  if (!isFocused.value && !typedWord.value) {
    return t.value.clickToStartTyping
  }
  return ""
})

function charClass(index: number) {
  if (typedWord.value.length <= index) return ""
  return normalizeChar(typedWord.value[index]) === normalizeChar(targetChars.value[index])
    ? "typing-char--correct"
    : "typing-char--incorrect"
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    resetTyping()
    return
  }
  if (e.key === "Enter") {
    checkCompletion()
  }
}

function onFocus() {
  isFocused.value = true
}

function onBlur() {
  isFocused.value = false
}

function checkCompletion() {
  if (!typedWord.value) return
  const typed = props.caseInsensitive ? typedWord.value.toLowerCase() : typedWord.value
  const target = props.caseInsensitive ? targetWord.value.toLowerCase() : targetWord.value
  if (typed === target) {
    streak.value++
    stopTimer()
    resultState.value = "correct"
    emit("correct", props.currentCard)
    if (correctTimeout) clearTimeout(correctTimeout)
    correctTimeout = setTimeout(() => {
      emit("skip")
    }, 600)
  } else {
    streak.value = 0
    emit("wrong", props.currentCard)
    resultState.value = "incorrect"
    if (resetTimeout) clearTimeout(resetTimeout)
    resetTimeout = setTimeout(() => {
      resetTyping()
    }, 1200)
  }
}

function resetTyping() {
  typedWord.value = ""
  resultState.value = "idle"
  nextTick(() => {
    inputEl.value?.focus()
  })
}

watch(
  () => props.currentIndex,
  () => {
    resetTyping()
  },
)

watch(
  () => props.roundComplete,
  (val) => {
    if (val) stopTimer()
  },
)

watch(
  () => props.sessionTotal,
  (val) => {
    // 新一轮开始（sessionTotal 重置为 0）时重置计时器
    if (val === 0) resetTimer()
  },
)

// 组件卸载时清理所有定时器，防止内存泄漏与悬空回调
onUnmounted(() => {
  stopTimer()
  if (correctTimeout) clearTimeout(correctTimeout)
  if (resetTimeout) clearTimeout(resetTimeout)
})

watch(typedWord, (val) => {
  if (resultState.value !== "idle") {
    resultState.value = "idle"
  }
  // 开始计时：首次输入字符时
  if (props.timerEnabled && val.length === 1 && !timerInterval) {
    startTimer()
  }
  // instantReset: 每个字符输入时立即校验，错误则清空重来
  if (props.instantReset && val.length > 0) {
    if (normalizeChar(val[val.length - 1]) !== normalizeChar(targetChars.value[val.length - 1])) {
      streak.value = 0
      emit("wrong", props.currentCard)
      resetTyping()
      return
    }
  }
  if (val.length >= targetWord.value.length) {
    checkCompletion()
  }
})
</script>