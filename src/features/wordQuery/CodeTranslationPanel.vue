<template>
  <div class="code-translation-panel">
    <div class="translation-header">
      <h3 class="panel-title">
        <IconWrapper name="code" :size="18" />
        {{ i18n.codeTranslation || '编程字段翻译' }}
      </h3>
    </div>

    <div class="translation-content">
      <div class="input-section">
        <div class="input-label">
          <IconWrapper name="translate" :size="14" />
          {{ i18n.enterChinese || '输入中文' }}
        </div>
        <Textarea
          v-model="chineseInput"
          class="translation-textarea"
          :placeholder="i18n.enterChinesePlaceholder || '输入中文，如：获取用户信息、用户接口、计算总价...'"
          :rows="3"
          @input="handleInput"
        />
      </div>

      <div class="style-section">
        <div class="style-label">
          <IconWrapper name="format" :size="14" />
          {{ i18n.namingStyle || '命名风格' }}
        </div>
        <div class="style-options">
          <div
            v-for="style in namingStyles"
            :key="style.id"
            class="style-option"
            :class="{ active: selectedStyle.id === style.id }"
            @click="selectStyle(style)"
          >
            <div class="style-name">{{ style.label }}</div>
            <div class="style-example">{{ style.example }}</div>
          </div>
        </div>
      </div>

      <div class="action-section">
        <Button
          variant="primary"
          size="small"
          @click="handleTranslate"
          :disabled="isTranslating || !chineseInput.trim()"
          :loading="isTranslating"
        >
          <IconWrapper name="translate" :size="16" />
          {{ isTranslating ? (i18n.translating || '翻译中...') : (i18n.translate || '翻译') }}
        </Button>
        <Button
          variant="ghost"
          size="small"
          @click="handleClear"
          :disabled="!chineseInput.trim() && !translationResult"
        >
          <IconWrapper name="delete" :size="16" />
          {{ i18n.clear || '清除' }}
        </Button>
      </div>

      <div v-if="translationResult" class="result-section">
        <div class="result-header">
          <span class="result-label">
            <IconWrapper name="checkCircle" :size="14" />
            {{ i18n.translationResult || '翻译结果' }}
          </span>
          <Button variant="ghost" size="small" @click="copyResult">
            <IconWrapper name="contentCopy" :size="14" />
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
              <span class="result-key">{{ i18n.style || '风格' }}:</span>
              <span class="result-value">{{ selectedStyle.label }}</span>
            </div>
          </div>

          <div v-if="translationResult.suggestions.length > 0" class="suggestions">
            <div class="suggestions-title">
              <IconWrapper name="lightbulb" :size="14" />
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
                <IconWrapper name="contentCopy" :size="12" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="errorMessage" class="error-section">
        <IconWrapper name="error" :size="16" />
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { showMessage } from 'siyuan'
import IconWrapper from '@/components/IconWrapper.vue'
import Button from '@/components/Button.vue'
import Textarea from '@/components/Textarea.vue'
import { translateCodeField, NAMING_STYLES, type NamingStyle, type CodeTranslationResult } from './codeTranslation'

interface Props {
  i18n: any
  plugin?: any
}

const props = defineProps<Props>()

const chineseInput = ref('')
const selectedStyle = ref<NamingStyle>(NAMING_STYLES[0])
const translationResult = ref<CodeTranslationResult | null>(null)
const isTranslating = ref(false)
const errorMessage = ref('')

const namingStyles = NAMING_STYLES

function selectStyle(style: NamingStyle) {
  selectedStyle.value = style
}

function handleInput() {
  errorMessage.value = ''
}

async function handleTranslate() {
  if (!chineseInput.value.trim()) {
    errorMessage.value = props.i18n.enterChinese || '请输入中文内容'
    return
  }

  isTranslating.value = true
  errorMessage.value = ''

  try {
    const config = getApiConfig()
    const result = await translateCodeField(chineseInput.value.trim(), selectedStyle.value, config)
    translationResult.value = result
  } catch (error) {
    console.error('翻译失败:', error)
    errorMessage.value = (error as Error).message || props.i18n.translationFailed || '翻译失败，请重试'
  } finally {
    isTranslating.value = false
  }
}

function handleClear() {
  chineseInput.value = ''
  translationResult.value = null
  errorMessage.value = ''
}

function getApiConfig() {
  const settings = (props.plugin as any)?.settings || {}
  return {
    provider: settings.aiApiProvider || 'tongyi',
    model: settings.aiModel || 'qwen-plus',
    apiKey: settings.aiApiKey || '',
    customEndpoint: settings.aiCustomEndpoint || ''
  }
}

function copyResult() {
  if (translationResult.value) {
    navigator.clipboard.writeText(translationResult.value.translated)
    showMessage(props.i18n.copied || '已复制', 1500, 'info')
  }
}

function copySuggestion(suggestion: string) {
  navigator.clipboard.writeText(suggestion)
  showMessage(props.i18n.copied || '已复制', 1500, 'info')
}

watch(() => chineseInput.value, () => {
  if (errorMessage.value) {
    errorMessage.value = ''
  }
})
</script>

<style scoped lang="scss">
@import "./codeTranslation.scss";
</style>
