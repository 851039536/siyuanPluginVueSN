// 长文翻译 — 语言检测、目标语言推导与长文分段（纯函数）
import {
  LANGUAGE_I18N_KEYS,
  LANGUAGE_MAP,
} from "../types"

/** 可自动识别的语种（与 LANGUAGE_MAP 的 code 对齐；unknown 表示无法判定） */
export type DetectedLanguage = "zh" | "en" | "ja" | "ko" | "unknown"

/** 单次请求允许的最大字符数（超出则按段落分段翻译） */
export const TRANSLATE_CHUNK_SIZE = 2000

/**
 * 检测文本主语言
 *
 * 规则（按优先级）：
 * 1. 出现假名 → 日文（汉字与假名共用，靠假名区分）
 * 2. 出现谚文 → 韩文
 * 3. 比较「汉字数」与「拉丁词数」：一个汉字的信息量约等于一个英文单词，
 *    汉字更多判为中文，否则（存在拉丁词）判为英文
 * 4. 其余（纯数字/符号/空）→ unknown
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || !text.trim()) return "unknown"

  let kana = 0
  let hangul = 0
  let cjk = 0
  let latinWords = 0
  let inLatinWord = false

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code >= 0x3040 && code <= 0x30ff) {
      kana += 1
      inLatinWord = false
    } else if (code >= 0xac00 && code <= 0xd7af) {
      hangul += 1
      inLatinWord = false
    } else if (code >= 0x4e00 && code <= 0x9fff) {
      cjk += 1
      inLatinWord = false
    } else if (
      (code >= 0x41 && code <= 0x5a)
      || (code >= 0x61 && code <= 0x7a)
    ) {
      // 连续的拉丁字母记为一个单词
      if (!inLatinWord) {
        latinWords += 1
        inLatinWord = true
      }
    } else {
      inLatinWord = false
    }
  }

  if (kana > 0) return "ja"
  if (hangul > 0) return "ko"
  if (cjk > 0 || latinWords > 0) return cjk > latinWords ? "zh" : "en"
  return "unknown"
}

/**
 * 「译为另一种语言」的目标语言推导
 * 中文 ↔ 英文互译；其余语种（及无法判定时）默认译为中文
 */
export function oppositeLanguage(language: string): string {
  if (language === "zh") return "en"
  if (language === "en") return "zh"
  return "zh"
}

/** 解析结果 */
export interface ResolvedLanguages {
  /** 实际使用的源语言（auto 表示未检测出具体语种） */
  source: string
  /** 实际使用的目标语言 */
  target: string
  /** 源与目标是否为同一种语言（同语言翻译无意义，需提示用户） */
  sameLanguage: boolean
}

/**
 * 解析实际使用的源 / 目标语言
 *
 * - source = "auto" 时用检测结果回填；检测不出则保持 "auto"
 * - target = "auto" 时译为「另一种语言」（中文 → 英文，英文 → 中文）
 */
export function resolveLanguages(params: {
  source: string
  target: string
  detected: DetectedLanguage
}): ResolvedLanguages {
  const { source, target, detected } = params

  const resolvedSource
    = source === "auto"
      ? detected === "unknown"
        ? "auto"
        : detected
      : source

  const resolvedTarget
    = target === "auto" ? oppositeLanguage(resolvedSource) : target

  return {
    source: resolvedSource,
    target: resolvedTarget,
    sameLanguage:
      resolvedSource !== "auto" && resolvedSource === resolvedTarget,
  }
}

/**
 * 长文分段：按空行 → 单行 → 硬切逐级降级，保证每段不超过 maxSize
 * 段落边界优先，尽量不破坏语义完整性
 */
export function splitTextChunks(text: string, maxSize = TRANSLATE_CHUNK_SIZE): string[] {
  const normalized = text.replace(/\r\n/g, "\n")
  if (!normalized) return []
  if (normalized.length <= maxSize) return [normalized]

  const chunks: string[] = []
  let current = ""

  for (const paragraph of normalized.split(/\n{2,}/)) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length <= maxSize) {
      current = candidate
      continue
    }

    // 当前缓冲已满 → 先落一段
    if (current) {
      chunks.push(current)
      current = ""
    }

    if (paragraph.length <= maxSize) {
      current = paragraph
      continue
    }

    // 单段超长 → 降级按行切
    for (const line of paragraph.split("\n")) {
      const lineCandidate = current ? `${current}\n${line}` : line
      if (lineCandidate.length <= maxSize) {
        current = lineCandidate
        continue
      }

      if (current) {
        chunks.push(current)
        current = ""
      }

      if (line.length <= maxSize) {
        current = line
        continue
      }

      // 单行仍超长（无换行的超长串）→ 硬切
      for (let i = 0; i < line.length; i += maxSize) {
        chunks.push(line.slice(i, i + maxSize))
      }
    }
  }

  if (current) chunks.push(current)
  return chunks
}

/**
 * 语言 code → 界面展示名
 * 优先取 i18n 本地化名称（autoDetect / chinese / english ...），回退到内置中文名
 */
export function languageLabel(code: string, i18n?: Record<string, any>): string {
  const key = LANGUAGE_I18N_KEYS[code]
  if (key && i18n?.[key]) return i18n[key] as string
  return LANGUAGE_MAP[code] ?? code
}
