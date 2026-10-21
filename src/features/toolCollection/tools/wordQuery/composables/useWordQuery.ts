// 单词查询核心逻辑 — 状态管理、AI 调用、结果解析、复制、发音
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
  watch,
} from "vue"
import { getApiConfigFromPlugin } from "@/utils/aiApi"
import {
  copyToClipboard,
  triggerBlobDownload,
} from "@/utils/domUtils"
import { buildQueryPrompt, callWordQueryAPI } from "../utils/api"

const AUTO_OPERATION_DELAY = 2000
const WORD_PATTERN =
  /^[a-z0-9\s\-.,;:!?'"()Ā-鿿　-〿＀-￯]+$/i

/** 中文（含中日韩表意文字）判定：用于选择 TTS 发音语言 */
const CHINESE_PATTERN = /[㐀-鿿]/


export const FIELD_MAPPINGS = [
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

export interface ExtractedParts {
  phonetic?: string
  meaning?: string
  english?: string
  pronunciation?: string
  example?: string
  all?: string
  [key: string]: string | undefined
}

/**
 * 单词查询核心 composable — 封装查询状态、AI 调用、结果解析、复制、发音
 * @param plugin 思源插件实例
 * @param pronunciationType 发音类型 ref（来自 useSettings）
 * @param autoPlayPronunciation 自动播放 ref（来自 useSettings）
 * @param i18n 词条文案（用于错误提示国际化）
 */
export function useWordQuery(
  plugin?: Plugin,
  pronunciationType?: Ref<"uk" | "us">,
  autoPlayPronunciation?: Ref<boolean>,
  i18n?: Record<string, string>,
) {
  const searchWord = ref("")
  const queryResult = ref("")
  const isLoading = ref(false)
  const errorMessage = ref("")
  const showCopyOptions = ref(false)
  const autoQueryTimer = ref<NodeJS.Timeout | null>(null)

  /** 进行中的请求：连续输入时取消上一次，避免旧结果覆盖新结果 */
  let abortController: AbortController | null = null
  /** 请求序号：仅最新一次请求的结果可以落地 */
  let requestSeq = 0

  // ========== 计算属性 ==========

  // 从 AI 返回结果中提取单词（处理 AI 修正拼写的情况），fallback 到用户输入
  const extractWord = computed(() => {
    // 优先取 Markdown 标题行（prompt 要求输出 `#### 单词`）
    const heading = queryResult.value.match(/^####\s*(.+)$/m)
    if (heading) return heading[1].trim()
    // 兼容「单词：xxx」字段行
    const field = queryResult.value.match(/(?:单词|词语)：(.+)$/m)
    if (field) return field[1].trim()
    return searchWord.value.trim()
  })

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

  // ========== 输入验证 ==========

  const validateInput = (input: string) => {
    if (!input.trim()) return i18n?.enterWordPlease || "请输入单词"
    if (!WORD_PATTERN.test(input)) {
      return i18n?.enterValidWord || "请输入有效的单词或词语"
    }
    return null
  }

  // ========== 查询 ==========

  /** 清除待触发的防抖查询（手动查询时先取消，避免同一次输入发出两轮请求） */
  const clearTimer = () => {
    if (autoQueryTimer.value) {
      clearTimeout(autoQueryTimer.value)
      autoQueryTimer.value = null
    }
  }

  const handleQuery = async () => {
    // 手动查询时清掉待触发的防抖查询，避免同一次输入发出两轮请求
    clearTimer()

    const word = searchWord.value.trim()
    const error = validateInput(word)
    if (error) {
      errorMessage.value = error
      return
    }

    // 取消上一次未完成的请求
    abortController?.abort()
    abortController = new AbortController()
    const currentSeq = ++requestSeq

    isLoading.value = true
    errorMessage.value = ""

    try {
      const config = getApiConfigFromPlugin(plugin)
      const result = await callWordQueryAPI(buildQueryPrompt(word), config, {
        signal: abortController.signal,
      })
      // 仅最新一次请求可以写入结果
      if (currentSeq !== requestSeq) return

      if (result) {
        queryResult.value = result
        if (autoPlayPronunciation?.value) {
          playPronunciation(word)
        }
      } else {
        errorMessage.value = i18n?.queryFailed || "查询失败，请重试"
      }
    } catch (error) {
      // 主动取消不算错误
      if ((error as Error).name === "AbortError") return
      console.error("Query error:", error)
      errorMessage.value
        = (error as Error).message || i18n?.unknownError || "未知错误"
    } finally {
      if (currentSeq === requestSeq) {
        isLoading.value = false
        abortController = null
      }
    }
  }

  const clearResult = () => {
    queryResult.value = ""
    errorMessage.value = ""
  }

  // ========== 发音 ==========

  const playPronunciation = (word: string) => {
    try {
      const utterance = new SpeechSynthesisUtterance(word)
      // 中文词语用中文发音，其余按英/美式发音
      utterance.lang = CHINESE_PATTERN.test(word)
        ? "zh-CN"
        : pronunciationType?.value === "us"
          ? "en-US"
          : "en-GB"
      utterance.rate = 0.8
      speechSynthesis.speak(utterance)
    } catch (error) {
      console.error("Failed to play pronunciation:", error)
    }
  }

  // ========== 复制 ==========

  const toggleCopyOptions = () => {
    showCopyOptions.value = !showCopyOptions.value
  }

  const copyResult = async (type: string = "all", labels?: Record<string, string>) => {
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
      showMessage(labels?.noCopyContent || "没有找到要复制的内容", 2000, "error")
      return
    }

    const ok = await copyToClipboard(textToCopy)
    if (ok) {
      showCopyOptions.value = false
    } else {
      showMessage(labels?.copyFailed || "复制失败", 3000, "error")
    }
  }

  // ========== 导出（下载 Markdown 文件） ==========

  const exportContent = (labels?: Record<string, string>) => {
    if (!queryResult.value) {
      showMessage(labels?.noExportContent || "没有可导出的内容", 2000, "error")
      return
    }

    const word = extractWord.value || searchWord.value.trim()
    const content = `## ${word}\n\n${queryResult.value}`
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
    // 文件名去除非法字符
    const safeName = word.replace(/[\\/:*?"<>|]/g, "_") || "word-query"
    triggerBlobDownload(blob, `${safeName}.md`)
  }

  // ========== 防抖自动查询 ==========

  const setupAutoQuery = () => {
    clearTimer()

    const word = searchWord.value.trim()
    if (word && WORD_PATTERN.test(word)) {
      autoQueryTimer.value = setTimeout(() => {
        handleQuery()
      }, AUTO_OPERATION_DELAY)
    }
  }

  // ========== 点击外部关闭下拉 ==========

  const handleClickOutside = (event: Event, containerRef: Ref<HTMLElement | null>) => {
    const target = event.target as HTMLElement
    if (!containerRef.value?.contains(target)) {
      showCopyOptions.value = false
    }
  }

  // ========== 监听输入自动查询 ==========

  watch(searchWord, () => {
    setupAutoQuery()
  })

  return {
    // 状态
    searchWord,
    queryResult,
    isLoading,
    errorMessage,
    showCopyOptions,
    autoQueryTimer,
    // 计算属性
    extractWord,
    extractContentParts,
    // 方法
    validateInput,
    handleQuery,
    clearResult,
    playPronunciation,
    toggleCopyOptions,
    copyResult,
    exportContent,
    setupAutoQuery,
    clearTimer,
    handleClickOutside,
  }
}
