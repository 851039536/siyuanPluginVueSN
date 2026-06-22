<template>
  <div class="import-overlay" @click.self="$emit('close')">
    <div class="import-dialog">
      <h3 class="import-dialog__title">{{ t.importMarkdown }}</h3>
      <div class="import-dialog__body">
        <p class="import-dialog__hint">{{ t.importHint || '格式：## 标题\\n\\n答案\\n\\n- 错误选项1\\n- 错误选项2\\n- 错误选项3\\n\\n```语言\\n代码\\n```' }}</p>
        <textarea
          v-model="rawText"
          class="import-dialog__textarea"
          rows="10"
          placeholder="## 什么是闭包？&#10;&#10;闭包是指函数能够访问其外部作用域变量的能力。&#10;&#10;```javascript&#10;function createCounter() {&#10;  let count = 0;&#10;  return () => ++count;&#10;}&#10;```"
          spellcheck="false"
        />

        <div v-if="parsedCards.length > 0" class="import-dialog__preview">
          <p class="import-dialog__label">
            {{ t.parseResult }}：{{ t.willImport }} {{ parsedCards.length }} {{ t.cards }}
          </p>
          <div class="import-dialog__preview-list">
            <div v-for="(card, idx) in parsedCards" :key="idx" class="import-dialog__preview-item">
              <span class="import-dialog__preview-lang">{{ card.language }}</span>
              <span>{{ card.title }}</span>
            </div>
          </div>
        </div>
        <p v-else-if="rawText.trim()" class="import-dialog__no-valid">
          {{ t.noValidCards }}
        </p>
      </div>
      <div class="import-dialog__footer">
        <button class="import-dialog__btn import-dialog__btn--cancel" @click="$emit('close')">
          {{ t.close }}
        </button>
        <button
          class="import-dialog__btn import-dialog__btn--import"
          :disabled="parsedCards.length === 0"
          @click="handleImport"
        >
          {{ t.confirmImport }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue"
import type { SkillI18n, CreateSkillDTO, Language } from "../types"

const props = defineProps<{
  i18n: SkillI18n
}>()

const emit = defineEmits<{
  import: [cards: CreateSkillDTO[]]
  close: []
}>()

const t = computed(() => props.i18n)
const rawText = ref("")

interface ParsedCard extends CreateSkillDTO { language: Language }
const parsedCards = ref<ParsedCard[]>([])

function parseMarkdown(text: string): ParsedCard[] {
  const cards: ParsedCard[] = []
  const sections = text.split(/^## /gm).filter(Boolean)

  for (const section of sections) {
    const lines = section.split("\n")
    const title = lines[0].trim()
    if (!title) continue

    let answer = ""
    const distractors: string[] = []
    let codeSnippet = ""
    let language: Language = "other"
    let inCodeBlock = false
    let codeLang = ""

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true
          codeLang = line.slice(3).trim().toLowerCase()
        } else {
          inCodeBlock = false
        }
        continue
      }
      if (inCodeBlock) {
        codeSnippet += (codeSnippet ? "\n" : "") + line
      } else {
        // 以 "- " 开头的行视为干扰项
        if (line.trim().startsWith("- ")) {
          distractors.push(line.trim().slice(2).trim())
        } else {
          answer += (answer ? "\n" : "") + line
        }
      }
    }

    // 自动映射语言
    const langMap: Record<string, Language> = {
      csharp: "csharp", cs: "csharp",
      javascript: "javascript", js: "javascript",
      typescript: "typescript", ts: "typescript",
      vue: "vue",
    }
    if (codeLang && langMap[codeLang]) language = langMap[codeLang]

    cards.push({
      title: title.trim(),
      answer: answer.trim(),
      distractors: distractors.length > 0 ? distractors.slice(0, 3) : undefined,
      codeSnippet: codeSnippet.trim(),
      language,
      category: "导入",
    })
  }

  return cards
}

watch(rawText, (val) => {
  parsedCards.value = parseMarkdown(val)
})

function handleImport() {
  if (parsedCards.value.length > 0) {
    emit("import", parsedCards.value)
  }
}
</script>

<style lang="scss" scoped>
.import-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.import-dialog {
  width: 480px;
  max-height: 80vh;
  background: var(--b3-theme-background, #fff);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__title {
    margin: 0;
    padding: 16px 20px;
    font-size: 16px;
    font-weight: 600;
    border-bottom: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    color: var(--b3-theme-on-background, #333);
  }
  &__body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
  }
  &__hint {
    font-size: 12px;
    color: #94a3b8;
    margin: 0 0 10px;
    line-height: 1.5;
  }
  &__textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    border-radius: 8px;
    font-size: 13px;
    font-family: "Fira Code", "Cascadia Code", monospace;
    background: #1e293b;
    color: #e2e8f0;
    outline: none;
    resize: vertical;
    box-sizing: border-box;
    &:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
    }
  }
  &__preview {
    margin-top: 12px;
  }
  &__label {
    font-size: 12px;
    color: #64748b;
    margin: 0 0 6px;
  }
  &__preview-list {
    max-height: 160px;
    overflow-y: auto;
    border: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
    border-radius: 6px;
    padding: 8px;
  }
  &__preview-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    font-size: 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
    &:last-child { border-bottom: none; }
  }
  &__preview-lang {
    font-size: 10px;
    background: #e2e8f0;
    color: #64748b;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
  }
  &__no-valid {
    margin-top: 8px;
    font-size: 12px;
    color: #ef4444;
  }
  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--b3-theme-surface-lighter, #e2e8f0);
  }
  &__btn {
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    &--cancel {
      background: transparent;
      color: #64748b;
      &:hover { background: rgba(0, 0, 0, 0.05); }
    }
    &--import {
      background: #6366f1;
      color: #fff;
      &:hover { background: #4f46e5; }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}
</style>
