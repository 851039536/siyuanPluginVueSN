<template>
  <div class="import-dialog-overlay" @click.self="$emit('close')">
    <div class="import-dialog">
      <h3 class="import-dialog__title">{{ t.importCards }}</h3>

      <div class="import-dialog__body">
        <!-- 粘贴区 -->
        <label class="import-dialog__label">{{ t.importMarkdown }}</label>
        <textarea
          v-model="input"
          class="import-dialog__textarea"
          rows="10"
          :placeholder="t.importHint"
          spellcheck="false"
        />

        <!-- 解析预览 -->
        <div v-if="parsed.length > 0" class="import-dialog__preview">
          <label class="import-dialog__label">{{ t.parseResult }} ({{ parsed.length }} {{ t.cards }})</label>
          <div class="import-dialog__preview-list">
            <div v-for="(card, i) in parsed" :key="i" class="import-dialog__preview-item">
              <span class="import-dialog__preview-idx">{{ i + 1 }}</span>
              <span class="import-dialog__preview-title">{{ card.title }}</span>
              <span v-if="card.answer" class="import-dialog__preview-ok">✓</span>
              <span v-else class="import-dialog__preview-warn">!</span>
            </div>
          </div>
        </div>

        <!-- 无有效卡片 -->
        <div v-else-if="input.trim()" class="import-dialog__empty">
          {{ t.noValidCards }}
        </div>
      </div>

      <div class="import-dialog__footer">
        <button class="import-dialog__btn import-dialog__btn--cancel" @click="$emit('close')">
          {{ t.cancel }}
        </button>
        <button
          class="import-dialog__btn import-dialog__btn--save"
          :disabled="parsed.length === 0 || importing"
          @click="handleImport"
        >
          {{ importing ? '...' : t.confirmImport + ' (' + parsed.length + ')' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue"
import type { SkillI18n, CreateSkillDTO } from "../types"
import { parseMarkdownCards } from "../composables/useMarkdownParser"

const props = defineProps<{
  i18n: SkillI18n
}>()

const emit = defineEmits<{
  import: [cards: CreateSkillDTO[]]
  close: []
}>()

const t = computed(() => props.i18n)
const input = ref("")
const importing = ref(false)

const parsed = computed(() => parseMarkdownCards(input.value))

async function handleImport() {
  if (parsed.value.length === 0 || importing.value) return
  importing.value = true
  const dtos: CreateSkillDTO[] = parsed.value.map((card) => ({
    title: card.title,
    answer: card.answer,
    distractors: card.distractors.length > 0 ? card.distractors : undefined,
    codeSnippet: card.codeSnippet,
  }))
  emit("import", dtos)
  importing.value = false
}
</script>

<style lang="scss" scoped>
@use "../styles/ImportDialog.scss";
</style>
