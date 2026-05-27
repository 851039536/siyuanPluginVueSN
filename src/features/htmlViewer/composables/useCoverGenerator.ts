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
  callAI,
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

/** 构建生成封面的 AI prompt（设计规范驱动，非模板约束） */
function buildCoverPrompt(config: CoverGenerationConfig): string {
  const stylePreset = COVER_STYLE_PRESETS.find((s) => s.id === config.styleId)
  const colors = getStyleColors(config.styleId)
  const titleSize = Math.max(48, Math.floor(config.width / 15))
  const subtitleSize = Math.max(20, Math.floor(config.width / 40))
  const padding = Math.max(40, Math.floor(config.width / 20))
  const bg = colors.bg

  // 构建风格化的背景 CSS
  const bgCSS = bg.includes("gradient") ? bg : `background-color: ${bg};`

  const hasTitle = !!config.title?.trim()
  const hasKeywords = !!config.keywords?.trim()
  const styleLabel = stylePreset?.label || "极简"

  // 构建固定内容区：风格标签（顶部居中）→ 标题 → 关键字（下方居中）
  const titleText = config.title?.trim() || "无标题"
  let contentHtml = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:${padding}px;box-sizing:border-box;">`
  contentHtml += `\n  <span style="font-size:${Math.max(14, subtitleSize - 6)}px;color:${colors.accent};letter-spacing:4px;text-transform:uppercase;margin-bottom:16px;border:1px solid ${colors.accent};padding:4px 16px;border-radius:12px;">${styleLabel}</span>`
  contentHtml += `\n  <h1 style="font-size:${titleSize}px;font-weight:700;color:${colors.titleColor};margin:0;line-height:1.3;max-width:90%;">${titleText}</h1>`

  if (hasKeywords) {
    const tagList = config.keywords.trim().split(/\s+/).filter(Boolean)
    const tagsHtml = tagList.map((kw) =>
      `<span style="display:inline-block;padding:6px 18px;margin:6px;border-radius:20px;background:${colors.accent};color:#fff;font-size:${subtitleSize}px;">${kw}</span>`,
    ).join("")
    contentHtml += `\n  <div style="margin-top:24px;display:flex;flex-wrap:wrap;justify-content:center;max-width:90%;">${tagsHtml}</div>`
  } else if (hasTitle) {
    contentHtml += `\n  <div style="margin-top:20px;width:60px;height:3px;background:${colors.accent};border-radius:2px;"></div>`
  }

  contentHtml += `\n</div>`

  const styleGuide = getStyleDesignGuide(config.styleId)

  return `你是一位平面设计师。以下内容已经直接写在 HTML 中，你**必须原样保留**，不得修改、删减或重写任何文字。

【固定内容（已嵌入HTML，不可改动）】
${contentHtml}

【你的任务】
围绕以上固定内容，用 CSS 构建符合风格的**装饰层**（背景、几何图形、线条、色块、纹理），让封面美观有设计感。

【风格要求】
- 风格：${stylePreset?.label || "极简"}（${stylePreset?.description || "简洁风格"}）
${styleGuide}
- 背景：${bgCSS}
- 强调色：${colors.accent} / ${colors.accentAlt}
- 整体内边距 ≥${padding}px
- 字体：-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif

【约束】
1. 内容区（h1、标签）必须 100% 保留，连空格都不能改
2. 装饰用 CSS：box-shadow、border、gradient、clip-path、::before/::after
3. body { width:${config.width}px; height:${config.height}px; overflow:hidden; margin:0; }
4. 纯 HTML+CSS，禁止 JS/外部图片/CDN/web font/CSS animation/transition
5. 内容不溢出画布，用 flexbox/grid/absolute 布局

⚠️ 只输出完整 HTML。首字符 <，尾字符 >。`
}

/** 根据风格 ID 返回精简设计指引 */
function getStyleDesignGuide(styleId: string): string {
  const guide = STYLE_DESIGN_GUIDES[styleId]
  return guide ? `【风格指引】${guide}` : ""
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

  /** 从 AI 响应中提取 HTML */
  function extractHtmlFromResponse(response: string): string {
    let cleaned = response.trim()

    // 1. 提取最后一个 markdown 代码块（AI 思考后通常最终输出在最后）
    const codeBlockMatches = [...cleaned.matchAll(/```(?:html|HTML)?\s*([\s\S]*?)```/g)]
    if (codeBlockMatches.length > 0) {
      cleaned = codeBlockMatches[codeBlockMatches.length - 1][1].trim()
    }

    // 2. 提取完整的 HTML 文档
    const htmlDocMatch = cleaned.match(/(<!DOCTYPE\s+html[^>]*>[\s\S]*<\/html>|<html[\s\S]*<\/html>)/i)
    if (htmlDocMatch) {
      return htmlDocMatch[1].trim()
    }

    // 3. 从第一个 <!DOCTYPE 或 <html 位置截取到 </html>
    const firstHtmlIdx = cleaned.search(/<!DOCTYPE|<html/i)
    if (firstHtmlIdx >= 0) {
      const fromHtml = cleaned.slice(firstHtmlIdx)
      const endMatch = fromHtml.match(/([\s\S]*<\/html>)/i)
      if (endMatch) {
        return endMatch[1].trim()
      }
    }

    // 4. 如果以 < 开头，尝试补全
    if (cleaned.startsWith("<")) {
      if (!cleaned.includes("<html")) {
        return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${cleaned}</body></html>`
      }
      return cleaned
    }

    return ""
  }

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

      const prompt = buildCoverPrompt(currentConfig.value)
      const response = await callAIStream(prompt, aiConfig, (chunk) => {
        streamedText.value += chunk
      }, {
        temperature: 0.7,
        maxTokens: 8000,
        signal: abortController.signal,
      })

      const extracted = extractHtmlFromResponse(response)
      if (!extracted || !extracted.includes("<html")) {
        // 第一次提取失败 → 让 AI 修复格式（非流式，快速）
        streamedText.value += "\n\n--- 格式修复中，请稍候... ---\n"
        const fixPrompt = `你上一轮回复的内容不是完整的HTML文档。请把以下内容重新组织为纯HTML代码，不要任何解释，首字符必须是<：\n\n${response.slice(0, 3000)}`
        const fixedResponse = await callAI(fixPrompt, aiConfig, {
          temperature: 0.3,
          maxTokens: 4000,
          signal: abortController.signal,
        })
        const fixed = extractHtmlFromResponse(fixedResponse)
        if (!fixed || !fixed.includes("<html")) {
          throw new Error("AI 返回的内容不包含有效的 HTML 代码，请重试")
        }
        coverHtml.value = fixed
        generationStatus.value = "done"
        return
      }

      coverHtml.value = extracted
      generationStatus.value = "done"
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
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
