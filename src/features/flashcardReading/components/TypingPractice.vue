<template>
  <div class="typing-practice">
    <Card
      variant="bordered"
      size="medium"
      class="flashcard-item flashcard-item--single"
    >
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ currentCard?.title }}</span>
          <div class="card-actions">
            <Button
              variant="ghost"
              size="small"
              icon="play"
              :iconSize="14"
              :title="i18n.play || '播放'"
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
            <span class="tag tag-small tag-contrast">{{ i18n.practiceCount || '练习' }}: {{ currentCard?.practiceCount || 0 }}</span>
          </div>
        </div>
      </template>
    </Card>

    <div class="typing-area">
      <div class="typing-hint">
        {{ i18n.typeTheWord || '请输入单词' }}:
      </div>

      <div class="typing-target">
        <span
          v-for="(char, i) in targetChars"
          :key="i"
          class="typing-char"
          :class="charClass(i)"
        >{{ char }}</span>
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
          <span>{{ i18n.correct || '正确!' }}</span>
        </template>
        <template v-else-if="resultState === 'incorrect'">
          <span>{{ typedWord }}</span>
          <Button
            variant="ghost"
            size="small"
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
        :title="i18n.previous || '上一个'"
        @click="$emit('previous')"
      />
      <Button
        variant="ghost"
        icon="shuffle"
        :title="i18n.randomCard || '随机'"
        @click="$emit('random')"
      />
      <span class="tag tag-rounded">{{ currentIndex + 1 }} / {{ totalCards }}</span>
      <Button
        variant="ghost"
        icon="skipNext"
        :title="i18n.skipCard || '跳过'"
        @click="$emit('skip')"
      />
      <Button
        variant="ghost"
        icon="chevronRight"
        :disabled="currentIndex === totalCards - 1"
        :title="i18n.next || '下一个'"
        @click="$emit('next')"
      />
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

const props = defineProps<{
  currentCard: Flashcard | null
  currentIndex: number
  totalCards: number
  i18n: I18n
}>()

const emit = defineEmits<{
  play: [card: Flashcard | null]
  previous: []
  next: []
  random: []
  skip: []
  correct: [card: Flashcard | null]
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const typedWord = ref("")
const isFocused = ref(false)
const resultState = ref<"idle" | "correct" | "incorrect">("idle")

const targetWord = computed(() => props.currentCard?.title || "")

const targetChars = computed(() => targetWord.value.split(""))

const typingPlaceholder = computed(() => {
  if (!isFocused.value && !typedWord.value) {
    return props.i18n.clickToStartTyping || "点击开始输入..."
  }
  return ""
})

function charClass(index: number) {
  if (typedWord.value.length <= index) return ""
  return typedWord.value[index] === targetChars.value[index]
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
  if (typedWord.value === targetWord.value) {
    resultState.value = "correct"
    emit("correct", props.currentCard)
    setTimeout(() => {
      emit("skip")
    }, 600)
  } else {
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

watch(typedWord, (val) => {
  if (resultState.value !== "idle") {
    resultState.value = "idle"
  }
  if (val.length >= targetWord.value.length) {
    checkCompletion()
  }
})
</script>
