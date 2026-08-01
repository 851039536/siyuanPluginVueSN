/**
 * 封面生成器 Composable
 * 根据标题 + 关键字 + 风格，纯代码生成 HTML 封面（无 AI 依赖）
 */
import type {
  CoverGenerationConfig,
  CoverGenerationStatus,
  ImageCreationI18n,
} from "../types"
import {
  COVER_FONT_FAMILY,
  COVER_SIZE_PRESETS,
  COVER_STYLE_PRESETS,
  COVER_STYLE_REGISTRY,
} from "../types"
import { ref } from "vue"

/** 构建完整封面 HTML（纯代码，无 AI） */
function buildCoverHtml(config: CoverGenerationConfig): string {
  const style = COVER_STYLE_REGISTRY.find((s) => s.id === config.styleId) ?? COVER_STYLE_REGISTRY[0]
  const c = style.colors
  const titleSize = Math.max(48, Math.floor(config.width / 15))
  const subtitleSize = Math.max(20, Math.floor(config.width / 40))
  const padding = Math.max(40, Math.floor(config.width / 20))
  const titleText = config.title?.trim() || "无标题"

  // 分类挂饰
  const categoryText = config.category?.trim() || ""
  const categoryBadge = categoryText
    ? `\n    <span class="category-badge">${categoryText}</span>`
    : ""

  // 副标题行（minimal 风格专属：标题与分隔线之间的淡色过渡）
  const subtitleLine = (categoryText && style.id === "minimal")
    ? `\n    <div class="subtitle-line">${categoryText}</div>`
    : ""

  // 蓝图尺寸标注（drawio 风格专属）
  const dimsAnnotation = style.id === "drawio"
    ? `<div class="decor-dims">${config.width} × ${config.height}</div>`
    : ""

  // 关键字标签
  let tagsBlock = ""
  if (config.keywords?.trim()) {
    const tagList = config.keywords.trim().split(/\s+/).filter(Boolean)
    const tagsHtml = tagList.map((kw) => `<span class="tag">${kw}</span>`).join("\n      ")
    tagsBlock = `\n    <div class="tags">${tagsHtml}</div>`
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${config.width}px; height: ${config.height}px; overflow: hidden;
    background-color: ${c.bg}; font-family: ${COVER_FONT_FAMILY};
    position: relative;
  }
  .content {
    position: relative; z-index: 2;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; text-align: center; padding: ${padding}px;
  }
  h1 {
    font-size: ${titleSize}px; font-weight: 700; color: ${c.titleColor};
    line-height: 1.3; max-width: 90%;
  }
  .title-row {
    display: flex; align-items: flex-start; justify-content: center;
    flex-wrap: wrap; gap: 12px; max-width: 90%;
  }
  .title-row h1 { max-width: none; }
  .category-badge {
    display: inline-block; padding: 3px 12px; border-radius: 12px;
    background: ${c.accent}; color: #fff; font-size: ${Math.max(13, subtitleSize - 4)}px;
    letter-spacing: 2px; white-space: nowrap; flex-shrink: 0;
    margin-top: ${Math.max(4, Math.floor(titleSize * 0.08))}px;
  }
  .title-sep {
    width: 80px; height: 0;
    margin: 18px auto 0 auto;
    border-top: 2px dashed ${c.accent}30;
  }
  .subtitle-line {
    margin-top: 16px;
    font-size: ${Math.max(16, subtitleSize - 4)}px;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .tags {
    margin-top: 18px; display: flex; flex-wrap: wrap; justify-content: center;
    max-width: 90%; gap: 6px;
  }
  .tag {
    display: inline-block; padding: 6px 18px; border-radius: 20px;
    background: ${c.accent}; color: #fff; font-size: ${subtitleSize}px;
  }
  .watermark {
    position: absolute; bottom: ${Math.max(16, Math.floor(padding / 3))}px; left: ${Math.max(16, Math.floor(padding / 3))}px;
    font-size: ${Math.max(11, subtitleSize - 8)}px; color: ${c.subtitleColor}; opacity: 0.35;
    z-index: 3; letter-spacing: 2px;
  }
  .decor-layer { position: absolute; inset: 0; z-index: 1; pointer-events: none; }

  /* === 风格装饰 === */
  ${style.buildDecorCss(c)}
</style>
</head>
<body>
  <div class="decor-layer">${style.decorHtml}${dimsAnnotation}</div>
  <div class="content">
    <div class="title-row">
      <h1>${titleText}</h1>${categoryBadge}
    </div>
    <div class="title-sep"></div>${subtitleLine}${tagsBlock}
  </div>
  <span class="watermark">${config.watermark || ""}</span>
</body>
</html>`
}

export function useCoverGenerator(i18n: ImageCreationI18n) {
  const coverHtml = ref("")
  const generationStatus = ref<CoverGenerationStatus>("idle")
  const errorMessage = ref("")
  const currentConfig = ref<CoverGenerationConfig>({
    title: "",
    category: "",
    keywords: "",
    watermark: i18n.watermarkPlaceholder,
    width: 1200,
    height: 630,
    styleId: "minimal",
  })

  function generateCover(config?: Partial<CoverGenerationConfig>): void {
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
      coverHtml.value = buildCoverHtml(currentConfig.value)
      generationStatus.value = "done"
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : i18n.errorGenerateFailed
      errorMessage.value = msg
      generationStatus.value = "error"
    }
  }

  function reset(): void {
    coverHtml.value = ""
    generationStatus.value = "idle"
    errorMessage.value = ""
    currentConfig.value = {
      title: "",
      category: "",
      keywords: "",
      watermark: i18n.watermarkPlaceholder,
      width: 1200,
      height: 630,
      styleId: "minimal",
    }
  }

  return {
    coverHtml,
    generationStatus,
    errorMessage,
    currentConfig,
    generateCover,
    reset,
    COVER_SIZE_PRESETS,
    COVER_STYLE_PRESETS,
  }
}
