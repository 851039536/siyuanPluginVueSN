<!-- 单词阅读功能 - 打字练习组件 -->
<template>
  <div class="typing-practice">
    <Card
      variant="bordered"
      size="medium"
      class="flashcard-item flashcard-item--single"
    >
      <template #header>
        <div class="card-header">
          <span
            class="card-title"
            :class="{ 'card-title--covered': coverMode }"
          >
            {{ coverMode ? '?' : currentCard?.title }}
          </span>
          <div class="card-actions">
            <Button
              variant="ghost"
              size="xsmall"
              icon="play"
              :iconSize="14"
              :title="t.play"
              @click="$emit('play', currentCard)"
            />
          </div>
        </div>
      </template>
      <div class="typing-detail">
        {{ currentCard?.content }}
      </div>
      <template #footer>
        <div class="card-footer card-footer--single">
          <div class="card-footer__meta">
            <span class="tag tag-small tag-info">{{ currentCard?.category }}</span>
            <span class="tag tag-small tag-contrast">{{ t.practiceCount }}: {{ currentCard?.practiceCount || 0 }}</span>
          </div>
        </div>
      </template>
    </Card>

    <div class="typing-options">
      <button
        class="typing-case-toggle"
        :class="{ 'typing-case-toggle--active': caseInsensitive }"
        :title="caseInsensitive ? '当前：不区分大小写' : '当前：区分大小写'"
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
        :title="coverMode ? '当前：盲打模式' : '当前：看打模式'"
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
        :title="timerEnabled ? '当前：计时开启' : '当前：计时关闭'"
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

    <div class="typing-session-config">
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
      <span class="typing-session-config__unit">张</span>
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
            title="重新输入"
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
      <span>{{ sessionTotal > 0 ? Math.round(sessionCorrect / sessionTotal * 100) : 0 }}%</span>
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
        <span>{{ sessionCorrect }} / {{ sessionTotal }} 正确</span>
        <span class="typing-session-stats__sep">·</span>
        <span>{{ sessionTotal > 0 ? Math.round(sessionCorrect / sessionTotal * 100) : 0 }}%</span>
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
        开始下一轮
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
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Card from "@/components/Card.vue"
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

const inputEl = ref<HTMLInputElement | null>(null)
const typedWord = ref("")
const isFocused = ref(false)
const resultState = ref<"idle" | "correct" | "incorrect">("idle")
const streak = ref(0)
const elapsedSeconds = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

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
  const next = Math.max(5, Math.min(100, props.sessionSize + delta))
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

function checkCompletion() {
  if (!typedWord.value) return
  const typed = props.caseInsensitive ? typedWord.value.toLowerCase() : typedWord.value
  const target = props.caseInsensitive ? targetWord.value.toLowerCase() : targetWord.value
  if (typed === target) {
    streak.value++
    stopTimer()
    resultState.value = "correct"
    emit("correct", props.currentCard)
    setTimeout(() => {
      emit("skip")
    }, 600)
  } else {
    streak.value = 0
    emit("wrong", props.currentCard)
    resultState.value = "incorrect"
    setTimeout(() => {
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
