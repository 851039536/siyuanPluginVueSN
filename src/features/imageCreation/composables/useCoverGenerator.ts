/**
 * 封面生成器 Composable
 * 根据标题 + 关键字 + 风格 + 偏好设置，纯代码生成 HTML 封面（无 AI 依赖）
 */
import type {
  CoverGenerationConfig,
  CoverGenerationStatus,
  ImageCreationI18n,
} from "../types"
import type { CoverCandidate } from "../types/storage"
import type { CoverSettingsService } from "./useCoverSettings"
import {
  COVER_SIZE_PRESETS,
  COVER_STYLE_PRESETS,
  COVER_STYLE_REGISTRY,
} from "../types"
import { showMessage } from "siyuan"
import { ref } from "vue"
import {
  buildCoverHtml,
  buildRandomVariantSettings,
  pickRandomStyleId,
} from "../utils/coverHtml"
import { cloneCoverSettings } from "../types/storage"

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

  /** 解析当前 Logo dataURL（复用设置服务的会话缓存；失败降级为空并提示） */
  async function resolveLogoDataUrl(): Promise<string> {
    const s = coverSettings.settings.value
    if (!s.logo.enabled || !s.logo.path) return ""
    const url = await coverSettings.loadLogoDataUrl(s.logo.path)
    if (!url) {
      showMessage(i18n.logoLoadFailed, 3000, "error")
    }
    return url
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
      const logoDataUrl = await resolveLogoDataUrl()
      coverHtml.value = buildCoverHtml(currentConfig.value, coverSettings.settings.value, logoDataUrl)
      generationStatus.value = "done"
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : i18n.errorGenerateFailed
      errorMessage.value = msg
      generationStatus.value = "error"
    }
  }

  /** 生成 AI 全自动封面候选：AI 推荐方案 + 2 个随机组合变体 */
  async function generateCoverCandidates(input: {
    title: string
    keywords: string
    styleId: string
  }): Promise<CoverCandidate[]> {
    const logoDataUrl = await resolveLogoDataUrl()
    const base = coverSettings.settings.value
    const aiStyleId = COVER_STYLE_REGISTRY.some((s) => s.id === input.styleId)
      ? input.styleId
      : currentConfig.value.styleId

    const aiConfig: CoverGenerationConfig = {
      ...currentConfig.value,
      title: input.title,
      keywords: input.keywords,
      styleId: aiStyleId,
    }

    const candidates: CoverCandidate[] = [
      {
        label: i18n.aiRecommend,
        config: { ...aiConfig },
        settings: cloneCoverSettings(base),
        html: "",
      },
    ]

    // 4 个随机组合变体：随机风格（与已有候选互不相同）+ 随机主题色 + 随机水印/Logo 位置
    const usedStyles = new Set<string>([aiStyleId])
    for (let i = 0; i < 4; i++) {
      const styleId = pickRandomStyleId([...usedStyles])
      usedStyles.add(styleId)
      candidates.push({
        label: `${i18n.randomCombo} ${i + 1}`,
        config: { ...aiConfig, styleId },
        settings: buildRandomVariantSettings(base),
        html: "",
      })
    }

    for (const c of candidates) {
      c.html = buildCoverHtml(c.config, c.settings, logoDataUrl)
    }
    return candidates
  }

  /** 换个风格：随机切换注册表内非当前风格（由 CoverTab 的 watch 触发重生成） */
  function randomStyle(): void {
    currentConfig.value.styleId = pickRandomStyleId([currentConfig.value.styleId])
  }

  return {
    coverHtml,
    generationStatus,
    errorMessage,
    currentConfig,
    generateCover,
    generateCoverCandidates,
    randomStyle,
    applyPersistedPrefs,
    COVER_SIZE_PRESETS,
    COVER_STYLE_PRESETS,
  }
}
