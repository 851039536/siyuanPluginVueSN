// gitPush 补丁模型（纯函数）：把原始 `git diff` 文本切成可寻址的 hunk / 行。
//
// 为什么保留原始行文本而不是复用 diffText 的 DiffLine：
//   DiffLine 是渲染模型，已剥离 hunk 范围并加入词级分段；用它反推 patch 会丢
//   `\ No newline at end of file`、CRLF、rename 头等对 git apply 有意义的细节。
//   这里只做「切分 + 定位」，重建交给 hunkPatch。

/** 一行补丁的语义；noNewline 是紧跟上一行的 `\ No newline at end of file` 标记 */
export type PatchLineKind = "context" | "add" | "del" | "noNewline"

export interface PatchLine {
  /** 在所属 FilePatch 内稳定递增，供 UI 记录选择；context / noNewline 不可选 */
  id: number
  kind: PatchLineKind
  /** 去掉首列前缀与行尾符后的内容；noNewline 行保留标记原文 */
  text: string
  /** 原始行（含首列前缀与行尾符），重建时原样复用 */
  raw: string
  /** 原始行尾符：CRLF 补丁不能被改写成 LF */
  eol: string
}

export interface PatchHunk {
  /** 在所属 FilePatch 内的序号 */
  index: number
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  /** `@@ ... @@` 之后的分段说明（保留原样，可能为空串） */
  section: string
  headerRaw: string
  eol: string
  lines: PatchLine[]
  raw: string
}

export interface FilePatch {
  /** hunk 之前的原始行（diff --git / index / --- / +++ / rename 等） */
  preamble: string[]
  hunks: PatchHunk[]
  /** git 输出的二进制标记（`Binary files ... differ` / `GIT binary patch`） */
  binary: boolean
  raw: string
}

const DIFF_HEADER_RE = /^diff --(?:git|cc|combined) /
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/

interface HunkHeader {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  section: string
  headerRaw: string
  eol: string
}

/** 按 `\n` 切分且保留每行行尾符；末尾没有换行时不额外补空行 */
function splitRawLines(text: string): string[] {
  const lines: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      lines.push(text.slice(start, i + 1))
      start = i + 1
    }
  }
  if (start < text.length) lines.push(text.slice(start))
  return lines
}

function lineEol(raw: string): string {
  if (raw.endsWith("\r\n")) return "\r\n"
  return raw.endsWith("\n") ? "\n" : ""
}

function bodyOf(raw: string): string {
  const eol = lineEol(raw)
  return eol ? raw.slice(0, -eol.length) : raw
}

function parseHunkHeader(raw: string): HunkHeader | null {
  const match = HUNK_HEADER_RE.exec(bodyOf(raw))
  if (!match) return null
  return {
    oldStart: Number(match[1]),
    // git 省略 `,1` 表示长度为 1；`-0,0` 这类零长度必须保留显式 0
    oldCount: match[2] === undefined ? 1 : Number(match[2]),
    newStart: Number(match[3]),
    newCount: match[4] === undefined ? 1 : Number(match[4]),
    section: match[5] ?? "",
    headerRaw: raw,
    eol: lineEol(raw),
  }
}

function parseFileBlock(lines: string[]): FilePatch {
  const firstHunk = lines.findIndex((raw) => HUNK_HEADER_RE.test(bodyOf(raw)))
  const preamble = firstHunk < 0 ? lines.slice() : lines.slice(0, firstHunk)
  const hunks: PatchHunk[] = []
  let nextLineId = 0
  let i = firstHunk < 0 ? lines.length : firstHunk

  while (i < lines.length) {
    const header = parseHunkHeader(lines[i])
    if (!header) break
    const hunkLines: PatchLine[] = []
    i++
    while (i < lines.length) {
      const raw = lines[i]
      const body = bodyOf(raw)
      if (HUNK_HEADER_RE.test(body) || DIFF_HEADER_RE.test(body)) break
      const prefix = body[0]
      // 只接受补丁行；空行或其它文本说明输入异常，停止本 hunk，避免把后续内容吞进来
      if (prefix !== "\\" && prefix !== "+" && prefix !== "-" && prefix !== " ") break
      const kind: PatchLineKind = prefix === "\\"
        ? "noNewline"
        : prefix === "+"
          ? "add"
          : prefix === "-"
            ? "del"
            : "context"
      hunkLines.push({
        id: nextLineId++,
        kind,
        text: body.slice(1),
        raw,
        eol: lineEol(raw),
      })
      i++
    }
    hunks.push({
      index: hunks.length,
      ...header,
      lines: hunkLines,
      raw: header.headerRaw + hunkLines.map((line) => line.raw).join(""),
    })
    // 内层因非补丁行退出时，外层再解析同一行会失败并终止，不会死循环
    if (i < lines.length && !HUNK_HEADER_RE.test(bodyOf(lines[i]))) break
  }

  const binary = preamble.some((raw) => {
    const body = bodyOf(raw)
    return body.startsWith("GIT binary patch")
      || body.startsWith("Binary files ")
      || body.startsWith("Binary file ")
  })

  return { preamble, hunks, binary, raw: lines.join("") }
}

/**
 * 解析一段 git diff 文本。
 *
 * 支持多文件块（`diff --git` / `diff --cc`）、计数省略的 hunk 头、
 * CRLF、`\ No newline at end of file` 与二进制标记；异常行会截断当前 hunk
 * 而不是抛错，调用方可通过 `hunks.length` 判断可操作性。
 */
export function parsePatch(text: string): FilePatch[] {
  if (!text) return []
  const blocks: string[][] = []
  let current: string[] = []
  let sawDiffHeader = false

  for (const raw of splitRawLines(text)) {
    if (DIFF_HEADER_RE.test(bodyOf(raw))) {
      if (sawDiffHeader) {
        blocks.push(current)
        current = [raw]
      } else {
        current.push(raw)
        sawDiffHeader = true
      }
      continue
    }
    current.push(raw)
  }
  if (current.length) blocks.push(current)
  return blocks.map(parseFileBlock)
}

/** 只有 add / del 行可以被用户选中；context 与 noNewline 永远跟随 */
export function isSelectableLine(line: PatchLine): boolean {
  return line.kind === "add" || line.kind === "del"
}
