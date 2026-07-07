<!-- 单词查询主面板 — 集成单词查询、长文翻译、编程翻译、注释生成、代码解释、正则生成 -->
<template>
  <div class="word-query-panel">
    <div class="query-header">
      <div class="mode-tabs">
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'word' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('word')"
        >
          <IconWrapper
            name="wordQuery"
            :size="16"
          />
          {{ props.i18n.wordQuery?.title || '单词查询' }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'translate' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('translate')"
        >
          <IconWrapper
            name="translate"
            :size="16"
          />
          {{ props.i18n.wordQuery?.translation || '长文翻译' }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'codeTranslation' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('codeTranslation')"
        >
          <IconWrapper
            name="codeTranslation"
            :size="16"
          />
          {{ props.i18n.wordQuery?.codeTranslation || '编程翻译' }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'codeComment' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('codeComment')"
        >
          <IconWrapper
            name="codeComment"
            :size="16"
          />
          {{ props.i18n.wordQuery?.codeComment || '注释生成' }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'codeExplain' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('codeExplain')"
        >
          <IconWrapper
            name="search"
            :size="16"
          />
          {{ props.i18n.wordQuery?.codeExplain || '代码解释' }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'regex' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('regex')"
        >
          <IconWrapper
            name="regex"
            :size="16"
          />
          {{ props.i18n.wordQuery?.regexGenerator || '正则生成' }}
        </Button>
      </div>

      <div class="api-key-toggle">
        <Button
          variant="ghost"
          size="xsmall"
          :title="props.i18n.wordQuery?.advancedOptions || '高级选项'"
          @click="togglePanel('advanced')"
        >
          <IconWrapper
            name="generalSettings"
            :size="18"
          />
        </Button>
      </div>
    </div>

    <div
      v-if="currentMode === 'word'"
      class="mode-content"
    >
      <div class="input-section">
        <div class="input-wrapper">
          <Input
            v-model="searchWord"
            class="query-input"
            :placeholder="props.i18n.wordQuery?.enterWordPlaceholder || '输入单词或词语，2秒后自动查询...'"
            @keydown.enter="handleQuery"
          />
          <Button
            class="query-btn"
            :disabled="isLoading"
            :loading="isLoading"
            @click="handleQuery"
          >
            <IconWrapper
              name="search"
              :size="16"
            />
          </Button>
        </div>
      </div>

      <div
        v-if="activePanel"
        :class="`${activePanel}-panel`"
        class="common-panel"
      >
        <div class="panel-header">
          <span class="panel-header-title">
            <IconWrapper
              :name="getPanelConfig(activePanel).iconKey"
              :size="16"
            />
            {{ getPanelConfig(activePanel).title }}
          </span>
          <div class="panel-actions">
            <Button
              variant="ghost"
              size="xsmall"
              @click="togglePanel(null)"
            >
              <IconWrapper
                name="close"
                :size="16"
              />
            </Button>
          </div>
        </div>

        <div
          v-if="activePanel === 'advanced'"
          class="panel-content advanced-content"
        >
          <div class="option-group">
            <label class="option-label">
              <IconWrapper
                name="pronunciation"
                :size="16"
              />
              <span>{{ props.i18n.wordQuery?.pronunciation || '发音设置' }}</span>
            </label>
            <div class="option-row">
              <label class="radio-label">
                <input
                  v-model="pronunciationType"
                  type="radio"
                  value="uk"
                />
                <span>{{ props.i18n.wordQuery?.britishPronunciation || '英式发音' }}</span>
              </label>
              <label class="radio-label">
                <input
                  v-model="pronunciationType"
                  type="radio"
                  value="us"
                />
                <span>{{ props.i18n.wordQuery?.americanPronunciation || '美式发音' }}</span>
              </label>
            </div>
          </div>

          <div class="option-group">
            <label class="checkbox-label">
              <input
                v-model="autoPlayPronunciation"
                type="checkbox"
              />
              <IconWrapper
                name="play"
                :size="16"
              />
              <span>{{ props.i18n.wordQuery?.autoPlayPronunciation || '查询后自动播放发音' }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="query-content">
        <div
          v-if="isLoading"
          class="query-loading"
        >
          <div class="loading-spinner-large"></div>
          <p>{{ props.i18n.wordQuery?.querying || '正在查询...' }}</p>
        </div>

        <div
          v-else-if="errorMessage"
          class="query-error"
        >
          <p>{{ errorMessage }}</p>
        </div>

        <div
          v-else-if="queryResult"
          class="query-result"
        >
          <div
            class="result-content"
            v-html="formattedResult"
          ></div>
          <div class="result-actions">
            <div
              class="dropdown"
              :class="{ active: showCopyOptions }"
            >
              <Button
                variant="secondary"
                size="xsmall"
                @click="toggleCopyOptions"
              >
                <IconWrapper
                  name="contentCopy"
                  :size="16"
                />
                {{ props.i18n.wordQuery?.copy || '复制' }}
                <IconWrapper
                  name="down"
                  :size="12"
                />
              </Button>
              <div
                v-show="showCopyOptions"
                class="dropdown-menu"
              >
                <Button
                  variant="ghost"
                  size="xsmall"
                  class="dropdown-item"
                  @click="copyResult('all')"
                >
                  {{ props.i18n.wordQuery?.copyAll || '复制全部' }}
                </Button>
                <Button
                  variant="ghost"
                  size="xsmall"
                  class="dropdown-item"
                  @click="copyResult('phonetic')"
                >
                  {{ props.i18n.wordQuery?.copyPhonetic || '复制音标' }}
                </Button>
                <Button
                  variant="ghost"
                  size="xsmall"
                  class="dropdown-item"
                  @click="copyResult('meaning')"
                >
                  {{ props.i18n.wordQuery?.copyMeaning || '复制释义' }}
                </Button>
                <Button
                  v-if="extractContentParts.english"
                  variant="ghost"
                  size="xsmall"
                  class="dropdown-item"
                  @click="copyResult('english')"
                >
                  {{ props.i18n.wordQuery?.copyEnglish || '复制英文' }}
                </Button>
                <Button
                  variant="ghost"
                  size="xsmall"
                  class="dropdown-item"
                  @click="copyResult('pronunciation')"
                >
                  {{ props.i18n.wordQuery?.copyPronunciation || '复制谐音' }}
                </Button>
                <Button
                  variant="ghost"
                  size="xsmall"
                  class="dropdown-item"
                  @click="copyResult('example')"
                >
                  {{ props.i18n.wordQuery?.copyExample || '复制例句' }}
                </Button>
              </div>
            </div>

            <Button
              variant="secondary"
              size="xsmall"
              @click="playPronunciation(searchWord)"
            >
              <IconWrapper
                name="play"
                :size="16"
              />
              {{ props.i18n.wordQuery?.play || '播放' }}
            </Button>

            <Button
              variant="secondary"
              size="xsmall"
              @click="exportToSiyuan"
            >
              <IconWrapper
                name="up"
                :size="16"
              />
              {{ props.i18n.wordQuery?.export || '导出' }}
            </Button>

            <Button
              variant="ghost"
              size="xsmall"
              @click="clearResult"
            >
              <IconWrapper
                name="delete"
                :size="16"
              />
              {{ props.i18n.wordQuery?.clear || '清除' }}
            </Button>
          </div>
        </div>

        <div
          v-else
          class="query-empty"
        >
          <div class="empty-icon">
            <IconWrapper
              name="wordQuery"
              :size="48"
            />
          </div>
          <p>{{ props.i18n.wordQuery?.enterWordHint || '输入中英文单词或词语查询释义、音标、谐音等信息' }}</p>
        </div>
      </div>
    </div>

    <div
      v-else-if="currentMode === 'translate'"
      class="mode-content translate-mode"
    >
      <div class="translate-container">
        <div class="translate-input-section">
          <div class="section-header">
            <span class="section-title">{{ props.i18n.wordQuery?.sourceText || '原文' }}</span>
            <Select
              v-model="sourceLanguage"
              :options="LANGUAGE_OPTIONS"
              size="xsmall"
              class="language-select"
            />
          </div>
          <Input
            v-model="translateText"
            type="textarea"
            class="translate-textarea"
            :placeholder="props.i18n.wordQuery?.enterTextToTranslate || '输入要翻译的文本，2秒后自动翻译...'"
            :rows="8"
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
              {{ props.i18n.wordQuery?.clear || '清除' }}
            </Button>
            <Button
              variant="primary"
              size="xsmall"
              :disabled="isTranslating"
              :loading="isTranslating"
              @click="handleTranslate"
            >
              <IconWrapper
                name="translate"
                :size="16"
              />
              {{ isTranslating ? (props.i18n.wordQuery?.translating || '翻译中...') : (props.i18n.wordQuery?.translate || '翻译') }}
            </Button>
          </div>
        </div>

        <div class="translate-divider">
          <div class="divider-line"></div>
          <Button
            variant="ghost"
            size="xsmall"
            class="swap-btn"
            :title="props.i18n.wordQuery?.swapLanguages || '交换语言'"
            @click="swapLanguages"
          >
            <IconWrapper
              name="shuffle"
              :size="16"
            />
          </Button>
          <div class="divider-line"></div>
        </div>

        <div class="translate-output-section">
          <div class="section-header">
            <span class="section-title">{{ props.i18n.wordQuery?.translatedText || '译文' }}</span>
            <Select
              v-model="targetLanguage"
              :options="TARGET_LANGUAGE_OPTIONS"
              size="xsmall"
              class="language-select"
            />
          </div>
          <div
            v-if="translateResult"
            class="translate-result"
          >
            <div class="result-text">
              {{ translateResult }}
            </div>
          </div>
          <div
            v-else
            class="translate-empty"
          >
            <div class="empty-icon">
              <IconWrapper
                name="translate"
                :size="48"
              />
            </div>
            <p>{{ props.i18n.wordQuery?.translationWillAppearHere || '翻译结果将显示在这里' }}</p>
          </div>
          <div
            v-if="translateResult"
            class="output-actions"
          >
            <Button
              variant="ghost"
              size="xsmall"
              @click="copyTranslation"
            >
              <IconWrapper
                name="contentCopy"
                :size="16"
              />
              {{ props.i18n.wordQuery?.copy || '复制' }}
            </Button>
            <Button
              variant="ghost"
              size="xsmall"
              @click="exportTranslation"
            >
              <IconWrapper
                name="up"
                :size="16"
              />
              {{ props.i18n.wordQuery?.export || '导出' }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="currentMode === 'codeTranslation'"
      class="mode-content"
    >
      <CodeTranslationPanel
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
    </div>

    <div
      v-else-if="currentMode === 'codeComment'"
      class="mode-content"
    >
      <CodeCommentGenerator
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
    </div>

    <div
      v-else-if="currentMode === 'codeExplain'"
      class="mode-content"
    >
      <CodeExplainer
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
    </div>

    <div
      v-else-if="currentMode === 'regex'"
      class="mode-content"
    >
      <RegexGenerator
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,

  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import { copyToClipboard as copyToClipboardUtil } from "@/utils/domUtils"
import CodeCommentGenerator from "./components/CodeCommentGenerator.vue"
import CodeExplainer from "./components/CodeExplainer.vue"
import CodeTranslationPanel from "./components/CodeTranslationPanel.vue"
import RegexGenerator from "./components/RegexGenerator.vue"
import { LANGUAGE_MAP } from "./types"
import { WordQueryStorage } from "./types/storage"

interface Props {
  i18n: Record<string, any> & { wordQuery?: Record<string, string> }
  plugin?: Plugin
  onQuery: (word: string) => Promise<string>
  onTranslate?: (
    text: string,
    sourceLang: string,
    targetLang: string,
  ) => Promise<string>
}

const props = defineProps<Props>()

const LANGUAGE_OPTIONS = Object.entries(LANGUAGE_MAP).map(([value, label]) => ({
  value,
  label,
}))

const TARGET_LANGUAGE_OPTIONS = LANGUAGE_OPTIONS.filter(
  (opt) => opt.value !== "auto",
)

const AUTO_OPERATION_DELAY = 2000
const WORD_PATTERN =
  /^[a-z0-9\s\-.,;:!?'"()\u4E00-\u9FA5\u3000-\u303F\uFF00-\uFFEF]+$/i

const FIELD_MAPPINGS = [
  {
    pattern: /(单词|词语)：/,
    class: "word-section",
    label: "$1：",
  },
  {
    pattern: /(拼音|音标)：/,
    class: "phonetic-section",
    label: "$1：",
    contentKey: "phonetic",
    contentPatterns: [/音标：[^\n]+/, /拼音：[^\n]+/],
  },
  {
    pattern: /(英文)：/,
    class: "english-section",
    label: "$1：",
    contentKey: "english",
    contentPatterns: [/英文：[^\n]+/],
  },
  {
    pattern: /(释义)：/,
    class: "meaning-section",
    label: "$1：",
    contentKey: "meaning",
    contentPatterns: [/释义：[^\n]+/],
  },
  {
    pattern: /(谐音)：/,
    class: "pronunciation-section",
    label: "$1：",
    contentKey: "pronunciation",
    contentPatterns: [/谐音：[^\n]+/],
  },
  {
    pattern: /(发音)：/,
    class: "tip-section",
    label: "$1：",
  },
  {
    pattern: /(例句)：/,
    class: "example-section",
    label: "$1：",
    contentKey: "example",
    contentPatterns: [/例句：[\s\S]+/],
  },
]

const currentMode = ref<
  | "word"
  | "translate"
  | "codeTranslation"
  | "codeComment"
  | "codeExplain"
  | "regex"
>("word")
const searchWord = ref("")
const queryResult = ref("")
const isLoading = ref(false)
const errorMessage = ref("")
const showCopyOptions = ref(false)

const translateText = ref("")
const translateResult = ref("")
const isTranslating = ref(false)
const sourceLanguage = ref("auto")
const targetLanguage = ref("zh")

const activePanel = ref<string | null>(null)

const pronunciationType = ref<"uk" | "us">("uk")
const autoPlayPronunciation = ref(false)

const autoQueryTimer = ref<NodeJS.Timeout | null>(null)
const autoTranslateTimer = ref<NodeJS.Timeout | null>(null)

let storage: WordQueryStorage | null = null

const formattedResult = computed(() => {
  if (!queryResult.value) return ""

  let html = queryResult.value
  html = html.replace(/^#### (.+)$/gm, '<h4 class="result-title">$1</h4>')
  html = html.replace(/\n/g, "<br>")

  const firstField = FIELD_MAPPINGS.find((m) => m.pattern.test(html))
  let sectionClass = "result-section"
  let labelReplacement = ""

  if (firstField) {
    sectionClass = `result-section ${firstField.class}`
    labelReplacement = `<div class="${sectionClass}"><span class="result-label">${firstField.label}`
  }

  FIELD_MAPPINGS.forEach((mapping, index) => {
    if (index === 0 && firstField) return
    html = html.replace(
      mapping.pattern,
      `</div><div class="result-section ${mapping.class}"><span class="result-label">${mapping.label}`,
    )
  })

  if (firstField) {
    html = html.replace(firstField.pattern, labelReplacement)
  }

  html = `<div class="result-wrapper">${html}</div>`
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

  return html
})

interface ExtractedParts {
  phonetic?: string
  meaning?: string
  english?: string
  pronunciation?: string
  example?: string
  all?: string
  [key: string]: string | undefined
}

const extractContentParts = computed<ExtractedParts>(() => {
  if (!queryResult.value) return {}

  const content = queryResult.value
  const parts: ExtractedParts = {}

  FIELD_MAPPINGS.forEach((mapping) => {
    if (!mapping.contentKey || !mapping.contentPatterns) return
    for (const pattern of mapping.contentPatterns) {
      const match = content.match(pattern)
      if (match) {
        const label = match[0].split("：")[0]
        parts[mapping.contentKey] = match[0].replace(`${label}：`, "").trim()
        break
      }
    }
  })

  parts.all = content
  return parts
})

const validateInput = (input: string, type: "word" | "text" = "word") => {
  if (!input.trim()) {
    return type === "word" ? "请输入单词" : "请输入文本"
  }

  if (type === "word" && !WORD_PATTERN.test(input)) {
    return "请输入有效的单词或词语"
  }

  return null
}

const handleQuery = async () => {
  const word = searchWord.value.trim()
  const error = validateInput(word, "word")
  if (error) {
    errorMessage.value = error
    return
  }

  isLoading.value = true
  errorMessage.value = ""

  try {
    const result = await props.onQuery(word)
    if (result) {
      queryResult.value = result
      if (autoPlayPronunciation.value) {
        playPronunciation(word)
      }
    } else {
      errorMessage.value =
        props.i18n.wordQuery?.queryFailed || "查询失败,请重试"
    }
  } catch (error) {
    console.error("Query error:", error)
    errorMessage.value =
      (error as Error).message
      || props.i18n.wordQuery?.unknownError
      || "未知错误"
  } finally {
    isLoading.value = false
  }
}

const togglePanel = (panelKey: string | null) => {
  activePanel.value = activePanel.value === panelKey ? null : panelKey
}

const playPronunciation = (word: string) => {
  try {
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = pronunciationType.value === "uk" ? "en-GB" : "en-US"
    utterance.rate = 0.8
    speechSynthesis.speak(utterance)
  } catch (error) {
    console.error("Failed to play pronunciation:", error)
  }
}

const exportToSiyuan = async () => {
  if (!queryResult.value) {
    showMessage("没有可导出的内容", 2000, "error")
    return
  }

  const word = searchWord.value.trim()
  const content = `## ${word}\n\n${queryResult.value}`
  const ok = await copyToClipboardUtil(content)
  if (!ok) showMessage(props.i18n.wordQuery?.exportFailed || "导出失败", 3000, "error")
}

const advancedOptionsData = computed(() => ({
  pronunciationType: pronunciationType.value,
  autoPlayPronunciation: autoPlayPronunciation.value,
}))

const saveAdvancedOptions = async () => {
  if (storage) {
    await storage.settings.save(advancedOptionsData.value)
  }
}

const loadAdvancedOptions = async () => {
  if (storage) {
    const settings = await storage.settings.loadOrDefault()
    pronunciationType.value = settings.pronunciationType
    autoPlayPronunciation.value = settings.autoPlayPronunciation
  }
}

const clearTimer = (timerRef: Ref<NodeJS.Timeout | null>) => {
  if (timerRef.value) {
    clearTimeout(timerRef.value)
    timerRef.value = null
  }
}

const setupAutoQuery = () => {
  clearTimer(autoQueryTimer)

  const word = searchWord.value.trim()
  if (word && WORD_PATTERN.test(word)) {
    autoQueryTimer.value = setTimeout(() => {
      handleQuery()
    }, AUTO_OPERATION_DELAY)
  }
}

const setupAutoTranslate = () => {
  clearTimer(autoTranslateTimer)

  const text = translateText.value.trim()
  if (text && !isTranslating.value) {
    autoTranslateTimer.value = setTimeout(() => {
      handleTranslate()
    }, AUTO_OPERATION_DELAY)
  }
}

const toggleCopyOptions = () => {
  showCopyOptions.value = !showCopyOptions.value
}

const copyResult = async (type: string = "all") => {
  let textToCopy = ""
  let hasContent = false

  if (type === "all") {
    textToCopy = extractContentParts.value.all || queryResult.value
    hasContent = !!textToCopy
  } else {
    textToCopy = extractContentParts.value[type] || ""
    hasContent = !!textToCopy
  }

  if (!hasContent) {
    showMessage("没有找到要复制的内容", 2000, "error")
    return
  }

  const ok = await copyToClipboardUtil(textToCopy)
  if (ok) {
    showCopyOptions.value = false
  } else {
    showMessage(props.i18n.wordQuery?.copyFailed || "复制失败", 3000, "error")
  }
}

const clearResult = () => {
  queryResult.value = ""
  errorMessage.value = ""
}

const switchMode = (
  mode:
    | "word"
    | "translate"
    | "codeTranslation"
    | "codeComment"
    | "codeExplain"
    | "regex",
) => {
  currentMode.value = mode
  activePanel.value = null
}

const handleTranslate = async () => {
  const text = translateText.value.trim()
  const error = validateInput(text, "text")
  if (error) {
    showMessage(error, 2000, "error")
    return
  }

  isTranslating.value = true
  translateResult.value = ""

  try {
    if (props.onTranslate) {
      const result = await props.onTranslate(
        text,
        sourceLanguage.value,
        targetLanguage.value,
      )
      translateResult.value = result
    } else {
      const prompt = `请将以下${sourceLanguage.value === "auto" ? "" : getLanguageName(sourceLanguage.value)}文本翻译成${getLanguageName(targetLanguage.value)}，只输出翻译结果，不要有其他说明：\n\n${text}`
      const result = await props.onQuery(prompt)
      translateResult.value = result
    }
  } catch (error) {
    console.error("Translation error:", error)
    showMessage(`翻译失败: ${(error as Error).message}`, 3000, "error")
  } finally {
    isTranslating.value = false
  }
}

const panelConfig = computed(() => ({
  advanced: {
    iconKey: "settings" as const,
    title: (props.i18n.wordQuery?.advancedOptions as string) || "高级选项",
  },
}))

const getPanelConfig = (panel: string) => {
  return (
    panelConfig.value[panel as keyof typeof panelConfig.value] || {
      iconKey: "settings",
      title: "",
    }
  )
}

const getLanguageName = (code: string): string => {
  return LANGUAGE_MAP[code] || code
}

const swapLanguages = () => {
  if (sourceLanguage.value === "auto") {
    showMessage("自动检测模式无法交换", 2000, "info")
    return
  }
  const temp = sourceLanguage.value
  sourceLanguage.value = targetLanguage.value
  targetLanguage.value = temp

  const tempText = translateText.value
  translateText.value = translateResult.value
  translateResult.value = tempText
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
  const ok = await copyToClipboardUtil(translateResult.value)
  if (!ok) showMessage("复制失败", 3000, "error")
}

const exportTranslation = async () => {
  if (!translateResult.value) {
    showMessage("没有可导出的内容", 2000, "error")
    return
  }

  const content = `## 翻译结果\n\n### 原文 (${getLanguageName(sourceLanguage.value)})\n${translateText.value}\n\n### 译文 (${getLanguageName(targetLanguage.value)})\n${translateResult.value}`
  const ok = await copyToClipboardUtil(content)
  if (!ok) showMessage("导出失败", 3000, "error")
}

const handleKeyDown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    if (currentMode.value === "word") {
      handleQuery()
    } else {
      handleTranslate()
    }
  }
  if (event.key === "Escape") {
    clearResult()
    showCopyOptions.value = false
  }
}

const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target.closest(".dropdown")) {
    showCopyOptions.value = false
  }
}

watch(searchWord, () => {
  setupAutoQuery()
})

watch(translateText, () => {
  setupAutoTranslate()
})

watch(
  [pronunciationType, autoPlayPronunciation],
  async () => {
    await saveAdvancedOptions()
  },
)

const waitForPlugin = async (maxRetries = 20) => {
  for (let i = 0; i < maxRetries; i++) {
    if (props.plugin) return true
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return false
}

const initializeData = async () => {
  const pluginReady = await waitForPlugin()
  if (!pluginReady) return

  try {
    if (props.plugin) {
      storage = new WordQueryStorage(props.plugin)
      await storage.init()
      await loadAdvancedOptions()
    }
  } catch (error) {
    console.error("[WordQuery] Failed to load data:", error)
  }
}

onMounted(async () => {
  document.addEventListener("keydown", handleKeyDown)
  document.addEventListener("click", handleClickOutside)

  setTimeout(initializeData, 100)
})

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown)
  document.removeEventListener("click", handleClickOutside)

  speechSynthesis.cancel()
  autoQueryTimer.value && clearTimeout(autoQueryTimer.value)
  autoTranslateTimer.value && clearTimeout(autoTranslateTimer.value)
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
