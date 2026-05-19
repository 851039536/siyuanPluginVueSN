/**
 * AI 封面生成器 Composable
 * 根据文档标题/内容，通过 AI 生成 HTML 文章封面
 */
import type { AiApiConfig } from "@/types/ai"
import type { CoverGenerationConfig, CoverGenerationStatus, CoverSizePreset, CoverStylePreset } from "../types"
import { ref } from "vue"
import { callAI, callAIStream, getApiConfigFromPlugin } from "@/utils/aiApi"
import { usePlugin } from "@/main"

// 尺寸预设
export const COVER_SIZE_PRESETS: CoverSizePreset[] = [
  { label: "微信公众号 (900×383)", width: 900, height: 383 },
  { label: "头条封面 (1280×720)", width: 1280, height: 720 },
  { label: "小红书 (1080×1440)", width: 1080, height: 1440 },
  { label: "知乎 (1920×1080)", width: 1920, height: 1080 },
  { label: "博客横幅 (1200×630)", width: 1200, height: 630 },
  { label: "正方形 (1080×1080)", width: 1080, height: 1080 },
]

// 风格预设（含配色方案）
export const COVER_STYLE_PRESETS: CoverStylePreset[] = [
  { id: "minimal", label: "极简", description: "白底大字、黑色标题、简洁装饰线" },
  { id: "gradient", label: "渐变", description: "紫蓝渐变背景、白色标题、金色强调" },
  { id: "tech", label: "科技", description: "深色背景、霓虹线条、青色强调" },
  { id: "nature", label: "自然", description: "绿蓝渐变、柔和圆角、有机形态" },
  { id: "magazine", label: "杂志", description: "大标题排版、分栏布局、衬线字体" },
  { id: "watercolor", label: "水彩", description: "粉色渐变晕染、淡雅柔和配色" },
  { id: "geometric", label: "几何", description: "色块拼接、几何图形、强对比配色" },
  { id: "chinese", label: "国风", description: "暖色宣纸底、水墨深色标题、朱红点缀" },
]

/** 根据风格获取 CSS 变量配色方案 */
function getStyleColors(styleId: string): { bg: string, titleColor: string, subtitleColor: string, accent: string, accentAlt: string } {
  const map: Record<string, { bg: string, titleColor: string, subtitleColor: string, accent: string, accentAlt: string }> = {
    minimal: { bg: "#ffffff", titleColor: "#1a1a1a", subtitleColor: "#666666", accent: "#e74c3c", accentAlt: "#c0392b" },
    gradient: { bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.9)", accent: "#ffd700", accentAlt: "#ffed4e" },
    tech: { bg: "#0a0a0a", titleColor: "#ffffff", subtitleColor: "#888888", accent: "#00ffff", accentAlt: "#00cc99" },
    nature: { bg: "linear-gradient(135deg, #00b894 0%, #0984e3 100%)", titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.9)", accent: "#fdcb6e", accentAlt: "#ffeaa7" },
    magazine: { bg: "#faf8f5", titleColor: "#1a1a1a", subtitleColor: "#555555", accent: "#c0392b", accentAlt: "#e74c3c" },
    watercolor: { bg: "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)", titleColor: "#2d3436", subtitleColor: "#636e72", accent: "#e17055", accentAlt: "#fab1a0" },
    geometric: { bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", titleColor: "#ffffff", subtitleColor: "rgba(255,255,255,0.9)", accent: "#fdcb6e", accentAlt: "#ffeaa7" },
    chinese: { bg: "#f5e6d3", titleColor: "#2c1810", subtitleColor: "#5a3e2b", accent: "#c0392b", accentAlt: "#e74c3c" },
  }
  return map[styleId] ?? map.minimal
}

/** 构建生成封面的 AI prompt（设计规范驱动，非模板约束） */
function buildCoverPrompt(config: CoverGenerationConfig): string {
  const stylePreset = COVER_STYLE_PRESETS.find(s => s.id === config.styleId)
  const colors = getStyleColors(config.styleId)
  const titleSize = Math.max(48, Math.floor(config.width / 15))
  const subtitleSize = Math.max(20, Math.floor(config.width / 40))
  const padding = Math.max(40, Math.floor(config.width / 20))
  const bg = colors.bg

  // 构建风格化的背景 CSS
  const bgCSS = bg.includes("gradient") ? bg : `background-color: ${bg};`

  // 判断内容长度，给出不同的处理指引
  const contentLength = config.content?.length ?? 0
  const hasTitle = !!config.title?.trim()
  const hasContent = !!config.content?.trim()

  // 构建内容区域指令（入口已裁剪到 150 字符）
  let contentSection = ""
  if (!hasContent && hasTitle) {
    contentSection = `画面仅展示标题，用 CSS 几何图形/线条/色块装饰，避免空洞。`
  } else if (contentLength <= 50) {
    contentSection = `副标题："${config.content}"（小号字或不同颜色）`
  } else {
    contentSection = `主题参考："${config.content}"`
  }

  const styleGuide = getStyleDesignGuide(config.styleId)

  return `你是一位平面设计师，为文章创建纯 HTML/CSS 封面。

【信息】
- 标题：${config.title || "无标题"}
- 风格：${stylePreset?.label || "极简"}（${stylePreset?.description || "简洁风格"}）
${contentSection}

【设计规范】
- 尺寸：${config.width}×${config.height}px 固定
- 背景：${bgCSS}
- 标题：≥${titleSize}px 加粗，色 ${colors.titleColor}
- 副标题：≥${subtitleSize}px，色 ${colors.subtitleColor}
- 强调：${colors.accent} / ${colors.accentAlt}
- 内边距：≥${padding}px
- 字体：-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif
${styleGuide}

【约束】
1. 纯 HTML+CSS，禁止 JS/外部图片/CDN/web font/CSS animation/transition
2. 装饰用 CSS：box-shadow、border、gradient、clip-path、::before/::after
3. body { width:${config.width}px; height:${config.height}px; overflow:hidden; margin:0; }
4. 内容不溢出画布，用 flexbox/grid/absolute 布局

⚠️ 只输出 HTML，不要解释。首字符 <，尾字符 >。`
}

/** 根据风格 ID 返回精简设计指引 */
function getStyleDesignGuide(styleId: string): string {
  const guides: Record<string, string> = {
    minimal: "大面积留白，细线分隔，一个强调色块突出",
    gradient: "渐变层次，半透明玻璃态（blur），亮色强调",
    tech: "暗底霓虹发光（box-shadow），网格线/终端感装饰",
    nature: "柔和渐变圆角，有机曲线，气泡/叶子形态",
    magazine: "大字排版占主视觉，分栏/非对称",
    watercolor: "多色渐变叠加，大圆角色块，柔和粉紫蓝",
    geometric: "色块拼接（clip-path/rotate），强对比",
    chinese: "水墨风格，竖排可选，朱红点缀",
  }
  return guides[styleId] ? `【风格指引】${guides[styleId]}` : ""
}

export function useCoverGenerator() {
  const plugin = usePlugin()

  const coverHtml = ref("")
  const streamedText = ref("")  // 流式生成过程中的原始文本
  const generationStatus = ref<CoverGenerationStatus>("idle")
  const errorMessage = ref("")
  const currentConfig = ref<CoverGenerationConfig>({
    title: "",
    content: "",
    width: 1200,
    height: 630,
    styleId: "minimal",
  })
  let abortController: AbortController | null = null

  /** 从 AI 响应中提取 HTML */
  function extractHtmlFromResponse(response: string): string {
    let cleaned = response.trim()

    // 1. 提取最后一个 markdown 代码块（AI 思考后通常最终输出在最后）
    const codeBlockMatches = [...cleaned.matchAll(/```(?:html|HTML)?\s*\n?([\s\S]*?)```/g)]
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

    if (!currentConfig.value.title.trim() && !currentConfig.value.content.trim()) {
      errorMessage.value = "请输入标题或内容摘要"
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
      content: "",
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
