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
@use "@/variables.scss" as *;

.translate-mode-content {
  padding: $spacing-4;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.translate-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-3;
  height: 100%;
  min-height: 0;
}

.translate-input-section,
.translate-output-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: $spacing-2;
    margin-bottom: $spacing-2;
    padding-bottom: $spacing-2;
    border-bottom: 1px solid var(--b3-border-color, $brand-subtle-gray);
    flex-shrink: 0;

    .section-title {
      font-weight: $font-weight-semibold;
      font-size: $font-size-sm;
      color: var(--b3-theme-on-background, $brand-dark);
    }

    .language-select {
      min-width: 100px;
    }
  }

  .translate-textarea {
    flex: 1;
    min-height: 160px;
  }

  .translate-result {
    flex: 1;
    padding: $spacing-3;
    background: var(--b3-theme-background, $brand-light);
    border: 1px solid var(--b3-border-color, $brand-subtle-gray);
    border-radius: $vp-radius;
    overflow-y: auto;
    min-height: 160px;
    font-size: $font-size-sm;
    line-height: $line-height-normal;
    color: var(--b3-theme-on-background, $brand-dark);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .translate-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-3;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    min-height: 160px;

    .empty-icon {
      font-size: $font-size-2xl;
      opacity: 0.5;
      line-height: 1;
    }

    p {
      font-size: $font-size-sm;
      opacity: 0.6;
    }
  }

  .input-actions,
  .output-actions {
    display: flex;
    gap: $spacing-2;
    margin-top: $spacing-2;
    justify-content: flex-end;
    flex-shrink: 0;
  }
}

@media (max-width: 480px) {
  .translate-container {
    gap: $spacing-3;
  }
}
</style>
