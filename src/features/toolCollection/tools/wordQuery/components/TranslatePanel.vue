<!-- 翻译面板 — 双栏翻译：源文本输入 + 语言选择 + 译文输出 -->
<template>
  <div class="translate-mode-content">
    <div class="translate-container">
      <div class="translate-input-section">
        <div class="section-header">
          <span class="section-title">{{ i18n.sourceText || '原文' }}</span>
          <Select
            v-model="sourceLanguage"
            :options="LANGUAGE_OPTIONS"
            size="xsmall"
            placement="bottom"
            class="language-select"
          />
        </div>
        <Input
          v-model="translateText"
          type="textarea"
          class="translate-textarea"
          :placeholder="i18n.enterTextToTranslate || '输入要翻译的文本，2秒后自动翻译...'"
        />
        <div class="input-actions">
          <Button
            variant="ghost"
            size="xsmall"
            @click="clearTranslateInput"
          >
            <IconWrapper
              name="delete"
              :size="16"
            />
            {{ i18n.clear || '清除' }}
          </Button>
          <Button
            variant="primary"
            size="xsmall"
            @click="handleTranslate"
          >
            <IconWrapper
              name="translate"
              :size="16"
            />
            {{ i18n.translate || '翻译' }}
          </Button>
        </div>
      </div>

      <div class="translate-output-section">
        <div class="section-header">
          <span class="section-title">{{ i18n.translatedText || '译文' }}</span>
          <Select
            v-model="targetLanguage"
            :options="TARGET_LANGUAGE_OPTIONS"
            size="xsmall"
            placement="bottom"
            class="language-select"
          />
        </div>
        <template v-if="translateResult">
          <div class="translate-result">
            {{ translateResult }}
          </div>
          <div class="output-actions">
            <Button
              variant="ghost"
              size="xsmall"
              @click="copyTranslation"
            >
              <IconWrapper
                name="contentCopy"
                :size="16"
              />
              {{ i18n.copy || '复制' }}
            </Button>
          </div>
        </template>
        <div
          v-else
          class="translate-empty"
        >
          <div class="empty-icon">
            <IconWrapper
              name="translate"
              :size="24"
            />
          </div>
          <p>{{ i18n.translationWillAppearHere || '翻译结果将显示在这里' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue"
import { showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { getApiConfigFromPlugin } from "@/utils/aiApi"
import { copyToClipboard } from "@/utils/domUtils"
import type { WordQueryComponentProps } from "../types"
import { LANGUAGE_MAP } from "../types"
import { buildTranslatePrompt, callWordQueryAPI } from "../utils/api"

const props = defineProps<WordQueryComponentProps>()

const i18n = props.i18n

const LANGUAGE_OPTIONS = Object.entries(LANGUAGE_MAP).map(([value, label]) => ({
  value,
  label,
}))

const TARGET_LANGUAGE_OPTIONS = LANGUAGE_OPTIONS.filter(
  (opt) => opt.value !== "auto",
)

const AUTO_OPERATION_DELAY = 2000

const translateText = ref("")
const translateResult = ref("")
const sourceLanguage = ref("auto")
const targetLanguage = ref("zh")
const autoTranslateTimer = ref<NodeJS.Timeout | null>(null)

const clearTimer = () => {
  if (autoTranslateTimer.value) {
    clearTimeout(autoTranslateTimer.value)
    autoTranslateTimer.value = null
  }
}

const handleTranslate = async () => {
  const text = translateText.value.trim()
  if (!text) {
    showMessage("请输入文本", 2000, "error")
    return
  }

  try {
    const config = getApiConfigFromPlugin(props.plugin)
    const prompt = buildTranslatePrompt(
      text,
      sourceLanguage.value,
      targetLanguage.value,
    )
    const result = await callWordQueryAPI(prompt, config)
    translateResult.value = result
  } catch (error) {
    console.error("Translation error:", error)
    showMessage(`翻译失败: ${(error as Error).message}`, 3000, "error")
  }
}

const clearTranslateInput = () => {
  translateText.value = ""
  translateResult.value = ""
}

const copyTranslation = async () => {
  if (!translateResult.value) {
    showMessage("没有可复制的内容", 2000, "error")
    return
  }
  const ok = await copyToClipboard(translateResult.value)
  if (!ok) showMessage("复制失败", 3000, "error")
}

const setupAutoTranslate = () => {
  clearTimer()

  const text = translateText.value.trim()
  if (text) {
    autoTranslateTimer.value = setTimeout(() => {
      handleTranslate()
    }, AUTO_OPERATION_DELAY)
  }
}

// 监听输入自动翻译
watch(translateText, () => {
  setupAutoTranslate()
})

onUnmounted(() => {
  clearTimer()
})
</script>

<style scoped lang="scss">
@use "../styles/TranslatePanel.scss";
</style>
