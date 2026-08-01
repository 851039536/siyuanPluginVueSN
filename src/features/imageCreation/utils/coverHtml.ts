/**
 * 封面 HTML 纯函数构建器（无 Vue 依赖）
 * 安全：所有用户输入经 simpleHtmlEscape 转义后再拼入 HTML
 */
import type {
  CoverGenerationConfig,
  LogoPosition,
  StyleColors,
  StyleDefinition,
  WatermarkPosition,
} from "../types"
import type { CoverSettings } from "../types/storage"
import {
  COVER_FONT_FAMILY,
  COVER_STYLE_REGISTRY,
} from "../types"
import { simpleHtmlEscape } from "@/utils/domUtils"

/** 从风格注册表解析风格定义（无效 styleId 回退第一个） */
export function resolveCoverStyle(styleId: string): StyleDefinition {
  return COVER_STYLE_REGISTRY.find((s) => s.id === styleId) ?? COVER_STYLE_REGISTRY[0]
}

/** 应用主题色覆盖层：enabled 时覆盖 bg/titleColor/accent，accentAlt 沿用风格默认 */
export function resolveCoverColors(style: StyleDefinition, settings: CoverSettings): StyleColors {
  if (!settings.colors.enabled) return style.colors
  return {
    bg: settings.colors.bg,
    titleColor: settings.colors.titleColor,
    accent: settings.colors.accent,
    accentAlt: style.colors.accentAlt,
  }
}

/** 水印位置 → CSS 定位片段 */
const WATERMARK_POSITION_CSS: Record<WatermarkPosition, string> = {
  bottomLeft: "bottom: 16px; left: 16px;",
  bottomRight: "bottom: 16px; right: 16px;",
  topLeft: "top: 16px; left: 16px;",
  topRight: "top: 16px; right: 16px;",
  center: "top: 50%; left: 50%; transform: translate(-50%, -50%);",
}

/** Logo 角标位置 → CSS 定位片段 */
const LOGO_POSITION_CSS: Record<LogoPosition, string> = {
  topLeft: "top: 16px; left: 16px;",
  topRight: "top: 16px; right: 16px;",
  bottomLeft: "bottom: 16px; left: 16px;",
  bottomRight: "bottom: 16px; right: 16px;",
}

/** Blob → dataURL（Logo 内嵌封面 HTML 用） */
export function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"))
    reader.readAsDataURL(blob)
  })
}

/** 生成随机和谐色板（用于全自动封面的随机组合变体） */
export function randomCoverColors(): { bg: string, titleColor: string, accent: string } {
  const hue = Math.floor(Math.random() * 360)
  const dark = Math.random() < 0.5
  return {
    bg: `hsl(${hue}, ${dark ? 40 : 55}%, ${dark ? 14 : 88}%)`,
    titleColor: dark ? "#f5f5f5" : "#1a1a1a",
    accent: `hsl(${(hue + 40 + Math.floor(Math.random() * 60)) % 360}, 75%, 55%)`,
  }
}

/** 随机水印位置 */
export function randomWatermarkPosition(): WatermarkPosition {
  const positions: WatermarkPosition[] = ["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]
  return positions[Math.floor(Math.random() * positions.length)]
}

/** 随机 Logo 角标位置 */
export function randomLogoPosition(): LogoPosition {
  const positions: LogoPosition[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"]
  return positions[Math.floor(Math.random() * positions.length)]
}

/** 构建完整封面 HTML（纯代码，无 AI 依赖） */
export function buildCoverHtml(
  config: CoverGenerationConfig,
  settings: CoverSettings,
  logoDataUrl = "",
): string {
  const style = resolveCoverStyle(config.styleId)
  const c = resolveCoverColors(style, settings)
  const titleSize = Math.max(48, Math.floor(config.width / 15))
  const subtitleSize = Math.max(20, Math.floor(config.width / 40))
  const padding = Math.max(40, Math.floor(config.width / 20))
  const titleText = simpleHtmlEscape(config.title?.trim() || "无标题")

  // 分类挂饰（转义）
  const categoryText = simpleHtmlEscape(config.category?.trim() || "")
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

  // 关键字标签（逐项转义）
  let tagsBlock = ""
  if (config.keywords?.trim()) {
    const tagList = config.keywords.trim().split(/\s+/).filter(Boolean)
    const tagsHtml = tagList
      .map((kw) => `<span class="tag">${simpleHtmlEscape(kw)}</span>`)
      .join("\n      ")
    tagsBlock = `\n    <div class="tags">${tagsHtml}</div>`
  }

  // 水印（按位置/透明度渲染；未启用或空文本不渲染）
  const wm = settings.watermark
  const watermarkText = wm.enabled ? wm.text.trim() : ""
  const watermarkBlock = watermarkText
    ? `\n  <span class="watermark" style="${WATERMARK_POSITION_CSS[wm.position]} opacity: ${wm.opacity / 100};">${simpleHtmlEscape(watermarkText)}</span>`
    : ""

  // Logo 角标（dataURL 内嵌，避免资源路径跨域截图问题）
  const lg = settings.logo
  const logoBlock = (lg.enabled && logoDataUrl)
    ? `\n  <img class="cover-logo" src="${logoDataUrl}" alt="" style="${LOGO_POSITION_CSS[lg.position]} height: ${lg.size}px; opacity: ${lg.opacity / 100};" />`
    : ""

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
    position: absolute;
    font-size: ${Math.max(11, subtitleSize - 8)}px; color: ${c.subtitleColor};
    z-index: 3; letter-spacing: 2px; line-height: 1;
  }
  .cover-logo {
    position: absolute; z-index: 3; object-fit: contain;
    border-radius: 4px; padding: 4px;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(0, 0, 0, 0.08);
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
  </div>${watermarkBlock}${logoBlock}
</body>
</html>`
}
