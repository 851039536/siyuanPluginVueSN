/**
 * 代码图片生成核心逻辑
 * 从 codeImageGenerator/index.vue 提取，供 CodeImageTab.vue 使用
 */
import type { CSSProperties } from "vue"
import type { SelectOption } from "@/components/Select.vue"
import hljs from "highlight.js"
import html2canvas from "html2canvas"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import { triggerBlobDownload } from "@/utils/domUtils"
import { CODE_IMAGE_DEFAULTS } from "../types"
import "highlight.js/styles/github.css"
import "highlight.js/styles/github-dark.css"

// ============================================================
// 常量定义
// ============================================================

/** 支持的语言映射 */
export const LANGUAGE_MAP = Object.freeze({
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  ruby: "Ruby",
  swift: "Swift",
  kotlin: "Kotlin",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  yaml: "YAML",
  markdown: "Markdown",
  sql: "SQL",
  bash: "Bash",
} as const)

export const languageOptions: SelectOption[] = Object.entries(LANGUAGE_MAP).map(
  ([value, label]) => ({
    value,
    label,
  }),
)

export const codeStyleOptions: SelectOption[] = [
  {
    value: "github",
    label: "GitHub",
  },
  {
    value: "mac",
    label: "Mac",
  },
  {
    value: "cartoon",
    label: "卡通",
  },
  {
    value: "wave",
    label: "波浪渐变",
  },
  {
    value: "glass",
    label: "玻璃拟态",
  },
  {
    value: "neon",
    label: "霓虹灯",
  },
  {
    value: "3d",
    label: "3D立体",
  },
]

export const textStyleOptions: SelectOption[] = [
  {
    value: "quote",
    label: "名人名言",
  },
  {
    value: "poetry",
    label: "诗词意境",
  },
  {
    value: "note",
    label: "手写便签",
  },
  {
    value: "poster",
    label: "激励海报",
  },
  {
    value: "card",
    label: "引用卡片",
  },
  {
    value: "newspaper",
    label: "复古报纸",
  },
  {
    value: "gradient",
    label: "渐变文字",
  },
]

export const themeOptions: SelectOption[] = [
  {
    value: "light",
    label: "浅色",
  },
  {
    value: "dark",
    label: "深色",
  },
]

// ============================================================
// Composable
// ============================================================

export function useCodeImageGenerator() {
  // 核心状态
  const contentType = ref<"code" | "text">("code")
  const codeContent = ref<string>("")
  const selectedLanguage = ref<string>(CODE_IMAGE_DEFAULTS.selectedLanguage)
  const selectedStyle = ref<string>(CODE_IMAGE_DEFAULTS.selectedStyle)
  const selectedTheme = ref<string>(CODE_IMAGE_DEFAULTS.selectedTheme)
  const fontSize = ref<number>(CODE_IMAGE_DEFAULTS.fontSize)
  const codePreview = ref<HTMLDivElement>()

  // 装饰选项
  const showDecorations = ref<boolean>(false)
  const enableWatermark = ref<boolean>(false)
  const watermarkText = ref<string>(CODE_IMAGE_DEFAULTS.watermarkText)
  const enableAuthor = ref<boolean>(false)
  const authorName = ref<string>("")
  const enableTimestamp = ref<boolean>(false)

  // 高级装饰选项
  const borderWidth = ref<number>(CODE_IMAGE_DEFAULTS.borderWidth)
  const borderRadius = ref<number>(CODE_IMAGE_DEFAULTS.borderRadius)
  const paddingSize = ref<number>(CODE_IMAGE_DEFAULTS.paddingSize)
  const backgroundOpacity = ref<number>(CODE_IMAGE_DEFAULTS.backgroundOpacity)
  const shadowIntensity = ref<number>(CODE_IMAGE_DEFAULTS.shadowIntensity)

  // 计算属性
  const currentStyleOptions = computed<SelectOption[]>(() =>
    contentType.value === "code" ? codeStyleOptions : textStyleOptions,
  )

  const highlightedCode = computed<string>(() => {
    if (!codeContent.value) {
      return '<span style="color: #999;">输入代码...</span>'
    }
    try {
      const result = hljs.highlight(codeContent.value, {
        language: selectedLanguage.value,
      })
      return result.value
    } catch (error) {
      console.error("代码高亮失败:", error instanceof Error ? error.message : String(error))
      return codeContent.value
    }
  })

  const currentTime = computed<string>(() => {
    const now = new Date()
    return now.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  })

  const previewCustomStyle = computed<CSSProperties>(() => ({
    borderRadius: `${borderRadius.value}px`,
    padding: `${paddingSize.value}px`,
    opacity: backgroundOpacity.value / 100,
    boxShadow: `0 ${4 + shadowIntensity.value / 10}px ${12 + shadowIntensity.value / 5}px rgba(0, 0, 0, ${0.1 + shadowIntensity.value * 0.003})`,
    borderWidth: borderWidth.value > 0 ? `${borderWidth.value}px` : "0",
    borderStyle: borderWidth.value > 0 ? "solid" : "none",
  }))

  // 工具方法
  const getLanguageDisplay = (): string =>
    LANGUAGE_MAP[selectedLanguage.value as keyof typeof LANGUAGE_MAP]
    ?? selectedLanguage.value

  // 图片生成
  const generateCanvas = async (): Promise<HTMLCanvasElement> => {
    if (!codePreview.value) {
      throw new Error("Preview element not found")
    }
    const el = codePreview.value
    const dpr = window.devicePixelRatio ?? 1
    const scale = Math.max(dpr, CODE_IMAGE_DEFAULTS.scaleMultiplier)
    const bgColor = window.getComputedStyle(el).backgroundColor ?? "transparent"

    return html2canvas(el, {
      backgroundColor: bgColor,
      scale,
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
      imageTimeout: 0,
      removeContainer: true,
    })
  }

  const createFilename = (): string =>
    `${contentType.value === "code" ? `code-${selectedLanguage.value}` : "text"}-${Date.now()}.png`

  const generateBlob = async (): Promise<Blob> => {
    const canvas = await generateCanvas()
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Blob generation failed"))),
        "image/png",
        1.0,
      ),
    )
  }

  const copyImage = async (copiedMsg: string, copyFailedMsg: string): Promise<void> => {
    if (!codeContent.value) return
    try {
      const blob = await generateBlob()
      const item = new ClipboardItem({ "image/png": blob })
      await navigator.clipboard.write([item])
      showMessage(copiedMsg, CODE_IMAGE_DEFAULTS.messageDuration, "info")
    } catch (error) {
      console.error("复制失败:", error instanceof Error ? error.message : String(error))
      showMessage(copyFailedMsg, CODE_IMAGE_DEFAULTS.messageDuration, "error")
    }
  }

  const downloadImage = async (downloadedMsg: string, downloadFailedMsg: string): Promise<void> => {
    if (!codeContent.value) return
    try {
      const canvas = await generateCanvas()
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Blob generation failed"))),
          "image/png",
          1.0,
        ),
      )
      triggerBlobDownload(blob, createFilename())
      showMessage(downloadedMsg, CODE_IMAGE_DEFAULTS.messageDuration, "info")
    } catch (error) {
      console.error("下载失败:", error instanceof Error ? error.message : String(error))
      showMessage(downloadFailedMsg, CODE_IMAGE_DEFAULTS.messageDuration, "error")
    }
  }

  return {
    // 状态
    contentType,
    codeContent,
    selectedLanguage,
    selectedStyle,
    selectedTheme,
    fontSize,
    codePreview,
    // 装饰
    showDecorations,
    enableWatermark,
    watermarkText,
    enableAuthor,
    authorName,
    enableTimestamp,
    borderWidth,
    borderRadius,
    paddingSize,
    backgroundOpacity,
    shadowIntensity,
    // 计算属性
    currentStyleOptions,
    highlightedCode,
    currentTime,
    previewCustomStyle,
    // 方法
    getLanguageDisplay,
    copyImage,
    downloadImage,
  }
}
