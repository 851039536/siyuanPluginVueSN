import type {
  CoverGenerationConfig,
  CoverGenerationStatus,
  CoverSizePreset,
  CoverStylePreset,
} from "../types"
/**
 * 封面生成器 Composable
 * 根据标题 + 关键字 + 风格，纯代码生成 HTML 封面（无 AI 依赖）
 */
import { ref } from "vue"

// 尺寸预设
export const COVER_SIZE_PRESETS: CoverSizePreset[] = [
  { label: "微信公众号 (900×383)", width: 900, height: 383 },
  { label: "头条封面 (1280×720)", width: 1280, height: 720 },
  { label: "小红书 (1080×1440)", width: 1080, height: 1440 },
  { label: "知乎 (1920×1080)", width: 1920, height: 1080 },
  { label: "博客横幅 (1200×630)", width: 1200, height: 630 },
  { label: "正方形 (1080×1080)", width: 1080, height: 1080 },
]

// 风格预设
export const COVER_STYLE_PRESETS: CoverStylePreset[] = [
  { id: "minimal", label: "极简", description: "白底大字、黑色标题、简洁装饰线" },
  { id: "tech", label: "科技", description: "深色背景、霓虹线条、青色强调" },
  { id: "magazine", label: "杂志", description: "大标题排版、分栏布局、衬线字体" },
  { id: "drawio", label: "导图", description: "白底蓝边、网格辅助线、架构图风格" },
  { id: "chinese", label: "国风", description: "暖色宣纸底、水墨深色标题、朱红点缀" },
]

interface StyleColors {
  bg: string
  titleColor: string
  subtitleColor: string
  accent: string
  accentAlt: string
}

const STYLE_COLORS_MAP: Record<string, StyleColors> = {
  minimal: { bg: "#ffffff", titleColor: "#1a1a1a", subtitleColor: "#666666", accent: "#e74c3c", accentAlt: "#c0392b" },
  tech: { bg: "#0a0a0a", titleColor: "#ffffff", subtitleColor: "#888888", accent: "#00ffff", accentAlt: "#00cc99" },
  magazine: { bg: "#faf8f5", titleColor: "#1a1a1a", subtitleColor: "#555555", accent: "#c0392b", accentAlt: "#e74c3c" },
  chinese: { bg: "#f5e6d3", titleColor: "#2c1810", subtitleColor: "#5a3e2b", accent: "#c0392b", accentAlt: "#e74c3c" },
  drawio: { bg: "#f5f6f8", titleColor: "#1a1a2e", subtitleColor: "#546e7a", accent: "#1565c0", accentAlt: "#0d47a1" },
}

/** 每个风格的装饰 CSS（纯代码，无 AI） */
const STYLE_DECOR_CSS: Record<string, (c: StyleColors) => string> = {
  minimal: (c) => `
    body::before {
      content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: ${c.accent};
    }
    body::after {
      content: ""; position: absolute; bottom: ${c.accentAlt === c.accent ? "40px" : "48px"};
      left: 50%; transform: translateX(-50%);
      width: 40px; height: 40px; border: 2px solid ${c.accent}; border-radius: 50%;
    }
    .content::before {
      content: ""; position: absolute; top: 50%; left: 8%;
      width: 2px; height: 30%; transform: translateY(-50%);
      background: linear-gradient(to bottom, transparent, ${c.accent}33, transparent);
    }
    .content::after {
      content: ""; position: absolute; top: 50%; right: 8%;
      width: 2px; height: 30%; transform: translateY(-50%);
      background: linear-gradient(to bottom, transparent, ${c.accent}33, transparent);
    }`,

  tech: (c) => `
    body {
      background-image:
        linear-gradient(rgba(0,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,255,255,0.03) 1px, transparent 1px);
      background-size: 40px 40px;
    }
    body::before {
      content: ""; position: absolute; top: 30px; left: 30px; right: 30px; bottom: 30px;
      border: 1px solid rgba(0,255,255,0.15); border-radius: 2px;
    }
    body::after {
      content: ""; position: absolute; top: 0; left: 0; width: 200px; height: 200px;
      background: radial-gradient(circle, ${c.accent}20 0%, transparent 70%);
    }
    .content::before {
      content: "「"; position: absolute; top: 8%; left: 10%;
      font-size: 80px; color: ${c.accent}15; font-family: serif;
    }
    .content::after {
      content: "」"; position: absolute; bottom: 8%; right: 10%;
      font-size: 80px; color: ${c.accent}15; font-family: serif;
    }
    .style-badge {
      border-color: ${c.accent} !important; color: ${c.accent} !important;
      box-shadow: 0 0 12px ${c.accent}30;
    }`,

  magazine: (c) => `
    body::before {
      content: ""; position: absolute; top: 0; left: 0;
      width: 40%; height: 100%;
      background: linear-gradient(180deg, ${c.accentAlt}08 0%, ${c.accent}05 100%);
    }
    body::after {
      content: ""; position: absolute; bottom: 0; left: 40%; right: 0; height: 6px;
      background: ${c.accent};
    }
    .content::before {
      content: ""; position: absolute; top: 8%; right: 12%;
      width: 120px; height: 120px; border: 3px solid ${c.accent}20; border-radius: 50%;
    }
    .content::after {
      content: ""; position: absolute; bottom: 12%; left: 6%;
      width: 80px; height: 2px; background: ${c.accentAlt};
    }
    .content { padding-left: 45% !important; padding-right: 12% !important; }`,

  drawio: (c) => `
    body {
      background-image: radial-gradient(circle, ${c.accent}18 1px, transparent 1px);
      background-size: 24px 24px;
    }
    body::before {
      content: ""; position: absolute; top: 16px; left: 16px; right: 16px; bottom: 16px;
      border: 2px solid ${c.accent}25; border-radius: 4px;
    }
    body::after {
      content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, ${c.accent}, ${c.accentAlt}, ${c.accent});
    }
    .content::before {
      content: ""; position: absolute; top: 10%; left: 6%;
      width: 16px; height: 16px; border: 2px solid ${c.accent}40; border-radius: 2px;
    }
    .content::after {
      content: ""; position: absolute; bottom: 10%; right: 6%;
      width: 16px; height: 16px; border: 2px solid ${c.accent}40; border-radius: 2px;
    }
    .tag {
      border-radius: 4px !important; background: ${c.accent} !important;
      border-left: 3px solid ${c.accentAlt} !important;
    }`,

  chinese: (c) => `
    body {
      background-image:
        linear-gradient(${c.accent}08 1px, transparent 1px),
        linear-gradient(90deg, ${c.accent}08 1px, transparent 1px);
      background-size: 60px 60px;
    }
    body::before {
      content: ""; position: absolute; top: 20px; left: 20px;
      width: 50px; height: 50px;
      border-top: 2px solid ${c.accent}30; border-left: 2px solid ${c.accent}30;
    }
    body::after {
      content: ""; position: absolute; bottom: 20px; right: 20px;
      width: 50px; height: 50px;
      border-bottom: 2px solid ${c.accent}30; border-right: 2px solid ${c.accent}30;
    }
    .content::before {
      content: ""; position: absolute; right: 10%; top: 12%;
      width: 40px; height: 40px; border: 1.5px solid ${c.accentAlt}50;
      transform: rotate(45deg);
    }
    .content::after {
      content: ""; position: absolute; left: 12%; bottom: 15%;
      width: 100px; height: 1px; background: linear-gradient(90deg, ${c.accent}40, transparent);
    }
    .style-badge {
      font-family: "KaiTi", "STKaiti", "楷体", serif !important;
      letter-spacing: 6px !important;
    }
    h1 { font-weight: 900 !important; }`,
}

function getStyleColors(styleId: string): StyleColors {
  return STYLE_COLORS_MAP[styleId] ?? STYLE_COLORS_MAP.minimal
}

/** 构建完整封面 HTML（纯代码，无 AI） */
function buildCoverHtml(config: CoverGenerationConfig): string {
  const colors = getStyleColors(config.styleId)
  const c = colors
  const titleSize = Math.max(48, Math.floor(config.width / 15))
  const subtitleSize = Math.max(20, Math.floor(config.width / 40))
  const padding = Math.max(40, Math.floor(config.width / 20))
  const fontFamily = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'
  const styleLabel = COVER_STYLE_PRESETS.find((s) => s.id === config.styleId)?.label || "极简"
  const titleText = config.title?.trim() || "无标题"
  const decorCss = STYLE_DECOR_CSS[config.styleId]?.(c) ?? STYLE_DECOR_CSS.minimal(c)

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
    background-color: ${c.bg}; font-family: ${fontFamily};
    position: relative;
  }
  .content {
    position: relative; z-index: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; text-align: center; padding: ${padding}px;
  }
  .style-badge {
    font-size: ${Math.max(14, subtitleSize - 6)}px; color: ${c.accent};
    letter-spacing: 4px; margin-bottom: 16px;
    border: 1px solid ${c.accent}; padding: 4px 16px; border-radius: 12px;
  }
  h1 {
    font-size: ${titleSize}px; font-weight: 700; color: ${c.titleColor};
    line-height: 1.3; max-width: 90%;
  }
  .tags {
    margin-top: 24px; display: flex; flex-wrap: wrap; justify-content: center;
    max-width: 90%; gap: 6px;
  }
  .tag {
    display: inline-block; padding: 6px 18px; border-radius: 20px;
    background: ${c.accent}; color: #fff; font-size: ${subtitleSize}px;
  }

  /* === 风格装饰 === */
  ${decorCss}
</style>
</head>
<body>
  <div class="content">
    <span class="style-badge">${styleLabel}</span>
    <h1>${titleText}</h1>${tagsBlock}
  </div>
</body>
</html>`
}

export function useCoverGenerator() {
  const coverHtml = ref("")
  const generationStatus = ref<CoverGenerationStatus>("idle")
  const errorMessage = ref("")
  const currentConfig = ref<CoverGenerationConfig>({
    title: "",
    keywords: "",
    width: 1200,
    height: 630,
    styleId: "minimal",
  })

  /** 生成封面（同步，纯代码） */
  function generateCover(config?: Partial<CoverGenerationConfig>): void {
    if (config) {
      Object.assign(currentConfig.value, config)
    }

    if (!currentConfig.value.title.trim()) {
      errorMessage.value = "请输入文章标题"
      generationStatus.value = "error"
      return
    }

    generationStatus.value = "generating"
    errorMessage.value = ""

    try {
      coverHtml.value = buildCoverHtml(currentConfig.value)
      generationStatus.value = "done"
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "封面生成失败"
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
      keywords: "",
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
