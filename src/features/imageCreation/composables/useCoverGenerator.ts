/**
 * 封面生成器 Composable
 * 根据标题 + 关键字 + 风格 + 偏好设置，纯代码生成 HTML 封面（无 AI 依赖）
 */
import type {
  CoverGenerationConfig,
  CoverGenerationStatus,
  ImageCreationI18n,
} from "../types"
import type { CoverSettingsService } from "./useCoverSettings"
import {
  COVER_SIZE_PRESETS,
  COVER_STYLE_PRESETS,
  COVER_STYLE_REGISTRY,
} from "../types"
import { showMessage } from "siyuan"
import { ref } from "vue"
import { getFile } from "@/api"
import {
  buildCoverHtml,
  fileToDataUrl,
} from "../utils/coverHtml"

export function useCoverGenerator(i18n: ImageCreationI18n, coverSettings: CoverSettingsService) {
  const coverHtml = ref("")
  const generationStatus = ref<CoverGenerationStatus>("idle")
  const errorMessage = ref("")
  const currentConfig = ref<CoverGenerationConfig>({
    title: "",
    category: "",
    keywords: "",
    width: 1200,
    height: 630,
    styleId: "minimal",
  })

  /** 应用持久化偏好（尺寸/风格）；标题等文档内容不恢复 */
  async function applyPersistedPrefs(): Promise<void> {
    await coverSettings.ready
    const s = coverSettings.settings.value
    currentConfig.value.width = s.width
    currentConfig.value.height = s.height
    currentConfig.value.styleId = s.styleId
  }

  /** 生成封面（Logo 存在时先经 getFile 加载 dataURL；失败降级为无 Logo 并提示） */
  async function generateCover(config?: Partial<CoverGenerationConfig>): Promise<void> {
    if (config) {
      Object.assign(currentConfig.value, config)
    }

    if (!currentConfig.value.title.trim()) {
      errorMessage.value = i18n.errorTitleRequired
      generationStatus.value = "error"
      return
    }

    generationStatus.value = "generating"
    errorMessage.value = ""

    try {
      const s = coverSettings.settings.value
      let logoDataUrl = ""
      if (s.logo.enabled && s.logo.path) {
        try {
          if (coverSettings.logoDataUrl.value) {
            logoDataUrl = coverSettings.logoDataUrl.value
          } else {
            const blob = await getFile(s.logo.path)
            if (blob) {
              logoDataUrl = await fileToDataUrl(blob)
              coverSettings.logoDataUrl.value = logoDataUrl
            }
          }
        } catch (error) {
          console.error("Logo 加载失败，按无 Logo 生成:", error)
          showMessage(i18n.logoLoadFailed, 3000, "error")
        }
      }

      coverHtml.value = buildCoverHtml(currentConfig.value, s, logoDataUrl)
      generationStatus.value = "done"
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : i18n.errorGenerateFailed
      errorMessage.value = msg
      generationStatus.value = "error"
    }
  }

  /** 换个风格：随机切换注册表内非当前风格（由 CoverTab 的 watch 触发重生成） */
  function randomStyle(): void {
    const ids = COVER_STYLE_REGISTRY
      .map((s) => s.id)
      .filter((id) => id !== currentConfig.value.styleId)
    if (!ids.length) return
    currentConfig.value.styleId = ids[Math.floor(Math.random() * ids.length)]
  }

  return {
    coverHtml,
    generationStatus,
    errorMessage,
    currentConfig,
    generateCover,
    randomStyle,
    applyPersistedPrefs,
    COVER_SIZE_PRESETS,
    COVER_STYLE_PRESETS,
  }
}
