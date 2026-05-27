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

/** 装饰层 HTML 片段（每个风格在 content 区域内的额外装饰元素） */
const STYLE_DECOR_HTML: Record<string, string> = {
  minimal: `<div class="decor-circle"></div><div class="decor-line-l"></div><div class="decor-line-r"></div>`,
  tech: `<div class="decor-scan"></div><div class="decor-node n1"></div><div class="decor-node n2"></div><div class="decor-node n3"></div>`,
  magazine: `<div class="decor-block"></div><div class="decor-ring"></div><div class="decor-bar"></div>`,
  drawio: `<div class="decor-grid"></div><div class="decor-corner tl"></div><div class="decor-corner tr"></div><div class="decor-corner bl"></div><div class="decor-corner br"></div>`,
  chinese: `<div class="decor-seal"></div><div class="decor-ink"></div><div class="decor-line-v"></div>`,
}

/** 每个风格的装饰 CSS（纯代码，无 AI） */
const STYLE_DECOR_CSS: Record<string, (c: StyleColors) => string> = {
  minimal: (c) => `
    body::before { content:""; position:absolute; top:0; left:0; right:0; height:4px; background:${c.accent}; }
    body::after { content:""; position:absolute; bottom:48px; left:50%; transform:translateX(-50%); width:40px; height:40px; border:2px solid ${c.accent}; border-radius:50%; }
    .content::before { content:""; position:absolute; top:50%; left:8%; width:2px; height:30%; transform:translateY(-50%); background:linear-gradient(to bottom, transparent, ${c.accent}33, transparent); }
    .content::after { content:""; position:absolute; top:50%; right:8%; width:2px; height:30%; transform:translateY(-50%); background:linear-gradient(to bottom, transparent, ${c.accent}33, transparent); }
    .decor-circle { position:absolute; top:12%; right:10%; width:180px; height:180px; border-radius:50%; background:${c.accent}08; }
    .decor-line-l { position:absolute; bottom:18%; left:6%; width:60px; height:1px; background:${c.accent}; opacity:0.3; }
    .decor-line-r { position:absolute; top:18%; right:6%; width:40px; height:1px; background:${c.accent}; opacity:0.25; }
    .tag { background:transparent !important; color:${c.accent} !important; border:1.5px solid ${c.accent}50; border-radius:4px !important; letter-spacing:1px; }`,

  tech: (c) => `
    body { background-image: linear-gradient(rgba(0,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.03) 1px, transparent 1px); background-size:40px 40px; }
    body::before { content:""; position:absolute; top:30px; left:30px; right:30px; bottom:30px; border:1px solid rgba(0,255,255,0.12); }
    body::after { content:""; position:absolute; top:0; right:0; width:300px; height:300px; background:radial-gradient(circle, ${c.accent}15 0%, transparent 70%); }
    .content::before { content:"「"; position:absolute; top:6%; left:8%; font-size:80px; color:${c.accent}12; font-family:serif; }
    .content::after { content:"」"; position:absolute; bottom:6%; right:8%; font-size:80px; color:${c.accent}12; font-family:serif; }
    .decor-scan { position:absolute; top:30%; left:0; right:0; height:1px; background:linear-gradient(90deg, transparent, ${c.accent}20, transparent); }
    .decor-node { position:absolute; width:8px; height:8px; border-radius:50%; background:${c.accent}; box-shadow:0 0 8px ${c.accent}60; }
    .decor-node.n1 { top:15%; left:15%; }
    .decor-node.n2 { top:22%; right:20%; width:5px; height:5px; }
    .decor-node.n3 { bottom:20%; left:25%; width:6px; height:6px; opacity:0.6; }
    .tag { background:${c.accent}10 !important; color:${c.accent} !important; border:1px solid ${c.accent}40; border-radius:3px !important; box-shadow:0 0 12px ${c.accent}30, inset 0 0 6px ${c.accent}10; font-family:"SF Mono","Fira Code","Consolas",monospace; letter-spacing:1px; text-transform:uppercase; }`,

  magazine: (c) => `
    body::before { content:""; position:absolute; top:0; left:0; width:40%; height:100%; background:linear-gradient(180deg, ${c.accentAlt}06 0%, ${c.accent}04 100%); }
    body::after { content:""; position:absolute; bottom:0; left:40%; right:0; height:6px; background:${c.accent}; }
    .content::before { content:""; position:absolute; top:10%; right:10%; width:100px; height:100px; border:3px solid ${c.accent}18; border-radius:50%; }
    .content::after { content:""; position:absolute; bottom:14%; left:5%; width:60px; height:2px; background:${c.accentAlt}; }
    .decor-block { position:absolute; top:40%; left:5%; width:28%; height:20%; background:${c.accent}06; }
    .decor-ring { position:absolute; bottom:8%; right:8%; width:70px; height:70px; border:2px solid ${c.accent}15; border-radius:50%; }
    .decor-bar { position:absolute; top:5%; right:5%; width:4px; height:40%; background:linear-gradient(to bottom, ${c.accent}20, transparent); }
    .content { padding-left:45% !important; padding-right:12% !important; }
    h1 { font-family:"Georgia","Noto Serif SC",serif !important; letter-spacing:-0.5px; }
    .tag { border-radius:2px !important; font-family:"Georgia","Noto Serif SC",serif; font-style:italic; background:transparent !important; color:${c.titleColor} !important; border-bottom:2px solid ${c.accent}; padding:4px 14px !important; letter-spacing:0.5px; }`,

  drawio: (c) => `
    body { background-image: radial-gradient(circle, ${c.accent}15 1px, transparent 1px); background-size:20px 20px; }
    body::before { content:""; position:absolute; top:12px; left:12px; right:12px; bottom:12px; border:2px solid ${c.accent}20; border-radius:2px; }
    body::after { content:""; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg, ${c.accent}, ${c.accentAlt}, ${c.accent}); }
    .content::before { content:""; position:absolute; top:8%; left:5%; width:14px; height:14px; border:2px solid ${c.accent}35; border-radius:1px; }
    .content::after { content:""; position:absolute; bottom:8%; right:5%; width:14px; height:14px; border:2px solid ${c.accent}35; border-radius:1px; }
    .decor-corner { position:absolute; width:20px; height:20px; border-color:${c.accent}25; border-style:solid; }
    .decor-corner.tl { top:20px; left:20px; border-width:1px 0 0 1px; }
    .decor-corner.tr { top:20px; right:20px; border-width:1px 1px 0 0; }
    .decor-corner.bl { bottom:20px; left:20px; border-width:0 0 1px 1px; }
    .decor-corner.br { bottom:20px; right:20px; border-width:0 1px 1px 0; }
    .decor-grid { position:absolute; inset:0; background-image:linear-gradient(${c.accent}06 1px, transparent 1px), linear-gradient(90deg, ${c.accent}06 1px, transparent 1px); background-size:60px 60px; }
    .tag { border-radius:3px !important; background:${c.accent}08 !important; color:${c.titleColor} !important; border:1px solid ${c.accent}25; border-left:3px solid ${c.accent}; font-family:"SF Mono","Consolas",monospace; }
    h1 { border-bottom:2px solid ${c.accent}25; padding-bottom:12px; }`,

  chinese: (c) => `
    body { background-image: linear-gradient(${c.accent}06 1px, transparent 1px), linear-gradient(90deg, ${c.accent}06 1px, transparent 1px); background-size:60px 60px; }
    body::before { content:""; position:absolute; top:16px; left:16px; width:40px; height:40px; border-top:2px solid ${c.accent}25; border-left:2px solid ${c.accent}25; }
    body::after { content:""; position:absolute; bottom:16px; right:16px; width:40px; height:40px; border-bottom:2px solid ${c.accent}25; border-right:2px solid ${c.accent}25; }
    .content::before { content:""; position:absolute; right:8%; top:10%; width:36px; height:36px; border:1.5px solid ${c.accentAlt}40; transform:rotate(45deg); }
    .content::after { content:""; position:absolute; left:10%; bottom:12%; width:80px; height:1px; background:linear-gradient(90deg, ${c.accent}35, transparent); }
    .decor-seal { position:absolute; right:12%; bottom:14%; width:50px; height:50px; border:2px solid ${c.accentAlt}50; color:${c.accentAlt}50; font-size:14px; display:flex; align-items:center; justify-content:center; transform:rotate(15deg); }
    .decor-ink { position:absolute; top:14%; right:18%; width:100px; height:100px; border-radius:50%; background:radial-gradient(ellipse at 40% 40%, ${c.accent}10, transparent 70%); }
    .decor-line-v { position:absolute; right:5%; top:25%; width:1px; height:50%; background:linear-gradient(to bottom, transparent, ${c.accent}15, transparent); }
    h1 { font-weight:900 !important; }
    .tag { background:transparent !important; color:${c.accentAlt} !important; border:1px solid ${c.accentAlt}40; border-radius:3px !important; font-family:"KaiTi","STKaiti","楷体",serif; letter-spacing:2px; }`,
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
  const titleText = config.title?.trim() || "无标题"
  const decorCss = STYLE_DECOR_CSS[config.styleId]?.(c) ?? STYLE_DECOR_CSS.minimal(c)
  const decorHtml = STYLE_DECOR_HTML[config.styleId] ?? ""

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
    position: relative; z-index: 2;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; text-align: center; padding: ${padding}px;
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
  .watermark {
    position: absolute; bottom: ${Math.max(16, Math.floor(padding / 3))}px; left: ${Math.max(16, Math.floor(padding / 3))}px;
    font-size: ${Math.max(11, subtitleSize - 8)}px; color: ${c.subtitleColor}; opacity: 0.35;
    z-index: 3; letter-spacing: 2px;
  }
  .decor-layer { position: absolute; inset: 0; z-index: 1; pointer-events: none; }

  /* === 风格装饰 === */
  ${decorCss}
</style>
</head>
<body>
  <div class="decor-layer">${decorHtml}</div>
  <div class="content">
    <h1>${titleText}</h1>${tagsBlock}
  </div>
  <span class="watermark">${config.watermark || ""}</span>
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
    watermark: "叫我少年",
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
      watermark: "叫我少年",
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
