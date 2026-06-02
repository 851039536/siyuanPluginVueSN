<template>
  <div class="code-explainer-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        <IconWrapper
          name="code"
          :size="18"
        />
        {{ i18n.codeExplainer || '代码解释器' }}
      </h3>
    </div>

    <div class="panel-content">
      <div class="input-section">
        <div class="input-label">
          <IconWrapper
            name="code"
            :size="14"
          />
          {{ i18n.enterCode || '输入代码' }}
        </div>
<Input
  type="textarea"
  v-model="codeInput"
  class="code-textarea"
  :placeholder="i18n.codeInputPlaceholder || '粘贴需要解释的代码...'"
  :rows="8"
  @input="handleInput"
/>
      </div>

      <div class="action-section">
        <Button
          variant="primary"
          size="small"
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
          size="small"
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
          <div class="meta-info">
            <span class="meta-tag">{{ result.language }}</span>
            <span class="meta-tag complexity">{{ result.complexity }}</span>
          </div>
        </div>

        <div class="result-content">
          <div class="explanation-section">
            <h4 class="section-title">
              {{ i18n.codeExplanation || '代码解释' }}
            </h4>
            <div class="explanation-text">
              {{ result.explanation }}
            </div>
          </div>

          <div
            v-if="result.suggestions.length > 0"
            class="suggestions-section"
          >
            <h4 class="section-title">
              <IconWrapper
                name="lightbulb"
                :size="14"
              />
              {{ i18n.optimizationSuggestions || '优化建议' }}
            </h4>
            <div class="suggestions-list">
              <div
                v-for="(suggestion, index) in result.suggestions"
                :key="index"
                class="suggestion-item"
              >
                <span class="suggestion-index">{{ index + 1 }}.</span>
                {{ suggestion }}
              </div>
            </div>
          </div>
        </div>

        <div class="result-actions">
          <Button
            variant="ghost"
            size="small"
            @click="copyExplanation"
          >
            <IconWrapper
              name="contentCopy"
              :size="14"
            />
            {{ i18n.copyExplanation || '复制解释' }}
          </Button>
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
import { showMessage } from "siyuan"
import {
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { getApiConfigFromPlugin } from "../utils/apiBase"
import {

  explainCode,
} from "../utils/codeUtils"

interface Props {
  i18n: any
  plugin?: any
}

const props = defineProps<Props>()

const codeInput = ref("")
const result = ref<CodeExplanationResult | null>(null)
const isExplaining = ref(false)
const errorMessage = ref("")

function handleInput() {
  errorMessage.value = ""
}

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

function getApiConfig() {
  return getApiConfigFromPlugin(props.plugin)
}

function copyExplanation() {
  if (result.value) {
    const text = `代码解释：\n${result.value.explanation}\n\n语言：${result.value.language}\n复杂度：${result.value.complexity}\n\n优化建议：\n${result.value.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    navigator.clipboard.writeText(text)
    showMessage(props.i18n.copied || "已复制", 1500, "info")
  }
}

watch(
  () => codeInput.value,
  () => {
    if (errorMessage.value) {
      errorMessage.value = ""
    }
  },
)
</script>

<style scoped lang="scss">
@use "../styles/codeUtils.scss";
</style>
