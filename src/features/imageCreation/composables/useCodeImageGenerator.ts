/**
 * 代码图片生成核心逻辑（供 CodeImageTab.vue 使用）
 */
import type { CSSProperties } from "vue"
import type { SelectOption } from "@/components/Select.vue"
import type { ImageCreationI18n } from "../types"
import hljs from "highlight.js"
import html2canvas from "html2canvas"
import { showMessage } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import {
  canvasToBlob,
  copyImageToClipboard,
  triggerBlobDownload,
} from "@/utils/domUtils"
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

/** 语言选项（语言名称为专有名词，无需 i18n） */
function buildLanguageOptions(): SelectOption[] {
  return Object.entries(LANGUAGE_MAP).map(
    ([value, label]) => ({
      value,
      label,
    }),
  )
}

/** 代码风格选项（label 走 i18n） */
function buildCodeStyleOptions(i18n: ImageCreationI18n): SelectOption[] {
  return [
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
      label: i18n.styleCartoon,
    },
    {
      value: "wave",
      label: i18n.styleWave,
    },
    {
      value: "glass",
      label: i18n.styleGlass,
    },
    {
      value: "neon",
      label: i18n.styleNeon,
    },
    {
      value: "3d",
      label: i18n.style3d,
    },
  ]
}

/** 文字风格选项（label 走 i18n） */
function buildTextStyleOptions(i18n: ImageCreationI18n): SelectOption[] {
  return [
    {
      value: "quote",
      label: i18n.textStyleQuote,
    },
    {
      value: "poetry",
      label: i18n.textStylePoetry,
    },
    {
      value: "note",
      label: i18n.textStyleNote,
    },
    {
      value: "poster",
      label: i18n.textStylePoster,
    },
    {
      value: "card",
      label: i18n.textStyleCard,
    },
    {
      value: "newspaper",
      label: i18n.textStyleNewspaper,
    },
    {
      value: "gradient",
      label: i18n.textStyleGradient,
    },
  ]
}

/** 主题选项（label 走 i18n） */
function buildThemeOptions(i18n: ImageCreationI18n): SelectOption[] {
  return [
    {
      value: "light",
      label: i18n.themeLight,
    },
    {
      value: "dark",
      label: i18n.themeDark,
    },
  ]
}

// ============================================================
// Composable
// ============================================================

export function useCodeImageGenerator(i18n: ImageCreationI18n) {
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

  // 选项（i18n 文案在 setup 时一次性构建，语言切换需重启插件生效）
  const languageOptions = buildLanguageOptions()
  const codeStyleOptions = buildCodeStyleOptions(i18n)
  const textStyleOptions = buildTextStyleOptions(i18n)
  const themeOptions = buildThemeOptions(i18n)

  // 计算属性
  const currentStyleOptions = computed<SelectOption[]>(() =>
    contentType.value === "code" ? codeStyleOptions : textStyleOptions,
  )

  const highlightedCode = computed<string>(() => {
    if (!codeContent.value) {
      return `<span style="color: #999;">${i18n.codeInputHint}</span>`
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

  // 阴影强度属于生成图片的装饰效果（产品输出，非 UI 样式），故保留 box-shadow
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
    return canvasToBlob(canvas, "image/png")
  }

  const copyImage = async (): Promise<void> => {
    if (!codeContent.value) return
    try {
      const blob = await generateBlob()
      const ok = await copyImageToClipboard(blob)
      showMessage(ok ? i18n.msgCopied : i18n.msgCopyFailed, CODE_IMAGE_DEFAULTS.messageDuration, ok ? "info" : "error")
    } catch (error) {
      console.error("复制失败:", error instanceof Error ? error.message : String(error))
      showMessage(i18n.msgCopyFailed, CODE_IMAGE_DEFAULTS.messageDuration, "error")
    }
  }

  const downloadImage = async (): Promise<void> => {
    if (!codeContent.value) return
    try {
      const blob = await generateBlob()
      triggerBlobDownload(blob, createFilename())
      showMessage(i18n.msgDownloaded, CODE_IMAGE_DEFAULTS.messageDuration, "info")
    } catch (error) {
      console.error("下载失败:", error instanceof Error ? error.message : String(error))
      showMessage(i18n.msgDownloadFailed, CODE_IMAGE_DEFAULTS.messageDuration, "error")
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
    // 选项
    languageOptions,
    themeOptions,
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
