<!-- 谐音翻译弹窗组件：输入中英文自动生成谐音记忆，支持从单词本查询或 AI 生成 -->
<template>
  <div
    v-if="visible"
    class="pronunciation-overlay"
    @click.self="closeDialog"
  >
    <div class="pronunciation-dialog">
      <!-- 对话框头部 -->
      <div class="dialog-header">
        <div class="dialog-title">
          <IconWrapper
            name="sparkles"
            color="inherit"
            class="dialog-icon"
          />
          <!-- 弹窗标题："谐音翻译" -->
          <span>{{ t('pronunciationHelp', '谐音翻译') }}</span>
        </div>
        <Button
          variant="ghost"
          size="xsmall"
          icon="x"
          :title="t('close', '关闭')"
          @click="closeDialog"
        />
      </div>

      <!-- 对话框内容 -->
      <div class="dialog-body">
        <!-- 输入区域：输入框与生成按钮横排 -->
        <div class="input-section">
          <Input
            v-model="inputWord"
            class="input-main"
            size="small"
            :placeholder="t('inputPlaceholder', '输入中文或英文...')"
            @keyup.enter="generatePronunciation"
          />
          <!-- 生成按钮：生成中显示加载动画，悬停提示"生成谐音" -->
          <Button
            class="btn-generate"
            :disabled="!inputWord || isGenerating"
            :title="isGenerating ? t('generating', '生成中...') : t('generateTitle', '生成谐音')"
            variant="primary"
            size="small"
            icon="refresh"
            :loading="isGenerating"
            @click="generatePronunciation"
          />
        </div>

        <!-- 结果展示 -->
        <div
          v-if="result"
          class="result-section"
        >
          <div class="result-header">
            <div class="result-title">
              <!-- 标签："谐音记忆" -->
              <Label
                tag="span"
                size="xsmall"
                icon="wordQuery"
                class="result-label"
              >
                {{ t('resultTitle', '谐音记忆') }}
              </Label>
              <!-- 来源标识："来自单词本" / "AI生成" -->
              <span
                class="source-badge"
                :class="{ local: isFromLocal }"
              >
                {{ isFromLocal ? t('sourceLocal', '来自单词本') : t('sourceAI', 'AI生成') }}
              </span>
            </div>
            <!-- 结果动作：仅 AI 生成的结果可添加到单词本 -->
            <div
              v-if="!isFromLocal"
              class="result-actions"
            >
              <!-- 按钮："添加到单词本" -->
              <Button
                variant="ghost"
                size="xsmall"
                icon="plus"
                :title="t('addToCard', '添加到单词本')"
                @click="openAddToCardDialog"
              >
                {{ t('addToCard', '添加到单词本') }}
              </Button>
            </div>
          </div>
          <!-- 谐音结果内容 -->
          <div
            class="result-content"
            v-html="formatResult(result.text)"
          ></div>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="!isGenerating"
          class="empty-state"
        >
          <div class="empty-icon">
            <svg
              viewBox="0 0 24 24"
              width="48"
              height="48"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <!-- 空状态提示："输入单词或短语以生成谐音记忆" -->
          <p class="empty-text">
            {{ t('emptyText', '输入单词或短语以生成谐音记忆') }}
          </p>
        </div>

        <!-- 加载状态 -->
        <div
          v-if="isGenerating"
          class="loading-wrapper"
        >
          <Loader />
        </div>
      </div>

      <!-- 对话框底部：右对齐紧凑按钮 -->
      <div class="dialog-footer">
        <!-- 按钮："复制结果" -->
        <Button
          variant="secondary"
          icon="copy"
          :disabled="!result"
          @click="copyResult"
        >
          {{ t('copyResult', '复制结果') }}
        </Button>
        <!-- 按钮："关闭" -->
        <Button
          variant="primary"
          @click="closeDialog"
        >
          {{ t('close', '关闭') }}
        </Button>
      </div>
    </div>

    <!-- 添加到单词本对话框 -->
    <div
      v-if="showAddToCardDialog"
      class="dialog-overlay add-card-overlay"
      @click.self="showAddToCardDialog = false"
    >
      <div
        class="add-card-dialog"
        @click.stop
      >
        <div class="add-card-header">
          <!-- 弹窗标题："添加到单词本" -->
          <h4>{{ t('addCardTitle', '添加到单词本') }}</h4>
          <Button
            variant="ghost"
            size="xsmall"
            icon="x"
            @click="showAddToCardDialog = false"
          />
        </div>
        <div class="add-card-body">
          <div class="add-card-info">
            <div class="info-item">
              <!-- 标签："单词:" -->
              <span class="info-label">{{ t('wordLabel', '单词:') }}</span>
              <span class="info-value">{{ inputWord }}</span>
            </div>
          </div>
          <div class="form-group">
            <Select
              v-model="selectedCategory"
              :label="t('selectCategory', '选择类别')"
              :placeholder="t('selectCategoryPlaceholder', '请选择类别')"
              :options="categoryOptions"
            />
            <Input
              v-if="selectedCategory === '__custom__'"
              v-model="customCategoryInput"
              :placeholder="t('customCategoryPlaceholder', '输入自定义类别')"
            />
          </div>
        </div>
        <div class="add-card-footer">
          <!-- 按钮："取消" -->
          <Button
            variant="secondary"
            @click="showAddToCardDialog = false"
          >
            {{ t('cancel', '取消') }}
          </Button>
          <!-- 按钮："添加" -->
          <Button
            variant="primary"
            :disabled="!selectedCategory || (selectedCategory === '__custom__' && !customCategoryInput)"
            @click="addToFlashcard"
          >
            {{ t('add', '添加') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import type { Flashcard } from "@/utils/sharedStorage/flashcardStorage"
import type PluginSample from "@/index"
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import Label from "@/components/Label.vue"
import Loader from "@/components/Loader.vue"
import Select from "@/components/Select.vue"
import {
  ERR_TITLE_EXISTS,
  FlashcardStorage,
} from "@/utils/sharedStorage/flashcardStorage"
import {
  callAI,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"
import { copyToClipboard, simpleHtmlEscape } from "@/utils/domUtils"
import { emitCustomEvent } from "@/utils/eventBus"
import { getErrorMessage } from "@/utils/stringUtils"
import { showMessage } from "@/features/floatingToolbar/core/utils"

interface PronunciationI18n {
  pronunciationHelp?: string
  close?: string
  inputLabel?: string
  inputPlaceholder?: string
  generateTitle?: string
  generating?: string
  generateBtn?: string
  resultTitle?: string
  sourceAI?: string
  sourceLocal?: string
  addToCard?: string
  copyResult?: string
  emptyText?: string
  addCardTitle?: string
  wordLabel?: string
  selectCategory?: string
  selectCategoryPlaceholder?: string
  customCategory?: string
  customCategoryPlaceholder?: string
  cancel?: string
  add?: string
  msgInputRequired?: string
  msgLoadFromLocal?: string
  msgGenerated?: string
  msgGenerateFailed?: string
  msgGenerateError?: string
  msgUnknownError?: string
  msgIncompleteData?: string
  msgSelectCategory?: string
  msgAdded?: string
  msgTitleExists?: string
  msgAddFailed?: string
  msgCopySuccess?: string
  msgCopyFailed?: string
  [key: string]: string | undefined
}

interface Props {
  visible: boolean
  content?: string
  plugin?: PluginSample
  i18n?: PronunciationI18n
}

interface Emits {
  (e: "update:visible", value: boolean): void
  (e: "close"): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({} as PronunciationI18n),
})

const emit = defineEmits<Emits>()

/** 安全获取 i18n 文本 */
function t(key: string, fallback: string): string {
  return (props.i18n as PronunciationI18n)?.[key] || fallback
}

// 状态
const inputWord = ref(props.content || "")
const isGenerating = ref(false)
/** 生成结果及其来源（null 表示暂无结果） */
const result = ref<{ text: string; source: "local" | "api" } | null>(null)
const showAddToCardDialog = ref(false)
const selectedCategory = ref("")
const customCategoryInput = ref("")

/** 默认选中的类别 */
const DEFAULT_CATEGORY = "编程单词"
/** 默认类别列表 */
const DEFAULT_CATEGORIES = [
  "C#",
  DEFAULT_CATEGORY,
  "JavaScript",
  "TypeScript",
  "Vue",
  "Rust",
] as const

const availableCategories = ref<string[]>([...DEFAULT_CATEGORIES])

const categoryOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = [
    {
      value: "",
      label: t("selectCategoryPlaceholder", "请选择类别"),
    },
    {
      value: "__custom__",
      label: t("customCategory", "自定义..."),
    },
  ]
  availableCategories.value.forEach((cat) => {
    options.push({
      value: cat,
      label: cat,
    })
  })
  return options
})

// 初始化 FlashcardStorage（plugin 缺失时降级为纯 AI 生成）
const flashcardStorage = props.plugin
  ? new FlashcardStorage(props.plugin)
  : null

/** 组件级卡片缓存（本弹窗单实例挂载），卸载时释放 */
let cardsCache: Flashcard[] | null = null
let cardsCacheTimestamp = 0
const CARDS_CACHE_TTL_MS = 30000

/** 生成请求序号：输入切换后使进行中的旧请求失效，避免旧词结果写入新输入 */
let generateSeq = 0

// 结果是否来自本地单词本（控制来源徽章与"添加到单词本"按钮显隐）
const isFromLocal = computed(() => result.value?.source === "local")

// 监听props变化，弹窗可见时自动触发翻译
watch(
  () => [props.content, props.visible] as const,
  async ([newContent, newVisible], [oldContent, oldVisible]) => {
    if (!newVisible || !newContent) return
    // 仅在 content 变化或 visible 从 false→true 时触发，避免重复
    const contentChanged = newContent !== oldContent
    const visibleOpened = !oldVisible && newVisible
    if (!contentChanged && !visibleOpened) return
    inputWord.value = newContent
    result.value = null
    generateSeq++
    await nextTick()
    await generatePronunciation()
  },
)

// 选择"自定义..."时清空输入框
watch(selectedCategory, (val) => {
  if (val === "__custom__") {
    customCategoryInput.value = ""
  }
})

// 检测是否为中文
function isChinese(text: string): boolean {
  return /[\u4E00-\u9FA5]/.test(text)
}

// 谐音生成的系统提示词
const PRONUNCIATION_SYSTEM_PROMPT =
  "你是一个专业的英语教学助手，擅长用中文谐音帮助学习者记忆英语单词发音，也能准确翻译中文词语为英文。"

// 中英文分支公共后缀（注意事项后 4 行）
const PROMPT_SUFFIX = `
- 谐音要贴近实际发音，便于记忆
- 拼音必须带声调
- 发音说明要包含音节、重音、元音特点等
- 只输出格式化内容，不要有其他说明文字`

// 构建提示词（根据输入语言自动选择）
function buildPrompt(text: string): string {
  if (isChinese(text)) {
    return `请将中文词语 "${text}" 翻译成英文，并为英文翻译生成谐音记忆，要求：

1. 提供准确的英文翻译
2. 提供英式音标
3. 为英文翻译生成中文谐音记忆
4. 谐音使用带声调的拼音标注
5. 严格按照以下格式输出：

中文：${text}
英文：[英文翻译]
音标：[英式音标]
谐音：[中文谐音(使用英式自然发音,带拼音标注),如:西斯腾(xī sī téng)]
发音：[发音要点说明]

注意事项：
- 提供最常用的英文翻译
- 音标使用英式标准${PROMPT_SUFFIX}`
  }

  return `请为英文单词 "${text}" 生成谐音记忆，要求：

1. 使用英式标准发音
2. 谐音使用带声调的拼音标注
3. 严格按照以下格式输出：

单词：${text}
音标：[英式音标]
释义：[中文释义]
谐音：[中文谐音(使用英式自然发音,带拼音标注),如:西斯腾(xī sī téng)]
发音：[发音要点说明]

注意事项：
- 音标必须是英式音标${PROMPT_SUFFIX}`
}

// 生成谐音翻译/中文翻译（使用统一 AI API 模块）
async function generatePronunciation() {
  // 生成进行中时忽略重复触发（回车与按钮共用本入口）
  if (isGenerating.value) return
  if (!inputWord.value) {
    showMessage(t("msgInputRequired", "请输入内容"), { timeout: 3000, type: "error" })
    return
  }

  const seq = ++generateSeq
  isGenerating.value = true
  result.value = null

  try {
    // 优先从本地 FlashcardStorage 查询
    if (flashcardStorage) {
      const localResult = await queryFromLocalStorage(inputWord.value)
      if (seq !== generateSeq) return
      if (localResult) {
        result.value = { text: localResult.content, source: "local" }
        showMessage(t("msgLoadFromLocal", "从单词本加载"), { timeout: 2000, type: "info" })
        return
      }
    }

    // 本地未找到，调用统一 AI API 生成
    const prompt = buildPrompt(inputWord.value)
    const config = getApiConfigFromPlugin(props.plugin)

    const aiResult = await callAI(prompt, config, {
      systemPrompt: PRONUNCIATION_SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 800,
    })
    if (seq !== generateSeq) return

    if (aiResult) {
      result.value = { text: aiResult, source: "api" }
      showMessage(t("msgGenerated", "谐音记忆已生成"), { timeout: 2000, type: "info" })
    } else {
      showMessage(t("msgGenerateFailed", "生成失败，请重试"), { timeout: 3000, type: "error" })
    }
  } catch (error) {
    if (seq !== generateSeq) return
    console.error("Pronunciation generation error:", error)
    const errorMsg = (error as Error).message || t("msgUnknownError", "未知错误")
    showMessage(t("msgGenerateError", "生成失败: ") + errorMsg, { timeout: 5000, type: "error" })
  } finally {
    isGenerating.value = false
  }
}

/**
 * 从本地 FlashcardStorage 查询单词（含缓存，大小写与首尾空格不敏感）
 */
async function queryFromLocalStorage(word: string): Promise<Flashcard | null> {
  if (!flashcardStorage) return null

  const normalizedWord = word.trim().toLowerCase()
  if (!normalizedWord) return null

  try {
    // 缓存过期或未初始化时刷新
    if (!cardsCache || Date.now() - cardsCacheTimestamp > CARDS_CACHE_TTL_MS) {
      cardsCache = await flashcardStorage.getAllCards()
      cardsCacheTimestamp = Date.now()
    }

    const exactMatch = cardsCache.find(
      (card) => card.title.trim().toLowerCase() === normalizedWord,
    )
    return exactMatch || null
  } catch (error) {
    console.error("Query from local storage error:", error)
    return null
  }
}

/**
 * 打开添加到单词本对话框
 */
function openAddToCardDialog() {
  loadCategories()
  selectedCategory.value = DEFAULT_CATEGORY
  customCategoryInput.value = ""
  showAddToCardDialog.value = true
}

/**
 * 加载单词本中的类别
 */
async function loadCategories() {
  if (!flashcardStorage) return

  try {
    const categories = await flashcardStorage.getCategories()
    availableCategories.value = Array.from(
      new Set([...DEFAULT_CATEGORIES, ...categories]),
    ).sort()
  } catch (error) {
    console.error("Failed to load categories:", error)
  }
}

/**
 * 添加到单词本
 */
async function addToFlashcard() {
  if (!flashcardStorage || !inputWord.value || !result.value) {
    showMessage(t("msgIncompleteData", "数据不完整"), { timeout: 2000, type: "error" })
    return
  }

  const categoryToUse =
    selectedCategory.value === "__custom__"
      ? customCategoryInput.value.trim()
      : selectedCategory.value

  if (!categoryToUse) {
    showMessage(t("msgSelectCategory", "请选择类别"), { timeout: 2000, type: "error" })
    return
  }

  try {
    await flashcardStorage.createCard({
      title: inputWord.value,
      content: result.value.text,
      category: categoryToUse,
    })

    result.value = { ...result.value, source: "local" }
    showAddToCardDialog.value = false
    showMessage(t("msgAdded", "已添加到单词本"), { timeout: 2000, type: "info" })

    // 立即刷新缓存，避免下次翻译同一单词时重复调用 API
    cardsCache = await flashcardStorage.getAllCards()
    cardsCacheTimestamp = Date.now()

    emitCustomEvent("flashcardDataChanged")
  } catch (error: unknown) {
    const msg = getErrorMessage(error)
    if (msg === ERR_TITLE_EXISTS) {
      showMessage(t("msgTitleExists", "该单词已存在于单词本中"), { timeout: 3000, type: "error" })
    } else {
      showMessage(`${t("msgAddFailed", "添加失败: ")}${msg || t("msgUnknownError", "未知错误")}`, { timeout: 3000, type: "error" })
    }
  }
}

// 安全格式化结果显示（先转义后替换，防止 XSS）
function formatResult(resultText: string): string {
  return simpleHtmlEscape(resultText)
    .replace(/####\s+(.+)\n*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>")
}

// 复制结果到剪贴板
async function copyResult() {
  if (!result.value) return

  const success = await copyToClipboard(result.value.text)
  if (success) {
    showMessage(t("msgCopySuccess", "已复制到剪贴板"), { timeout: 2000, type: "info" })
  } else {
    showMessage(t("msgCopyFailed", "复制失败"), { timeout: 3000, type: "error" })
  }
}

// 关闭对话框
function closeDialog() {
  emit("update:visible", false)
  emit("close")
}

// 组件卸载时释放组件级缓存
onUnmounted(() => {
  cardsCache = null
  cardsCacheTimestamp = 0
})
</script>

<style scoped lang="scss">
@use "../styles/pronunciation.scss";
</style>
