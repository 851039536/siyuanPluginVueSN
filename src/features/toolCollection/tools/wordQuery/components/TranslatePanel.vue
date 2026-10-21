<!-- 翻译面板 — 语言自动识别（中↔英）、长文分段翻译、源/译对照输出 -->
<template>
  <div class="translate-panel">
    <!-- 语言栏：源语言 ↔ 目标语言（目标可为「自动」，译为另一种语言） -->
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
          <span
            v-if="detectedHint"
            class="language-hint"
          >
            <IconWrapper
              name="info"
              :size="12"
            />
            {{ detectedHint }}
          </span>
        </div>

        <Button
          class="swap-btn"
          variant="ghost"
          size="xsmall"
          icon-position="right"
          :title="i18n.swapLanguages || '交换语言'"
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
          <span
            v-if="targetHint"
            class="language-hint"
          >
            <IconWrapper
              name="translate"
              :size="12"
            />
            {{ targetHint }}
          </span>
        </div>
      </div>

      <!-- 源语言与目标语言相同（如中文原文译成中文）时给出纠正入口 -->
      <div
        v-if="sameLanguage"
        class="language-warning"
      >
        <IconWrapper
          name="warning"
          :size="14"
        />
        <span class="language-warning-text">{{ i18n.sameLanguageWarning || '原文与目标语言相同，译文将原样返回' }}</span>
        <Button
          variant="ghost"
          size="xsmall"
          @click="useOtherLanguage"
        >
          {{ useOtherLanguageLabel }}
        </Button>
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
        <Textarea
          v-model="translateText"
          class="translate-textarea"
          size="small"
          :placeholder="i18n.enterTextToTranslate || '输入要翻译的文本，2秒后自动翻译...'"
          :maxlength="MAX_TRANSLATE_LENGTH"
          :auto-resize="true"
          :min-rows="4"
          :max-rows="12"
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
            <span
              v-if="resultLanguageLabel"
              class="result-language"
            >{{ resultLanguageLabel }}</span>
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
          <p>{{ translatingText }}</p>
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
import Select from "@/components/Select.vue"
import Textarea from "@/components/Textarea.vue"
import { getApiConfigFromPlugin } from "@/utils/aiApi"
import { copyToClipboard } from "@/utils/domUtils"
import { LANGUAGE_MAP } from "../types"
import {
  buildTranslatePrompt,
  callTranslateAPI,
} from "../utils/api"
import {
  detectLanguage,
  languageLabel,
  oppositeLanguage,
  resolveLanguages,
  splitTextChunks,
} from "../utils/languageDetect"

const props = defineProps<WordQueryComponentProps>()

const i18n = props.i18n || {}

/** 分段翻译进度（null = 非分段或未开始） */
interface TranslateProgress {
  current: number
  total: number
}

/** 原文最大字符数（长文翻译，超越单次请求的部分自动分段） */
const MAX_TRANSLATE_LENGTH = 8000
/** 输入后自动翻译的防抖时长 */
const AUTO_OPERATION_DELAY = 2000

/** 源语言选项：自动检测 + 各语种（名称走 i18n 本地化） */
const SOURCE_LANGUAGE_OPTIONS = Object.keys(LANGUAGE_MAP).map((value) => ({
  value,
  label: languageLabel(value, i18n),
}))

/** 目标语言选项：首位为「自动（译为另一种语言）」，其余为具体语种 */
const TARGET_LANGUAGE_OPTIONS = [
  {
    value: "auto",
    label: i18n.autoTargetLanguage || "自动（译为另一种语言）",
  },
  ...SOURCE_LANGUAGE_OPTIONS.filter((opt) => opt.value !== "auto"),
]

const translateText = ref("")
const translateResult = ref("")
const translateError = ref("")
const isTranslating = ref(false)
const sourceLanguage = ref("auto")
/** 目标语言默认「自动」：输入中文译成英文，输入英文译成中文 */
const targetLanguage = ref("auto")

const autoTranslateTimer = ref<NodeJS.Timeout | null>(null)
let abortController: AbortController | null = null
/** 请求序号：防止旧请求覆盖新结果 */
let requestSeq = 0
/** 分段翻译进度（null = 非分段或未开始） */
const translateProgress = ref<TranslateProgress | null>(null)

/** 原文语言检测结果 */
const detectedLanguage = computed(() => detectLanguage(translateText.value))

/** 实际生效的源 / 目标语言 */
const resolved = computed(() =>
  resolveLanguages({
    source: sourceLanguage.value,
    target: targetLanguage.value,
    detected: detectedLanguage.value,
  }),
)

/** 源与目标同语言（中文原文译成中文这类无意义请求） */
const sameLanguage = computed(() => resolved.value.sameLanguage)

/** 检测提示：源为自动且已识别出语种时展示 */
const detectedHint = computed(() => {
  if (sourceLanguage.value !== "auto") return ""
  if (detectedLanguage.value === "unknown") return ""
  return `${i18n.detectedLanguage || "检测到"}：${languageLabel(detectedLanguage.value, i18n)}`
})

/** 目标提示：目标为自动时展示实际译向 */
const targetHint = computed(() => {
  if (targetLanguage.value !== "auto") return ""
  return `${i18n.translateTo || "译为"}：${languageLabel(resolved.value.target, i18n)}`
})

/** 译文结果的语言标注（便于长文对照阅读） */
const resultLanguageLabel = computed(() => {
  if (!translateResult.value) return ""
  return languageLabel(resolved.value.target, i18n)
})

/** 源语言冲突时的一键纠正文案（如「改为英文」） */
const useOtherLanguageLabel = computed(() => {
  const other = oppositeLanguage(resolved.value.source)
  return `${i18n.switchTo || "改为"}${languageLabel(other, i18n)}`
})

/** 翻译中的提示文案：分段翻译时附带进度 */
const translatingText = computed(() => {
  const progress = translateProgress.value
  if (!progress) return i18n.translating || "翻译中..."
  return (i18n.chunkProgress || "分段翻译中（{current}/{total}）")
    .replace("{current}", String(progress.current))
    .replace("{total}", String(progress.total))
})

const autoTranslateHint = computed<string>(() => {
  if (!translateText.value.trim()) return ""
  if (isTranslating.value) return translatingText.value
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
  translateProgress.value = null
  clearTranslateError()

  const { source, target } = resolved.value

  try {
    const config = getApiConfigFromPlugin(props.plugin)
    // 长文按段落分段翻译，逐段拼接
    const chunks = splitTextChunks(text)
    const results: string[] = []

    for (let index = 0; index < chunks.length; index += 1) {
      if (currentSeq !== requestSeq) return
      if (chunks.length > 1) {
        translateProgress.value = { current: index + 1, total: chunks.length }
      }

      const prompt = buildTranslatePrompt(chunks[index], source, target, {
        partial: chunks.length > 1,
      })
      const result = await callTranslateAPI(prompt, config, {
        signal: abortController.signal,
      })
      results.push(result)
    }

    // 仅当没有更新的请求发起时才写入结果
    if (currentSeq !== requestSeq) return

    translateResult.value = results.join("\n\n")
  } catch (error) {
    // 主动取消不算错误
    if ((error as Error).name === "AbortError") return

    console.error("Translation error:", error)
    translateError.value = `${i18n.translateFailed || "翻译失败"}：${(error as Error).message}`
    showMessage(translateError.value, 3000, "error")
  } finally {
    if (currentSeq === requestSeq) {
      isTranslating.value = false
      translateProgress.value = null
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
  translateProgress.value = null
}

const copyTranslation = async (): Promise<void> => {
  if (!translateResult.value) {
    showMessage(i18n.noCopyContent || "没有可复制的内容", 2000, "error")
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

/**
 * 交换语言：按「当前解析后的实际语言」反向
 * （源为自动时使用检测结果，无法识别语种时给出提示）
 */
const swapLanguages = (): void => {
  const { source, target } = resolved.value
  if (source === "auto") {
    showMessage(i18n.autoDetectCannotSwap || "自动检测语言无法交换", 2000, "error")
    return
  }

  sourceLanguage.value = target
  targetLanguage.value = source
}

/** 源语言冲突时改为另一种语言 */
const useOtherLanguage = (): void => {
  targetLanguage.value = oppositeLanguage(resolved.value.source)
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

// 检测结果导致的目标语言变化（如中文改英文）同样需要重新翻译
watch(
  () => resolved.value.target,
  () => {
    if (translateText.value.trim() && targetLanguage.value === "auto") {
      scheduleAutoTranslate(0)
    }
  },
)

onUnmounted(() => {
  clearTimer()
  abortController?.abort()
})
</script>

<style scoped lang="scss">
@use "../styles/TranslatePanel.scss";
</style>
