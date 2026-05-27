import type {
  CoverGenerationConfig,
  CoverGenerationStatus,
  CoverSizePreset,
  CoverStylePreset,
} from "../types"
/**
 * AI 封面生成器 Composable
 * 根据文档标题/内容，通过 AI 生成 HTML 文章封面
 */
import type { AiApiConfig } from "@/types/ai"
import { ref } from "vue"
import { usePlugin } from "@/main"
import {
  callAIStream,
  getApiConfigFromPlugin,
} from "@/utils/aiApi"

// 尺寸预设
export const COVER_SIZE_PRESETS: CoverSizePreset[] = [
  {
    label: "微信公众号 (900×383)",
    width: 900,
    height: 383,
  },
  {
    label: "头条封面 (1280×720)",
    width: 1280,
    height: 720,
  },
  {
    label: "小红书 (1080×1440)",
    width: 1080,
    height: 1440,
  },
  {
    label: "知乎 (1920×1080)",
    width: 1920,
    height: 1080,
  },
  {
    label: "博客横幅 (1200×630)",
    width: 1200,
    height: 630,
  },
  {
    label: "正方形 (1080×1080)",
    width: 1080,
    height: 1080,
  },
]

// 风格预设（含配色方案）
export const COVER_STYLE_PRESETS: CoverStylePreset[] = [
  {
    id: "minimal",
    label: "极简",
    description: "白底大字、黑色标题、简洁装饰线",
  },
  {
    id: "tech",
    label: "科技",
    description: "深色背景、霓虹线条、青色强调",
  },
  {
    id: "magazine",
    label: "杂志",
    description: "大标题排版、分栏布局、衬线字体",
  },
  {
    id: "drawio",
    label: "导图",
    description: "白底蓝边、网格辅助线、架构图风格",
  },
  {
    id: "chinese",
    label: "国风",
    description: "暖色宣纸底、水墨深色标题、朱红点缀",
  },
]

/** 风格配色方案缓存（模块级别，避免重复创建） */
const STYLE_COLORS_MAP: Record<string, { bg: string, titleColor: string, subtitleColor: string, accent: string, accentAlt: string }> = {
  minimal: {
    bg: "#ffffff",
    titleColor: "#1a1a1a",
    subtitleColor: "#666666",
    accent: "#e74c3c",
    accentAlt: "#c0392b",
  },
  tech: {
    bg: "#0a0a0a",
    titleColor: "#ffffff",
    subtitleColor: "#888888",
    accent: "#00ffff",
    accentAlt: "#00cc99",
  },
  magazine: {
    bg: "#faf8f5",
    titleColor: "#1a1a1a",
    subtitleColor: "#555555",
    accent: "#c0392b",
    accentAlt: "#e74c3c",
  },
  chinese: {
    bg: "#f5e6d3",
    titleColor: "#2c1810",
    subtitleColor: "#5a3e2b",
    accent: "#c0392b",
    accentAlt: "#e74c3c",
  },
  drawio: {
    bg: "#f5f6f8",
    titleColor: "#1a1a2e",
    subtitleColor: "#546e7a",
    accent: "#1565c0",
    accentAlt: "#0d47a1",
  },
}

/** 风格设计指引缓存 */
const STYLE_DESIGN_GUIDES: Record<string, string> = {
  minimal: "大面积留白，细线分隔，一个强调色块突出",
  tech: "暗底霓虹发光（box-shadow），网格线/终端感装饰",
  magazine: "大字排版占主视觉，分栏/非对称",
  chinese: "水墨风格，竖排可选，朱红点缀",
  drawio: "浅灰画布、淡蓝网格/点阵底纹（radial-gradient）、蓝色边框卡片、结构化框图排版",
}

/** 根据风格获取 CSS 变量配色方案 */
function getStyleColors(styleId: string) {
  return STYLE_COLORS_MAP[styleId] ?? STYLE_COLORS_MAP.minimal
}

/** 根据风格 ID 返回精简设计指引 */
function getStyleDesignGuide(styleId: string): string {
  const guide = STYLE_DESIGN_GUIDES[styleId]
  return guide ? `【风格指引】${guide}` : ""
}

/** 构建基础 HTML（内容由代码保证，AI 不可篡改） */
function buildBaseHtml(config: CoverGenerationConfig): string {
  const stylePreset = COVER_STYLE_PRESETS.find((s) => s.id === config.styleId)
  const colors = getStyleColors(config.styleId)
  const titleSize = Math.max(48, Math.floor(config.width / 15))
  const subtitleSize = Math.max(20, Math.floor(config.width / 40))
  const padding = Math.max(40, Math.floor(config.width / 20))
  const bg = colors.bg
  const bgCSS = bg.includes("gradient") ? `background: ${bg};` : `background-color: ${bg};`
  const styleLabel = stylePreset?.label || "极简"
  const titleText = config.title?.trim() || "无标题"
  const fontFamily = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'

  // 内容区
  let bodyInner = `<span class="style-badge">${styleLabel}</span>`
  bodyInner += `\n    <h1>${titleText}</h1>`

  if (config.keywords?.trim()) {
    const tagList = config.keywords.trim().split(/\s+/).filter(Boolean)
    const tagsHtml = tagList.map((kw) => `<span class="tag">${kw}</span>`).join("\n      ")
    bodyInner += `\n    <div class="tags">${tagsHtml}</div>`
  } else {
    bodyInner += `\n    <div class="divider"></div>`
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* === 基础样式（代码固定，不可覆盖 content 层文字） === */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${config.width}px; height: ${config.height}px; overflow: hidden;
    ${bgCSS}
    font-family: ${fontFamily};
  }
  .content {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; text-align: center; padding: ${padding}px;
  }
  .style-badge {
    font-size: ${Math.max(14, subtitleSize - 6)}px; color: ${colors.accent};
    letter-spacing: 4px; margin-bottom: 16px;
    border: 1px solid ${colors.accent}; padding: 4px 16px; border-radius: 12px;
  }
  h1 {
    font-size: ${titleSize}px; font-weight: 700; color: ${colors.titleColor};
    line-height: 1.3; max-width: 90%;
  }
  .tags {
    margin-top: 24px; display: flex; flex-wrap: wrap; justify-content: center;
    max-width: 90%; gap: 6px;
  }
  .tag {
    display: inline-block; padding: 6px 18px; border-radius: 20px;
    background: ${colors.accent}; color: #fff; font-size: ${subtitleSize}px;
  }
  .divider { margin-top: 20px; width: 60px; height: 3px; background: ${colors.accent}; border-radius: 2px; }

  /* === AI 装饰区（由 AI 填充，仅限视觉效果） === */
  /* @AI_DECORATION_PLACEHOLDER */
</style>
</head>
<body>
  <div class="content">
    ${bodyInner}
  </div>
</body>
</html>`
}

/** 构建 AI 装饰 CSS 的 prompt（只要求 CSS，不接触内容） */
function buildDecorPrompt(config: CoverGenerationConfig): string {
  const stylePreset = COVER_STYLE_PRESETS.find((s) => s.id === config.styleId)
  const colors = getStyleColors(config.styleId)
  const styleGuide = getStyleDesignGuide(config.styleId)

  return `你是一位平面设计师。下面是一个已完成的封面 HTML，你只需要为它添加**纯 CSS 装饰**。

【你的任务】
在 /* @AI_DECORATION_PLACEHOLDER */ 位置，写入 CSS 装饰规则。使用 ::before/::after 伪元素、box-shadow、gradient、clip-path 为封面增加背景图案、几何图形、纹理。

【风格要求】
- ${stylePreset?.label || "极简"}（${stylePreset?.description || "简洁风格"}）
${styleGuide}
- 强调色：${colors.accent} / ${colors.accentAlt}

【约束】
1. ⚠️ 只能输出 CSS 代码，禁止输出任何 HTML 标签
2. ⚠️ 禁止覆盖 .content、h1、.tag、.style-badge、.divider、body 的基础样式
3. ⚠️ 禁止使用 content 属性修改文字（伪元素的 content 只能是 "" 或纯装饰字符如 "●" "「" "」"）
4. 使用 body::before、body::after、.content::before、.content::after 添加装饰
5. 禁止 JS、animation、transition、外部图片、CDN、web font
6. 装饰必须定位在内容层**背后或周围**，不能遮挡文字

直接输出 CSS，不要任何解释，不要 markdown 代码块。`
}

/** 从 AI 响应中提取 CSS 代码 */
function extractStyleBlock(response: string): string {
  let css = response.trim()

  // 提取 markdown css 代码块
  const cssBlockMatch = css.match(/```(?:css|CSS)?\s*([\s\S]*?)```/)
  if (cssBlockMatch) {
    css = cssBlockMatch[1].trim()
  }

  // 提取 <style> 标签内容
  const styleTagMatch = css.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  if (styleTagMatch) {
    css = styleTagMatch[1].trim()
  }

  return css
}

/** 将 AI 生成的 CSS 合并到基础 HTML */
function mergeStyleIntoHtml(baseHtml: string, decorCss: string): string {
  if (!decorCss) return baseHtml
  return baseHtml.replace("/* @AI_DECORATION_PLACEHOLDER */", decorCss)
}

export function useCoverGenerator() {
  const plugin = usePlugin()

  const coverHtml = ref("")
  const streamedText = ref("") // 流式生成过程中的原始文本
  const generationStatus = ref<CoverGenerationStatus>("idle")
  const errorMessage = ref("")
  const currentConfig = ref<CoverGenerationConfig>({
    title: "",
    keywords: "",
    width: 1200,
    height: 630,
    styleId: "minimal",
  })
  let abortController: AbortController | null = null

  /** 生成封面 */
  async function generateCover(config?: Partial<CoverGenerationConfig>): Promise<void> {
    if (config) {
      Object.assign(currentConfig.value, config)
    }

    if (!currentConfig.value.title.trim()) {
      errorMessage.value = "请输入文章标题"
      generationStatus.value = "error"
      return
    }

    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()

    generationStatus.value = "generating"
    errorMessage.value = ""
    streamedText.value = ""

    try {
      const aiConfig: AiApiConfig = getApiConfigFromPlugin(plugin)

      if (!aiConfig.apiKey) {
        throw new Error("请先在超级面板中配置 AI API 密钥")
      }

      // Phase 1: 代码构建基础 HTML（内容 100% 准确）
      const baseHtml = buildBaseHtml(currentConfig.value)

      // Phase 2: AI 生成装饰 CSS
      const decorPrompt = buildDecorPrompt(currentConfig.value)
      const response = await callAIStream(decorPrompt, aiConfig, (chunk) => {
        streamedText.value += chunk
      }, {
        temperature: 0.7,
        maxTokens: 4000,
        signal: abortController.signal,
      })

      const decorCss = extractStyleBlock(response)
      coverHtml.value = mergeStyleIntoHtml(baseHtml, decorCss)
      generationStatus.value = "done"
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      // AI 失败降级：使用基础 HTML（无 AI 装饰，但内容正确、配色到位）
      if (!coverHtml.value) {
        coverHtml.value = buildBaseHtml(currentConfig.value)
      }
      const msg = error instanceof Error ? error.message : "封面生成失败"
      errorMessage.value = msg
      generationStatus.value = "error"
    } finally {
      abortController = null
    }
  }

  /** 取消生成 */
  function cancelGeneration(): void {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    generationStatus.value = "idle"
    errorMessage.value = ""
  }

  /** 重置 */
  function reset(): void {
    cancelGeneration()
    coverHtml.value = ""
    streamedText.value = ""
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
    streamedText,
    generationStatus,
    errorMessage,
    currentConfig,
    generateCover,
    cancelGeneration,
    reset,
    COVER_SIZE_PRESETS,
    COVER_STYLE_PRESETS,
  }
}
