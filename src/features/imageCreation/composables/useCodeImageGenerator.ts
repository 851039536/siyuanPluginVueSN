/**
 * 代码图片生成核心逻辑（供 CodeImageTab.vue 使用）
 * 状态收敛为单一 reactive state；偏好持久化经 CodeImageSettingsService
 */
import type { CSSProperties } from "vue"
import type { SelectOption } from "@/components/Select.vue"
import type {
  CodeImageCandidate,
  CodeImageState,
  ImageCreationI18n,
} from "../types"
import type { CodeImageSettingsService } from "./useCodeImageSettings"
import hljs from "highlight.js"
import html2canvas from "html2canvas"
import { showMessage } from "siyuan"
import {
  computed,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue"
import {
  canvasToBlob,
  copyImageToClipboard,
  copyToClipboard,
  triggerBlobDownload,
} from "@/utils/domUtils"
import {
  CODE_IMAGE_DEFAULTS,
  CODE_FONT_OPTIONS,
  CODE_STYLE_IDS,
  TEXT_STYLE_IDS,
} from "../types"
import { resolveCodeFontStack } from "../types"
import {
  defaultHljsTheme,
  injectHljsTheme,
  removeHljsTheme,
} from "../utils/hljsThemes"
import {
  buildCodeBgLayerStyle,
  buildCodePreviewInlineStyle,
  buildCopyHtml,
  buildRandomCandidateParams,
  CODE_IMAGE_MIME,
  codeImageExtension,
} from "../utils/codeImageUtils"
import {
  applyCodeImagePrefs,
  DEFAULT_CODE_IMAGE_SETTINGS,
  extractCodeImagePrefs,
} from "../types/storage"

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

/** 代码风格选项（id 列表单一数据源 CODE_STYLE_IDS，label 走 i18n） */
function buildCodeStyleOptions(i18n: ImageCreationI18n): SelectOption[] {
  const labels: Record<string, string> = {
    github: "GitHub",
    mac: "Mac",
    cartoon: i18n.styleCartoon,
    wave: i18n.styleWave,
    glass: i18n.styleGlass,
    neon: i18n.styleNeon,
    "3d": i18n.style3d,
  }
  return CODE_STYLE_IDS.map((id) => ({ value: id, label: labels[id] }))
}

/** 文字风格选项（id 列表单一数据源 TEXT_STYLE_IDS，label 走 i18n） */
function buildTextStyleOptions(i18n: ImageCreationI18n): SelectOption[] {
  const labels: Record<string, string> = {
    quote: i18n.textStyleQuote,
    poetry: i18n.textStylePoetry,
    note: i18n.textStyleNote,
    poster: i18n.textStylePoster,
    card: i18n.textStyleCard,
    newspaper: i18n.textStyleNewspaper,
    gradient: i18n.textStyleGradient,
  }
  return TEXT_STYLE_IDS.map((id) => ({ value: id, label: labels[id] }))
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

export function useCodeImageGenerator(i18n: ImageCreationI18n, settingsService: CodeImageSettingsService) {
  // 工作状态（偏好字段默认值来自 DEFAULT_CODE_IMAGE_SETTINGS）
  const state = reactive<CodeImageState>({
    ...DEFAULT_CODE_IMAGE_SETTINGS,
    codeContent: "",
    showDecorations: false,
  })

  const codePreview = ref<HTMLDivElement>()

  // 选项（i18n 文案在 setup 时一次性构建，语言切换需重启插件生效）
  const languageOptions = buildLanguageOptions()
  const codeStyleOptions = buildCodeStyleOptions(i18n)
  const textStyleOptions = buildTextStyleOptions(i18n)
  const themeOptions = buildThemeOptions(i18n)
  const fontOptions: SelectOption[] = CODE_FONT_OPTIONS.map((f) => ({
    value: f.id,
    label: i18n[f.labelKey as keyof ImageCreationI18n],
  }))
  const hljsThemeOptions: SelectOption[] = [
    { value: "github", label: i18n.hljsGitHubLight },
    { value: "githubDark", label: i18n.hljsGitHubDark },
    { value: "atomLight", label: i18n.hljsAtomLight },
    { value: "atomDark", label: i18n.hljsAtomDark },
    { value: "monokai", label: i18n.hljsMonokai },
    { value: "tokyoNight", label: i18n.hljsTokyoNight },
  ]
  const scaleOptions: SelectOption[] = [
    { value: 1, label: i18n.scale1x },
    { value: 2, label: i18n.scale2x },
    { value: 3, label: i18n.scale3x },
  ]

  // 计算属性
  const currentStyleOptions = computed<SelectOption[]>(() =>
    state.contentType === "code" ? codeStyleOptions : textStyleOptions,
  )

  const highlightedCode = computed<string>(() => {
    if (!state.codeContent) {
      return `<span style="color: #999;">${i18n.codeInputHint}</span>`
    }
    try {
      const result = hljs.highlight(state.codeContent, {
        language: state.selectedLanguage,
      })
      return result.value
    } catch (error) {
      console.error("代码高亮失败:", error instanceof Error ? error.message : String(error))
      return state.codeContent
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

  // 预览容器样式（背景透明，由 .bg-layer 承载；阴影为生成图片装饰效果）
  const previewCustomStyle = computed<CSSProperties>(() => buildCodePreviewInlineStyle(state))
  const bgLayerStyle = computed<CSSProperties>(() => buildCodeBgLayerStyle(state, settingsService.bgImageDataUrl.value))
  const contentStyle = computed<CSSProperties>(() => ({
    fontSize: `${state.fontSize}px`,
    fontFamily: resolveCodeFontStack(state.fontFamily),
  }))

  // 工具方法
  const getLanguageDisplay = (): string =>
    LANGUAGE_MAP[state.selectedLanguage as keyof typeof LANGUAGE_MAP]
    ?? state.selectedLanguage

  // 图片生成
  const generateCanvas = async (): Promise<HTMLCanvasElement> => {
    if (!codePreview.value) {
      throw new Error("Preview element not found")
    }
    const el = codePreview.value
    return html2canvas(el, {
      // PNG/WebP 支持透明背景（背景透明度 <100 时导出透明底）；JPEG 无透明固定白底
      backgroundColor: state.exportFormat === "jpeg" ? "#ffffff" : "transparent",
      scale: state.exportScale,
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
    `${state.contentType === "code" ? `code-${state.selectedLanguage}` : "text"}-${Date.now()}.${codeImageExtension(state.exportFormat)}`

  const generateBlob = async (): Promise<Blob> => {
    // 背景图存在但会话缓存缺失（预载失败）时，生成前尝试补载一次
    const s = settingsService.settings.value
    if (s.bgImagePath && !settingsService.bgImageDataUrl.value) {
      const url = await settingsService.loadBgImageDataUrl(s.bgImagePath)
      if (!url) {
        showMessage(i18n.msgBgImageLoadFailed, CODE_IMAGE_DEFAULTS.messageDuration, "error")
      }
    }
    const canvas = await generateCanvas()
    return canvasToBlob(
      canvas,
      CODE_IMAGE_MIME[state.exportFormat],
      state.exportFormat === "jpeg" ? state.jpegQuality : undefined,
    )
  }

  const copyImage = async (): Promise<void> => {
    if (!state.codeContent) return
    try {
      const blob = await generateBlob()
      const ok = await copyImageToClipboard(blob)
      if (ok) {
        showMessage(i18n.msgCopied, CODE_IMAGE_DEFAULTS.messageDuration, "info")
      } else {
        // 兜底：剪贴板不可用时降级为下载
        triggerBlobDownload(blob, createFilename())
        showMessage(i18n.msgCopiedFallback, CODE_IMAGE_DEFAULTS.messageDuration, "info")
      }
    } catch (error) {
      console.error("复制失败:", error instanceof Error ? error.message : String(error))
      showMessage(i18n.msgCopyFailed, CODE_IMAGE_DEFAULTS.messageDuration, "error")
    }
  }

  const downloadImage = async (): Promise<void> => {
    if (!state.codeContent) return
    try {
      const blob = await generateBlob()
      triggerBlobDownload(blob, createFilename())
      showMessage(i18n.msgDownloaded, CODE_IMAGE_DEFAULTS.messageDuration, "info")
    } catch (error) {
      console.error("下载失败:", error instanceof Error ? error.message : String(error))
      showMessage(i18n.msgDownloadFailed, CODE_IMAGE_DEFAULTS.messageDuration, "error")
    }
  }

  /** 复制代码块为标准 hljs HTML 标记 */
  const copyHtml = async (): Promise<void> => {
    if (!state.codeContent) return
    try {
      const ok = await copyToClipboard(buildCopyHtml(state.selectedLanguage, highlightedCode.value))
      showMessage(ok ? i18n.msgCopiedHtml : i18n.msgCopyFailed, CODE_IMAGE_DEFAULTS.messageDuration, ok ? "info" : "error")
    } catch (error) {
      console.error("复制 HTML 失败:", error instanceof Error ? error.message : String(error))
      showMessage(i18n.msgCopyFailed, CODE_IMAGE_DEFAULTS.messageDuration, "error")
    }
  }

  // ── hljs 高亮主题注入（跟随容器主题，用户手动选择后停止跟随） ──
  let hljsThemeAuto = true
  let lastInjectedTheme = ""
  watch(
    () => state.hljsTheme,
    (id) => {
      if (lastInjectedTheme) removeHljsTheme(lastInjectedTheme)
      injectHljsTheme(id)
      lastInjectedTheme = id
    },
    { immediate: true },
  )
  watch(
    () => state.selectedTheme,
    (theme) => {
      if (hljsThemeAuto) {
        state.hljsTheme = defaultHljsTheme(theme)
      }
    },
  )
  onUnmounted(() => {
    if (lastInjectedTheme) removeHljsTheme(lastInjectedTheme)
  })

  /** 手动选择 hljs 主题（停止自动跟随） */
  function onHljsThemeChange(themeId: string) {
    hljsThemeAuto = false
    state.hljsTheme = themeId
  }

  // ── 偏好持久化：状态变化 → 提取偏好子集 → 设置服务同步（JSON 比对防无谓落盘） ──
  watch(
    state,
    () => {
      settingsService.updatePrefs(extractCodeImagePrefs(state, settingsService.settings.value.bgImagePath))
    },
    { deep: true },
  )

  /** 应用持久化偏好（挂载时调用） */
  async function applyPersistedPrefs(): Promise<void> {
    await settingsService.ready
    applyCodeImagePrefs(state, settingsService.settings.value)
  }

  // ── 灵感模式候选 ──
  const candidates = ref<CodeImageCandidate[]>([])

  /** 生成 4 个随机组合候选（共享当前内容） */
  function generateCandidates(): void {
    candidates.value = Array.from({ length: 4 }, (_, i) => ({
      label: `${i18n.randomCombo} ${i + 1}`,
      params: buildRandomCandidateParams(state),
    }))
  }

  /** 应用选中的候选参数 */
  function applyCandidate(index: number): void {
    const c = candidates.value[index]
    if (!c) return
    Object.assign(state, c.params)
  }

  return {
    // 状态
    state,
    codePreview,
    candidates,
    bgImageDataUrl: settingsService.bgImageDataUrl,
    // 选项
    languageOptions,
    themeOptions,
    fontOptions,
    hljsThemeOptions,
    scaleOptions,
    // 计算属性
    currentStyleOptions,
    highlightedCode,
    currentTime,
    previewCustomStyle,
    bgLayerStyle,
    contentStyle,
    // 方法
    getLanguageDisplay,
    onHljsThemeChange,
    generateCandidates,
    applyCandidate,
    copyImage,
    copyHtml,
    downloadImage,
    applyPersistedPrefs,
  }
}
