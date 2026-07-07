<!-- 编程字段翻译面板 — 中文翻译为符合编程命名规范的英文 -->
<template>
  <div class="code-translation-panel">
    <div class="panel-content">
      <div class="input-section">
        <Input
          v-model="chineseInput"
          type="textarea"
          :placeholder="i18n.enterChinesePlaceholder || '输入中文，如：获取用户信息、用户接口、计算总价...'"
          :rows="3"
        />
      </div>

      <div class="style-section">
        <div class="style-label">
          <IconWrapper
            name="format"
            :size="14"
          />
          {{ i18n.namingStyle || '命名风格' }}
        </div>
        <div class="style-options">
          <div
            v-for="style in NAMING_STYLES"
            :key="style.id"
            class="style-option"
            :class="{ active: selectedStyle.id === style.id }"
            @click="selectStyle(style)"
          >
            <div class="style-name">
              {{ style.label }}
            </div>
            <div class="style-example">
              {{ style.example }}
            </div>
          </div>
        </div>
      </div>

      <div class="action-section">
        <Button
          variant="primary"
          size="xsmall"
          :disabled="isTranslating || !chineseInput.trim()"
          :loading="isTranslating"
          @click="handleTranslate"
        >
          <IconWrapper
            name="translate"
            :size="16"
          />
          {{ isTranslating ? (i18n.translating || '翻译中...') : (i18n.translate || '翻译') }}
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
          :disabled="!chineseInput.trim() && !translationResult"
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
        v-if="translationResult"
        class="result-section"
      >
        <div class="result-header">
          <span class="result-label">
            <IconWrapper
              name="success"
              :size="14"
            />
            {{ i18n.translationResult || '翻译结果' }}
          </span>
          <Button
            variant="ghost"
            size="xsmall"
            @click="copyResult"
          >
            <IconWrapper
              name="contentCopy"
              :size="14"
            />
            {{ i18n.copy || '复制' }}
          </Button>
        </div>
        <div class="result-content">
          <div class="main-result">
            <div class="result-item">
              <span class="result-key">{{ i18n.original || '原文' }}:</span>
              <span class="result-value">{{ translationResult.original }}</span>
            </div>
            <div class="result-item highlight">
              <span class="result-key">{{ i18n.translated || '译文' }}:</span>
              <span class="result-value">{{ translationResult.translated }}</span>
            </div>
            <div class="result-item">
              <span class="result-key">{{ i18n.abbreviation || '缩写' }}:</span>
              <span
                class="result-value abbreviation"
                @click="copyAbbreviation"
              >{{ generateAbbreviation(translationResult.translated) }}</span>
              <IconWrapper
                name="contentCopy"
                :size="12"
                class="copy-icon"
              />
            </div>
            <div class="result-item">
              <span class="result-key">{{ i18n.style || '风格' }}:</span>
              <span class="result-value">{{ selectedStyle.label }}</span>
            </div>
          </div>

          <div
            v-if="translationResult.suggestions.length > 0"
            class="suggestions"
          >
            <div class="suggestions-title">
              <IconWrapper
                name="lightbulb"
                :size="14"
              />
              {{ i18n.suggestions || '备选方案' }}
            </div>
            <div class="suggestions-list">
              <div
                v-for="(suggestion, index) in translationResult.suggestions"
                :key="index"
                class="suggestion-item"
                @click="copySuggestion(suggestion)"
              >
                {{ suggestion }}
                <IconWrapper
                  name="contentCopy"
                  :size="12"
                />
              </div>
            </div>
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
import type {
  CodeTranslationResult,
  NamingStyle,
} from "../utils/codeTranslation"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { useCodeFeature } from "../composables/useCodeFeature"
import {
  generateAbbreviation,
  NAMING_STYLES,
  translateCodeField,
} from "../utils/codeTranslation"
import type { WordQueryComponentProps } from "../types"

const props = defineProps<WordQueryComponentProps>()

const chineseInput = ref("")
const selectedStyle = ref<NamingStyle>(NAMING_STYLES[0])
const translationResult = ref<CodeTranslationResult | null>(null)
const isTranslating = ref(false)

const {
  errorMessage,
  clearErrorOnInput,
  getApiConfig,
  copyText,
} = useCodeFeature(props.plugin)
clearErrorOnInput(chineseInput)

function selectStyle(style: NamingStyle) {
  selectedStyle.value = style
}

async function handleTranslate() {
  if (!chineseInput.value.trim()) {
    errorMessage.value = props.i18n.enterChinese || "请输入中文内容"
    return
  }

  isTranslating.value = true
  errorMessage.value = ""

  try {
    const config = getApiConfig()
    const result = await translateCodeField(
      chineseInput.value.trim(),
      selectedStyle.value,
      config,
    )
    translationResult.value = result
  } catch (error) {
    console.error("翻译失败:", error)
    errorMessage.value =
      (error as Error).message
      || props.i18n.translationFailed
      || "翻译失败，请重试"
  } finally {
    isTranslating.value = false
  }
}

function handleClear() {
  chineseInput.value = ""
  translationResult.value = null
  errorMessage.value = ""
}

function copyResult() {
  if (translationResult.value) {
    copyText(translationResult.value.translated)
  }
}

function copySuggestion(suggestion: string) {
  copyText(suggestion)
}

function copyAbbreviation() {
  if (translationResult.value) {
    const abbr = generateAbbreviation(translationResult.value.translated)
    copyText(abbr)
  }
}
</script>

<style scoped lang="scss">
@use "../styles/codeUtils.scss";
</style>
