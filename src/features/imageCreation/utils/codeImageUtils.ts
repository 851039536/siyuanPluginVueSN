/**
 * 代码图片纯工具函数：预览内联样式 / 背景层样式 / 导出映射 / 复制 HTML / 随机候选
 */
import type { CSSProperties } from "vue"
import type {
  CodeImageState,
  ExportFormat,
} from "../types"
import {
  CODE_FONT_OPTIONS,
  CODE_STYLE_IDS,
  TEXT_STYLE_IDS,
} from "../types"
import { HLJS_THEMES } from "./hljsThemes"

/** 导出 MIME 映射 */
export const CODE_IMAGE_MIME: Record<ExportFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
}

/** 导出文件扩展名（jpeg → jpg） */
export function codeImageExtension(format: ExportFormat): string {
  return format === "jpeg" ? "jpg" : format
}

/** 预览容器内联样式（背景由 .bg-layer 承载，容器背景透明） */
export function buildCodePreviewInlineStyle(p: CodeImageState): CSSProperties {
  return {
    borderRadius: `${p.borderRadius}px`,
    padding: `${p.paddingSize}px`,
    background: "transparent",
    position: "relative",
    boxShadow: `0 ${4 + p.shadowIntensity / 10}px ${12 + p.shadowIntensity / 5}px rgba(0, 0, 0, ${0.1 + p.shadowIntensity * 0.003})`,
    borderWidth: p.borderWidth > 0 ? `${p.borderWidth}px` : "0",
    borderStyle: p.borderWidth > 0 ? "solid" : "none",
  }
}

/** 背景层内联样式（透明度只作用于背景；自定义底色/背景图覆盖样式默认背景） */
export function buildCodeBgLayerStyle(p: CodeImageState, bgImageDataUrl: string): CSSProperties {
  const style: CSSProperties = {
    opacity: p.backgroundOpacity / 100,
  }
  if (bgImageDataUrl) {
    style.backgroundImage = `url("${bgImageDataUrl}")`
    style.backgroundSize = "cover"
    style.backgroundPosition = "center"
    style.backgroundRepeat = "no-repeat"
  } else if (p.bgColorEnabled) {
    style.backgroundColor = p.bgColor
    style.backgroundImage = "none"
  }
  return style
}

/** 复制用标准 hljs 标记（配合任意 hljs 主题 CSS 可还原着色） */
export function buildCopyHtml(language: string, highlightedHtml: string): string {
  return `<pre class="hljs"><code class="language-${language}">${highlightedHtml}</code></pre>`
}

function randomItem<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function randomHexColor(): string {
  return `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0")}`
}

/** 生成随机候选参数快照（共享当前内容；随机风格/主题/字体/hljs 主题/底色） */
export function buildRandomCandidateParams(base: CodeImageState): CodeImageState {
  const c: CodeImageState = { ...base }
  const styleIds = c.contentType === "code" ? CODE_STYLE_IDS : TEXT_STYLE_IDS
  c.selectedStyle = randomItem(styleIds)
  c.selectedTheme = Math.random() < 0.5 ? "light" : "dark"
  c.fontFamily = randomItem(CODE_FONT_OPTIONS).id
  c.hljsTheme = randomItem(HLJS_THEMES).id
  c.bgColorEnabled = Math.random() < 0.5
  c.bgColor = randomHexColor()
  return c
}
