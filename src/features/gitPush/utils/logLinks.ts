// 脚本运行输出链接识别：把日志按 http(s) 链接切分为文本 / 链接片段，供模板渲染可点击链接

/** 输出片段：url 存在时渲染为可点击链接 */
export interface LogLinkSegment {
  text: string
  url?: string
}

/** http(s) 链接（排除空白与引号括号等常见包裹字符） */
const URL_PATTERN = /https?:\/\/[^\s<>"'`）】]+/g

/** 链接尾部常被句子标点 / 右括号粘住，需剥回给普通文本 */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}"'。，；：！？）】」』]+$/

/**
 * 把日志文本切分为「普通文本 / 链接」片段序列
 *
 * - 仅识别 http(s) 链接，避免相对路径、命令名被误判
 * - 尾随标点（`.,`、`）`、`]` 等）不计入链接，保持原文本观感
 * - 纯函数：不触碰 DOM，便于单测
 */
export function splitLogLinks(text: string): LogLinkSegment[] {
  if (!text) return []

  const segments: LogLinkSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0]
    const trailing = raw.match(TRAILING_PUNCTUATION)?.[0] ?? ""
    const url = trailing ? raw.slice(0, -trailing.length) : raw
    const start = match.index ?? 0

    // 剥完标点后只剩 scheme（如 "https://"）不视为链接
    if (!url || url.length <= "https://".length) continue

    if (start > lastIndex) segments.push({ text: text.slice(lastIndex, start) })
    segments.push({ text: url, url })
    if (trailing) segments.push({ text: trailing })
    lastIndex = start + raw.length
  }

  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) })
  return segments
}
