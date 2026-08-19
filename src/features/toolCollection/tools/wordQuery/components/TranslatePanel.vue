<!-- 翻译面板 — 源文本输入 + 语言选择 + 译文输出 -->
<template>
  <div class="translate-panel">
    <div class="translate-toolbar">
      <div class="language-bar">
        <div class="language-item">
          <span class="language-label">{{ i18n.sourceText || '原文' }}</span>
          <Select
            v-model="sourceLanguage"
            :options="SOURCE_LANGUAGE_OPTIONS"
            size="xsmall"
            placement="bottom"
            class="language-select"
          />
        </div>

        <Button
          class="swap-btn"
          variant="ghost"
          size="xsmall"
          icon-position="right"
          :title="i18n.swapLanguages || '交换语言'"
          :disabled="sourceLanguage === 'auto'"
          @click="swapLanguages"
        >
          <IconWrapper
            name="swapVertical"
            :size="16"
          />
        </Button>

        <div class="language-item">
          <span class="language-label">{{ i18n.translatedText || '译文' }}</span>
          <Select
            v-model="targetLanguage"
            :options="TARGET_LANGUAGE_OPTIONS"
            size="xsmall"
            placement="bottom"
            class="language-select"
          />
        </div>
      </div>
    </div>

    <div class="translate-body">
      <div class="translate-source">
        <div class="source-actions">
          <span class="char-count">
            {{ translateText.length }} / {{ MAX_TRANSLATE_LENGTH }}
          </span>
          <Button
            variant="ghost"
            size="xsmall"
            :disabled="!translateText && !translateResult"
            @click="clearTranslateInput"
          >
            <IconWrapper
              name="delete"
              :size="14"
            />
            {{ i18n.clear || '清除' }}
          </Button>
        </div>
        <Input
          v-model="translateText"
          type="textarea"
          class="translate-textarea"
          :placeholder="i18n.enterTextToTranslate || '输入要翻译的文本，2秒后自动翻译...'"
          :maxlength="MAX_TRANSLATE_LENGTH"
          :clearable="false"
          :autosize="true"
          :min-rows="5"
          :max-rows="10"
        />
      </div>

      <div class="translate-result-panel">
        <div class="result-header">
          <span class="result-title">
            <IconWrapper
              name="translate"
              :size="14"
            />
            {{ i18n.translatedText || '译文' }}
          </span>
          <Button
            v-if="translateResult"
            variant="ghost"
            size="xsmall"
            @click="copyTranslation"
          >
            <IconWrapper
              name="contentCopy"
              :size="14"
            />
            {{ i18n.copy || '复制' }}
          </Button>
        </div>

        <div
          v-if="isTranslating"
          class="translate-state is-loading"
        >
          <div class="loading-spinner" />
          <p>{{ i18n.translating || '翻译中...' }}</p>
        </div>

        <div
          v-else-if="translateError"
          class="translate-state is-error"
        >
          <IconWrapper
            name="error"
            :size="20"
          />
          <p>{{ translateError }}</p>
        </div>

        <div
          v-else-if="translateResult"
          class="translate-result"
        >
          {{ translateResult }}
        </div>

        <div
          v-else
          class="translate-state is-empty"
        >
          <IconWrapper
            name="translate"
            :size="24"
          />
          <p>{{ i18n.translationWillAppearHere || '翻译结果将显示在这里' }}</p>
        </div>
      </div>
    </div>

    <div class="translate-footer">
      <Button
        variant="primary"
        size="xsmall"
        :loading="isTranslating"
        :disabled="!translateText.trim()"
        @click="handleTranslate"
      >
        <IconWrapper
          name="translate"
          :size="16"
        />
        {{ isTranslating ? (i18n.translating || '翻译中...') : (i18n.translate || '翻译') }}
      </Button>
      <span
        v-if="autoTranslateHint"
        class="auto-hint"
      >
        <IconWrapper
          name="timerOutline"
          :size="12"
        />
        {{ autoTranslateHint }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WordQueryComponentProps } from "../types"
import { showMessage } from "siyuan"
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { getApiConfigFromPlugin } from "@/utils/aiApi"
import { copyToClipboard } from "@/utils/domUtils"
import { LANGUAGE_MAP } from "../types"
import {
  buildTranslatePrompt,
  callWordQueryAPI,
} from "../utils/api"

const props = defineProps<WordQueryComponentProps>()

const i18n = props.i18n || {}

const MAX_TRANSLATE_LENGTH = 2000
const AUTO_OPERATION_DELAY = 2000

const SOURCE_LANGUAGE_OPTIONS = Object.entries(LANGUAGE_MAP).map(
  ([value, label]) => ({
    value,
    label,
  }),
)

const TARGET_LANGUAGE_OPTIONS = SOURCE_LANGUAGE_OPTIONS.filter(
  (opt) => opt.value !== "auto",
)

const translateText = ref("")
const translateResult = ref("")
const translateError = ref("")
const isTranslating = ref(false)
const sourceLanguage = ref("auto")
const targetLanguage = ref("zh")

const autoTranslateTimer = ref<NodeJS.Timeout | null>(null)
let abortController: AbortController | null = null
/** 请求序号：防止旧请求覆盖新结果 */
let requestSeq = 0

const autoTranslateHint = computed<string>(() => {
  if (!translateText.value.trim()) return ""
  if (isTranslating.value) return i18n.translating || "翻译中..."
  return i18n.enterTextToTranslate || "输入要翻译的文本，2秒后自动翻译..."
})

const clearTimer = (): void => {
  if (autoTranslateTimer.value) {
    clearTimeout(autoTranslateTimer.value)
    autoTranslateTimer.value = null
  }
}

const clearTranslateError = (): void => {
  translateError.value = ""
}

const handleTranslate = async (): Promise<void> => {
  const text = translateText.value.trim()
  if (!text) {
    showMessage(i18n.enterTextPlease || "请输入文本", 2000, "error")
    return
  }

  // 取消上一次未完成的请求，避免竞态覆盖
  abortController?.abort()
  abortController = new AbortController()
  const currentSeq = ++requestSeq

  isTranslating.value = true
  clearTranslateError()

  try {
    const config = getApiConfigFromPlugin(props.plugin)
    const prompt = buildTranslatePrompt(
      text,
      sourceLanguage.value,
      targetLanguage.value,
    )
    const result = await callWordQueryAPI(prompt, config, {
      signal: abortController.signal,
    })

    // 仅当没有更新的请求发起时才写入结果
    if (currentSeq !== requestSeq) return

    translateResult.value = result
  } catch (error) {
    // 主动取消不算错误
    if ((error as Error).name === "AbortError") return

    console.error("Translation error:", error)
    translateError.value = `${i18n.translateFailed || "翻译失败"}：${(error as Error).message}`
    showMessage(translateError.value, 3000, "error")
  } finally {
    if (currentSeq === requestSeq) {
      isTranslating.value = false
      abortController = null
    }
  }
}

const clearTranslateInput = (): void => {
  clearTimer()
  abortController?.abort()
  abortController = null
  requestSeq += 1
  translateText.value = ""
  translateResult.value = ""
  translateError.value = ""
  isTranslating.value = false
}

const copyTranslation = async (): Promise<void> => {
  if (!translateResult.value) {
    showMessage("没有可复制的内容", 2000, "error")
    return
  }
  const ok = await copyToClipboard(translateResult.value)
  if (ok) {
    showMessage(i18n.copySuccess || "已复制到剪贴板", 1500, "info")
  } else {
    showMessage(i18n.copyFailed || "复制失败", 3000, "error")
  }
}

const scheduleAutoTranslate = (delay: number): void => {
  clearTimer()
  autoTranslateTimer.value = setTimeout(() => {
    handleTranslate()
  }, delay)
}

const swapLanguages = (): void => {
  if (sourceLanguage.value === "auto") {
    showMessage(i18n.autoDetectCannotSwap || "自动检测语言无法交换", 2000, "error")
    return
  }

  const nextTarget = sourceLanguage.value
  sourceLanguage.value = targetLanguage.value
  targetLanguage.value = nextTarget

  // 交换后若两侧都有内容，重新翻译
  if (translateText.value.trim()) {
    scheduleAutoTranslate(0)
  }
}

const setupAutoTranslate = (): void => {
  clearTimer()
  clearTranslateError()

  const text = translateText.value.trim()
  if (!text) {
    // 输入清空时同步清空结果，避免旧结果残留
    translateResult.value = ""
    return
  }
  scheduleAutoTranslate(AUTO_OPERATION_DELAY)
}

// 监听输入自动翻译
watch(translateText, () => {
  setupAutoTranslate()
})

// 语言切换后，若有内容则立即重新翻译
watch([sourceLanguage, targetLanguage], () => {
  if (translateText.value.trim()) {
    scheduleAutoTranslate(0)
  }
})

onUnmounted(() => {
  clearTimer()
  abortController?.abort()
})
</script>

<style scoped lang="scss">
@use "../styles/TranslatePanel.scss";
</style>
