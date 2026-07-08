<!-- 代码解释器 — 分析代码功能、复杂度和优化建议 -->
<template>
  <div class="code-explainer-panel">
    <div class="panel-content">
      <div class="input-section">
        <Input
          v-model="codeInput"
          type="textarea"
          class="code-textarea"
          :placeholder="i18n.codeInputPlaceholder || '粘贴需要解释的代码...'"
          :rows="8"
        />
      </div>

      <div class="action-section">
        <Button
          variant="primary"
          size="xsmall"
          :disabled="isExplaining || !codeInput.trim()"
          :loading="isExplaining"
          @click="handleExplain"
        >
          <IconWrapper
            name="lightbulb"
            :size="16"
          />
          {{ isExplaining ? (i18n.analyzing || '分析中...') : (i18n.explain || '解释代码') }}
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
          :disabled="!codeInput.trim() && !result"
          @click="handleClear"
        >
          <IconWrapper
            name="delete"
            :size="16"
          />
          {{ i18n.clear || '清除' }}
        </Button>
      </div>

      <div
        v-if="result"
        class="result-section"
      >
        <div class="result-header">
          <span class="result-label">
            <IconWrapper
              name="success"
              :size="14"
            />
            {{ i18n.analysisResult || '分析结果' }}
          </span>
          <Button
            variant="ghost"
            size="xsmall"
            @click="copyExplanation"
          >
            <IconWrapper
              name="contentCopy"
              :size="14"
            />
            {{ i18n.copyExplanation || '复制解释' }}
          </Button>
        </div>
        <div class="result-rows">
          <div class="result-row">
            <span class="row-label">{{ i18n.languageLabel || '语言' }}</span>
            <span class="row-value">{{ result.language }}</span>
          </div>
          <div class="result-row">
            <span class="row-label">{{ i18n.complexityLabel || '复杂度' }}</span>
            <span class="row-value">{{ result.complexity }}</span>
          </div>
          <div class="result-row">
            <span class="row-label">{{ i18n.explanationShortLabel || '解释' }}</span>
            <span class="row-value">{{ result.explanation }}</span>
          </div>
          <div
            v-if="result.suggestions.length > 0"
            class="result-row"
          >
            <span class="row-label">{{ i18n.suggestionsLabel || '建议' }}</span>
            <span class="row-tags">
              <span
                v-for="(suggestion, index) in result.suggestions"
                :key="index"
                class="suggestion-tag"
                @click="copySuggestion(suggestion)"
              >
                {{ suggestion }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="error-section"
      >
        <IconWrapper
          name="error"
          :size="16"
        />
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CodeExplanationResult } from "../utils/codeUtils"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { useCodeFeature } from "../composables/useCodeFeature"
import { explainCode } from "../utils/codeUtils"
import type { WordQueryComponentProps } from "../types"

const props = defineProps<WordQueryComponentProps>()

const codeInput = ref("")
const result = ref<CodeExplanationResult | null>(null)
const isExplaining = ref(false)

const {
  errorMessage,
  clearErrorOnInput,
  getApiConfig,
  copyText,
} = useCodeFeature(props.plugin)
clearErrorOnInput(codeInput)

async function handleExplain() {
  if (!codeInput.value.trim()) {
    errorMessage.value = props.i18n.enterCode || "请输入代码内容"
    return
  }

  isExplaining.value = true
  errorMessage.value = ""

  try {
    const config = getApiConfig()
    const res = await explainCode(codeInput.value.trim(), config)
    result.value = res
  } catch (error) {
    console.error("解释代码失败:", error)
    errorMessage.value =
      (error as Error).message
      || props.i18n.analysisFailed
      || "分析失败，请重试"
  } finally {
    isExplaining.value = false
  }
}

function handleClear() {
  codeInput.value = ""
  result.value = null
  errorMessage.value = ""
}

function copyExplanation() {
  if (result.value) {
    const text = `代码解释：\n${result.value.explanation}\n\n语言：${result.value.language}\n复杂度：${result.value.complexity}\n\n优化建议：\n${result.value.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    copyText(text)
  }
}

function copySuggestion(suggestion: string) {
  copyText(suggestion)
}
</script>

<style scoped lang="scss">
@use "../styles/codeUtils.scss";
</style>
