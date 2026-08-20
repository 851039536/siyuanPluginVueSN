/**
 * 正则测试器工具 - 正则解释器
 * 将正则表达式逐段拆解为可读 token，帮助理解每个符号的含义
 */

export interface RegexToken {
  /** 原始 token 文本（如 \d、{3}、(?:...)） */
  raw: string
  /** 含义的 i18n 键（如 explainDigit / explainStar） */
  meaningKey: string
  /** 是否为元字符（用于高亮样式区分） */
  isMeta: boolean
}

/** 转义序列 → 含义 i18n 键（字面量转义如 \. \( 统一回退 explainEscapedChar） */
const ESCAPE_MEANINGS: Record<string, string> = {
  d: "explainDigit",
  D: "explainNonDigit",
  w: "explainWordChar",
  W: "explainNonWordChar",
  s: "explainWhitespace",
  S: "explainNonWhitespace",
  b: "explainWordBoundary",
  B: "explainNonWordBoundary",
  n: "explainNewline",
  t: "explainTab",
  r: "explainCarriageReturn",
  f: "explainFormFeed",
  v: "explainVerticalTab",
  0: "explainNull",
}

/** 查找与 openIdx 处括号配对的闭合位置（跳过转义、支持嵌套），找不到返回 -1 */
function findClosing(
  pattern: string,
  openIdx: number,
  openCh: string,
  closeCh: string,
): number {
  let depth = 0
  for (let i = openIdx; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === "\\") {
      i++
      continue
    }
    if (c === openCh) {
      depth++
    } else if (c === closeCh) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * 将正则表达式拆解为解释 token 列表。
 * 纯词法解析，不依赖正则合法性（非法正则也能尽力解释）。
 * @param pattern 正则表达式文本（不含定界符）
 */
export function explainRegex(pattern: string): RegexToken[] {
  const tokens: RegexToken[] = []
  let i = 0

  while (i < pattern.length) {
    const ch = pattern[i]

    // 转义序列：\X
    if (ch === "\\" && i + 1 < pattern.length) {
      const esc = pattern[i + 1]
      const raw = `\\${esc}`
      tokens.push({
        raw,
        meaningKey: ESCAPE_MEANINGS[esc] ?? "explainEscapedChar",
        isMeta: true,
      })
      i += 2
      continue
    }

    // 字符类：[...] 或 [^...]
    if (ch === "[") {
      const end = findClosing(pattern, i, "[", "]")
      if (end !== -1) {
        const raw = pattern.slice(i, end + 1)
        tokens.push({
          raw,
          meaningKey: raw.startsWith("[^") ? "explainNegatedClass" : "explainCharClass",
          isMeta: true,
        })
        i = end + 1
        continue
      }
    }

    // 分组：(...) / (?:...) / (?=...) / (?!...) / (?<=...) / (?<!...)
    if (ch === "(") {
      const end = findClosing(pattern, i, "(", ")")
      if (end !== -1) {
        const inner = pattern.slice(i + 1, end)
        const raw = pattern.slice(i, end + 1)
        let meaningKey = "explainGroup"
        if (inner.startsWith("?:")) meaningKey = "explainNonCaptureGroup"
        else if (inner.startsWith("?=")) meaningKey = "explainLookahead"
        else if (inner.startsWith("?!")) meaningKey = "explainNegativeLookahead"
        else if (inner.startsWith("?<=")) meaningKey = "explainLookbehind"
        else if (inner.startsWith("?<!")) meaningKey = "explainNegativeLookbehind"
        tokens.push({
          raw,
          meaningKey,
          isMeta: true,
        })
        i = end + 1
        continue
      }
    }

    // 量词：* + ?（含非贪婪 *? +? ??）
    if (ch === "*" || ch === "+" || ch === "?") {
      const lazy = pattern[i + 1] === "?"
      const raw = lazy ? `${ch}?` : ch
      let meaningKey: string
      if (ch === "*") meaningKey = lazy ? "explainLazyStar" : "explainStar"
      else if (ch === "+") meaningKey = lazy ? "explainLazyPlus" : "explainPlus"
      else meaningKey = lazy ? "explainLazyOptional" : "explainOptional"
      tokens.push({
        raw,
        meaningKey,
        isMeta: true,
      })
      i += lazy ? 2 : 1
      continue
    }

    // 量词：{n} / {n,} / {n,m}
    if (ch === "{") {
      const m = pattern.slice(i).match(/^\{\s*\d+\s*(,\s*(?:\d+\s*)?)?\}/)
      if (m) {
        const raw = m[0]
        const isExact = /^\{[^,}]*\}$/.test(raw)
        tokens.push({
          raw,
          meaningKey: isExact ? "explainRepeatExact" : "explainRepeatRange",
          isMeta: true,
        })
        i += raw.length
        continue
      }
    }

    // 锚点 / 或 / 任意字符
    if (ch === "^") {
      tokens.push({
        raw: "^",
        meaningKey: "explainStart",
        isMeta: true,
      })
      i++
      continue
    }
    if (ch === "$") {
      tokens.push({
        raw: "$",
        meaningKey: "explainEnd",
        isMeta: true,
      })
      i++
      continue
    }
    if (ch === "|") {
      tokens.push({
        raw: "|",
        meaningKey: "explainOr",
        isMeta: true,
      })
      i++
      continue
    }
    if (ch === ".") {
      tokens.push({
        raw: ".",
        meaningKey: "explainAny",
        isMeta: true,
      })
      i++
      continue
    }

    // 普通字符：字面量匹配
    tokens.push({
      raw: ch,
      meaningKey: "explainLiteral",
      isMeta: false,
    })
    i++
  }

  return tokens
}
