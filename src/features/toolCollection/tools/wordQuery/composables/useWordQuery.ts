// 单词查询核心逻辑 — 状态管理、AI 调用、结果解析、复制、发音
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import { showMessage } from "siyuan"
import { computed, ref, watch } from "vue"
import { getApiConfigFromPlugin } from "@/utils/aiApi"
import { copyToClipboard } from "@/utils/domUtils"
import { buildQueryPrompt, callWordQueryAPI } from "../utils/api"

const AUTO_OPERATION_DELAY = 2000
const WORD_PATTERN =
  /^[a-z0-9\s\-.,;:!?'"()Ā-鿿　-〿＀-￯]+$/i


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
 */
export function useWordQuery(
  plugin?: Plugin,
  pronunciationType?: Ref<"uk" | "us">,
  autoPlayPronunciation?: Ref<boolean>,
) {
  const searchWord = ref("")
  const queryResult = ref("")
  const isLoading = ref(false)
  const errorMessage = ref("")
  const showCopyOptions = ref(false)
  const autoQueryTimer = ref<NodeJS.Timeout | null>(null)

  // ========== 计算属性 ==========

  // 从 AI 返回结果中提取单词（处理 AI 修正拼写的情况），fallback 到用户输入
  const extractWord = computed(() => {
    const match = queryResult.value.match(/^####\s*(?:单词|词语)：(.+)$/m)
    return match ? match[1].trim() : searchWord.value.trim()
  })

  const formattedResult = computed(() => {
    if (!queryResult.value) return ""

    let html = queryResult.value
    html = html.replace(/^#### (.+)$/gm, '<h4 class="result-title">$1</h4>')
    html = html.replace(/\n/g, "<br>")

    const firstField = FIELD_MAPPINGS.find((m) => m.pattern.test(html))
    let labelReplacement = ""

    if (firstField) {
      labelReplacement = `<div class="result-section ${firstField.class}"><span class="result-label">${firstField.label}`
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
    if (!input.trim()) return "请输入单词"
    if (!WORD_PATTERN.test(input)) return "请输入有效的单词或词语"
    return null
  }

  // ========== 查询 ==========

  const handleQuery = async () => {
    const word = searchWord.value.trim()
    const error = validateInput(word)
    if (error) {
      errorMessage.value = error
      return
    }

    isLoading.value = true
    errorMessage.value = ""

    try {
      const config = getApiConfigFromPlugin(plugin)
      const result = await callWordQueryAPI(buildQueryPrompt(word), config)
      if (result) {
        queryResult.value = result
        if (autoPlayPronunciation?.value) {
          playPronunciation(word)
        }
      } else {
        errorMessage.value = "查询失败,请重试"
      }
    } catch (error) {
      console.error("Query error:", error)
      errorMessage.value = (error as Error).message || "未知错误"
    } finally {
      isLoading.value = false
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
      utterance.lang = pronunciationType?.value === "us" ? "en-US" : "en-GB"
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

  const copyResult = async (type: string = "all", i18n?: Record<string, string>) => {
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

    const ok = await copyToClipboard(textToCopy)
    if (ok) {
      showCopyOptions.value = false
    } else {
      showMessage(i18n?.copyFailed || "复制失败", 3000, "error")
    }
  }

  // ========== 导出 ==========

  const exportContent = async (i18n?: Record<string, string>) => {
    if (!queryResult.value) {
      showMessage("没有可导出的内容", 2000, "error")
      return
    }

    const word = searchWord.value.trim()
    const content = `## ${word}\n\n${queryResult.value}`
    const ok = await copyToClipboard(content)
    if (!ok) {
      showMessage(i18n?.exportFailed || "导出失败", 3000, "error")
    }
  }

  // ========== 防抖自动查询 ==========

  const clearTimer = () => {
    if (autoQueryTimer.value) {
      clearTimeout(autoQueryTimer.value)
      autoQueryTimer.value = null
    }
  }

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
    formattedResult,
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

