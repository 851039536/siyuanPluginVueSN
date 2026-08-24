/**
 * 灵感生成器 — 纯函数工具：AI 响应解析与 prompt 构建
 * 不依赖 Vue 响应式，可被 composable 与单测复用
 */
import type {
  GuideDirection,
  IdeaCategory,
  IdeaItem,
} from "./types"

/** 批量生成灵感的最大条数 */
export const MAX_IDEAS = 5

/** 每轮生成发散方向的最大个数 */
export const MAX_DIRECTIONS = 5

/** 批量生成灵感的 system prompt（引导稳定输出 Markdown 列表） */
export const SYSTEM_PROMPT_GENERATE = `你是一名资深软件开发创意顾问，擅长为开发者推荐"小而美"的功能创意。
要求：
1. 围绕用户指定的开发方向分类，生成 ${MAX_IDEAS} 条具体可落地的功能/小工具灵感；
2. 每条灵感必须针对真实用户痛点，避免空泛套话；
3. 只输出 Markdown 无序列表，每行严格遵循格式：- **标题**：一句话描述；
4. 标题不超过 20 字，描述不超过 60 字；
5. 禁止输出任何解释性文字、代码块、序号或多余标题。`

/** 细化技术方案的 system prompt */
export const SYSTEM_PROMPT_REFINE = `你是一名资深软件架构师，擅长把创意灵感落地为可执行的技术方案。
请将用户提供的灵感展开为一份完整、结构化的 Markdown 技术方案文档，
使用二级标题分节，内容要求具体、可执行，禁止空话套话。`

/** 引导发散：生成方向选项的 system prompt */
export const SYSTEM_PROMPT_DIRECTIONS = `你是一名资深的创意发散导师，擅长把一个宽泛主题拆解为多个可深挖的「发散方向」。
要求：
1. 基于用户主题与已选方向路径，生成 ${MAX_DIRECTIONS} 个互不重复、可继续深挖的方向选项；
2. 方向角度可涵盖：目标用户、使用场景、技术形态、核心痛点、变现模式等，避免与前序路径重复；
3. 只输出 Markdown 无序列表，每行严格遵循格式：- **方向**：一句话说明；
4. 方向名称不超过 12 字，说明不超过 30 字；
5. 禁止输出任何解释性文字、代码块或多余标题。`

/** 引导发散：由方向路径发散灵感的 system prompt */
export const SYSTEM_PROMPT_DIVERGE = `你是一名资深的软件开发创意顾问，擅长沿着既定的发散路径产出具体可落地的功能灵感。
要求：
1. 严格围绕用户主题与已选方向路径，生成 ${MAX_IDEAS} 条具体可落地的程序开发/小功能灵感；
2. 每条灵感必须针对真实用户痛点，与发散路径高度契合；
3. 只输出 Markdown 无序列表，每行严格遵循格式：- **标题**：一句话描述；
4. 标题不超过 20 字，描述不超过 60 字；
5. 禁止输出任何解释性文字、代码块、序号或多余标题。`

/** 构建批量生成灵感的 user prompt */
export function buildIdeasPrompt(
  category: IdeaCategory,
  categoryLabel: string,
  keyword: string,
): string {
  return [
    `开发方向分类：${categoryLabel}`,
    `额外关键词：${keyword || "无（自由发挥）"}`,
    "",
    `请围绕上述方向，生成 ${MAX_IDEAS} 条程序开发/小功能开发灵感。`,
  ].join("\n")
}

/** 构建细化技术方案的 user prompt */
export function buildRefinePrompt(
  idea: IdeaItem,
  categoryLabel: string,
): string {
  return [
    "请将以下灵感展开为一份完整的技术方案：",
    `- 灵感标题：${idea.title}`,
    `- 灵感描述：${idea.description || "（无）"}`,
    `- 所属分类：${categoryLabel}`,
    "",
    "文档必须包含以下分节：",
    "## 需求说明",
    "（目标用户、核心痛点、核心功能列表）",
    "## 技术栈建议",
    "（语言/框架/关键库，并给出选择理由）",
    "## 实现要点",
    "（分步实现步骤、核心难点与解决方案）",
    "## 扩展方向",
    "（可选的进阶功能与后续演进）",
  ].join("\n")
}

/** 构建发散方向的 user prompt */
export function buildDirectionsPrompt(topic: string, steps: GuideDirection[]): string {
  const path = steps.length > 0 ? steps.map((d) => d.label).join(" > ") : ""
  return [
    `发散主题：${topic}`,
    path ? `已选方向路径：${path}` : "已选方向路径：（无，请给出首轮发散方向）",
    "",
    `请为该主题生成 ${MAX_DIRECTIONS} 个可继续深挖的发散方向选项。`,
  ].join("\n")
}

/** 构建发散灵感的 user prompt */
export function buildDivergePrompt(topic: string, steps: GuideDirection[]): string {
  const path = steps.map((d) => d.label).join(" > ")
  return [
    `发散主题：${topic}`,
    `发散路径：${path}`,
    "",
    `请沿着上述路径，发散出 ${MAX_IDEAS} 条具体的程序开发/小功能灵感。`,
  ].join("\n")
}

/** 拼接复制用的灵感文本 */
export function buildIdeaCopyText(idea: IdeaItem): string {
  return idea.description
    ? `【${idea.title}】${idea.description}`
    : `【${idea.title}】`
}

/** 按点路径从 i18n 对象解析标签（如 "ideaGenerator.category.desktopTool"），取不到返回兜底 */
export function resolveI18nLabel(
  i18n: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const label = key
    .split(".")
    .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], i18n)
  return typeof label === "string" ? label : fallback
}

/** 通用选项条目（标题 + 描述，方向与灵感共用的底层结构） */
interface OptionItem {
  title: string
  description: string
}

/**
 * 解析 Markdown 列表为选项列表（方向与灵感共用的底层解析）
 * 支持 `- **标题**：描述` / `- 标题：描述` / `1. 标题：描述` 等行格式；
 * 解析失败时按行拆分，仍无结果则降级为单条兜底
 */
function parseOptionList(raw: string, max: number, fallbackTitle: string): OptionItem[] {
  const items: OptionItem[] = []
  const seen = new Set<string>()
  const lines = raw.split("\n")

  for (const line of lines) {
    const trimmed = line
      .trim()
      // 去掉列表前缀（- * • 或 数字序号）
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+[.)、]\s*/, "")
    if (!trimmed) continue

    // 提取「标题：描述」（优先中文冒号，其次英文冒号）
    let title = trimmed
    let description = ""
    const colonIdx = trimmed.indexOf("：")
    const colonIdxEn = trimmed.indexOf(":")
    const idx = colonIdx >= 0 ? colonIdx : colonIdxEn
    if (idx > 0) {
      title = trimmed.slice(0, idx).trim()
      description = trimmed.slice(idx + 1).trim()
    }

    // 清洗标题（去掉 ** 加粗与 Markdown 标题标记）
    title = title.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim()
    if (!title || seen.has(title)) continue
    seen.add(title)

    items.push({
      title: title.length > 60 ? title.slice(0, 60) : title,
      description: description.length > 500 ? description.slice(0, 500) : description,
    })
    if (items.length >= max) break
  }

  // 兜底：完全未解析出时按整段文本作为单条展示，保证界面不空白
  if (items.length === 0 && raw.trim()) {
    items.push({ title: fallbackTitle, description: raw.trim().slice(0, 500) })
  }
  return items
}

/** 解析 AI 返回的灵感列表文本为 IdeaItem[] */
export function parseIdeasResponse(raw: string): IdeaItem[] {
  return parseOptionList(raw, MAX_IDEAS, "灵感").map((o, i) => ({
    id: `idea-${i + 1}`,
    title: o.title,
    description: o.description,
  }))
}

/** 解析 AI 返回的方向选项文本为 GuideDirection[] */
export function parseDirectionsResponse(raw: string): GuideDirection[] {
  return parseOptionList(raw, MAX_DIRECTIONS, "方向").map((o, i) => ({
    id: `dir-${i + 1}`,
    label: o.title,
    description: o.description,
  }))
}
