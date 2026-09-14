// gitPush 差异文本处理（纯函数）：缓存键、着色行解析、词级高亮、AI 上下文预算采样

/** 差异缓存键（fileDiffs 缓存 / diffLoading 标记 / 面板预取共用同一键空间） */
export function diffCacheKey(filePath: string, staged: boolean): string {
  return `${staged ? "s" : "u"}::${filePath}`
}

/** diff 文本行类型（meta = diff --git / index / --- / +++ 等文件头行） */
export type DiffLineType = "add" | "del" | "hunk" | "ctx" | "meta"

/** 词级差异分段（changed=true 为行内真正变化的片段） */
export interface DiffSegment { text: string, changed: boolean }

/** 带类型的 diff 行（用于着色渲染），oldNo/newNo 为旧/新文件行号 */
export interface DiffLine {
  text: string
  type: DiffLineType
  oldNo?: number
  newNo?: number
  /** 词级差异分段（仅 add/del 行与对侧行配对成功时存在） */
  segments?: DiffSegment[]
}

/** diff 文件头行前缀（渲染时淡化显示，不参与行号计算） */
const DIFF_META_PREFIXES = ["diff --git", "index ", "--- ", "+++ ", "new file", "deleted file", "old mode", "new mode", "rename ", "copy ", "similarity ", "dissimilarity ", "Binary files", "\\ No newline"]

/** 将 diff 文本解析为带类型与行号的行数组（剥离行首 +/-/空格标记，标记改由渲染层的符号列展示） */
export function parseDiffLines(diffText: string): DiffLine[] {
  if (!diffText) return []
  let oldNo = 0
  let newNo = 0
  const result: DiffLine[] = []
  for (const line of diffText.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk) {
      oldNo = Number(hunk[1])
      newNo = Number(hunk[2])
      result.push({ text: line, type: "hunk" })
    } else if ((oldNo === 0 && newNo === 0) || DIFF_META_PREFIXES.some((p) => line.startsWith(p))) {
      // 首个 hunk 之前的所有行、以及多文件 diff 中间的文件头行均为 meta
      result.push({ text: line, type: "meta" })
    } else if (line.startsWith("+")) {
      result.push({ text: line.slice(1), type: "add", newNo: newNo++ })
    } else if (line.startsWith("-")) {
      result.push({ text: line.slice(1), type: "del", oldNo: oldNo++ })
    } else {
      result.push({ text: line.slice(1), type: "ctx", oldNo: oldNo++, newNo: newNo++ })
    }
  }
  // 去掉文本末尾换行符经 split 产生的空行
  const last = result[result.length - 1]
  if (last && (last.type === "ctx" || last.type === "meta") && last.text === "") result.pop()
  markInlineDiff(result)
  return result
}

/** diff 行类型 → 行首符号（渲染层符号列使用） */
export const DIFF_SIGN: Record<DiffLineType, string> = {
  add: "+",
  del: "−",
  hunk: "@",
  ctx: " ",
  meta: " ",
}

/** 统计 diff 增/删行数（标题行 +N / −N 展示） */
export function countDiffStats(lines: DiffLine[]): { add: number, del: number } {
  let add = 0
  let del = 0
  for (const line of lines) {
    if (line.type === "add") add++
    else if (line.type === "del") del++
  }
  return { add, del }
}

/** 单文件 diff 的最小分析配额（变更文件数超过预算容量时，仅完整覆盖前 capacity 个文件，其余由变更文件清单兜底） */
const MIN_PER_FILE_DIFF_BUDGET = 500
/** 单个 hunk 的最小保留字符数（大文件 diff 按此配额均匀采样 hunk） */
const MIN_HUNK_CHARS = 400
/** 单文件默认采样 hunk 数（头/中/尾均匀分布） */
const MIN_SAMPLE_HUNKS = 3

/**
 * 按文件分块构建 AI 分析的 diff 上下文：每个文件的 diff 均分配额，短文件未用满的预算回补长文件。
 * 单文件 diff 超配额时按 hunk 均匀采样（保留文件头 + 头/中/尾 hunk），保证大文件改动的轮廓对 AI 可见而非只看开头。
 * 文件数超过预算容量（total / MIN_PER_FILE_DIFF_BUDGET）时仅取前 capacity 个文件分块并追加省略提示，
 * 避免均分到极小配额产生无信息量的 diff 头碎片。
 * 替代整体 substring 硬截断（旧逻辑在首个大文件 diff 超限时，其余文件的改动对 AI 完全不可见）。
 * 输入应为纯 diff（不含提交信息头等前导内容），无 diff 内容返回空串。
 */
export function buildDiffContext(fullDiff: string, budget: number): string {
  const total = budget > 0 ? budget : 10000
  const chunks = fullDiff.split(/\n(?=diff --git )/).filter((c) => c.trim())
  if (chunks.length === 0) { return "" }

  const capacity = Math.max(1, Math.floor(total / MIN_PER_FILE_DIFF_BUDGET))
  const selected = chunks.slice(0, capacity)
  const baseQuota = selected.length === 1 ? total : Math.floor(total / selected.length)
  const pieces = selected.map((full) => {
    const truncated = full.length > baseQuota
    return { full, quota: truncated ? baseQuota : full.length, truncated }
  })

  // 短文件未用满的配额按序回补给被截断的长文件，使其能采样更多 hunk
  let remaining = total - pieces.reduce((sum, p) => sum + p.quota, 0)
  for (const p of pieces) {
    if (remaining <= 0 || !p.truncated) { continue }
    const extra = Math.min(remaining, p.full.length - p.quota)
    p.quota += extra
    p.truncated = p.quota < p.full.length
    remaining -= extra
  }

  const body = pieces
    .map((p) => p.truncated ? `${sampleDiffChunk(p.full, p.quota)}\n（此文件 diff 过长已截断）` : p.full)
    .join("\n\n")
  const omitted = chunks.length - selected.length
  return omitted > 0 ? `${body}\n（其余 ${omitted} 个文件的 diff 因上下文预算省略，请结合变更文件清单判断）` : body
}

/**
 * 对单个文件的 diff 块做 hunk 均匀采样：文件头（diff --git 头）完整保留，hunk 超过配额时抽取
 * 头/中/尾若干 hunk（每个 hunk 按配额截断），中间省略位置用标记提示。无 hunk（二进制等）回退头部截断。
 */
function sampleDiffChunk(chunk: string, budget: number): string {
  if (chunk.length <= budget) { return chunk }
  const headerEnd = chunk.indexOf("\n@@ ")
  if (headerEnd < 0) { return chunk.substring(0, budget) }
  const header = chunk.substring(0, headerEnd)
  const hunks = chunk.substring(headerEnd).split(/\n(?=@@ )/).filter(Boolean)

  const bodyBudget = Math.max(MIN_HUNK_CHARS, budget - header.length)
  const maxByBudget = Math.floor(bodyBudget / MIN_HUNK_CHARS)
  const sampleCount = Math.max(1, Math.min(MIN_SAMPLE_HUNKS, hunks.length, maxByBudget))
  const hunkBudget = Math.floor(bodyBudget / sampleCount)

  const parts: string[] = [header]
  let last = -1
  for (const i of sampleIndices(hunks.length, sampleCount)) {
    if (last >= 0 && i > last + 1) { parts.push(`... 省略 ${i - last - 1} 个 hunk ...`) }
    parts.push(hunks[i].substring(0, hunkBudget))
    last = i
  }
  if (last >= 0 && last < hunks.length - 1) { parts.push(`... 省略 ${hunks.length - 1 - last} 个 hunk ...`) }
  return parts.join("\n")
}

/** 从 [0, n) 均匀采样 k 个下标（k>=n 全取；k=1 取中间；否则首尾必含、中间均匀分布） */
function sampleIndices(n: number, k: number): number[] {
  if (k >= n) { return Array.from({ length: n }, (_, i) => i) }
  if (k === 1) { return [Math.floor(n / 2)] }
  const idxs: number[] = []
  for (let i = 0; i < k; i++) {
    idxs.push(Math.round((i * (n - 1)) / (k - 1)))
  }
  return idxs
}

// 行内变化占比阈值：中间变化片段超过此比例视为整行重写，不做词级高亮（高亮反而添噪）
const INLINE_DIFF_MAX_CHANGED_RATIO = 0.6

/** 对配对的 del/add 行做公共前缀/后缀裁剪，生成词级差异分段；变化过大或完全相同时返回 null */
function diffSegments(del: string, add: string): { del: DiffSegment[], add: DiffSegment[] } | null {
  const minLen = Math.min(del.length, add.length)
  let prefix = 0
  while (prefix < minLen && del[prefix] === add[prefix]) prefix++
  let suffix = 0
  while (suffix < minLen - prefix && del[del.length - 1 - suffix] === add[add.length - 1 - suffix]) suffix++
  const delMid = del.slice(prefix, del.length - suffix)
  const addMid = add.slice(prefix, add.length - suffix)
  if (!delMid && !addMid) return null
  const maxLen = Math.max(del.length, add.length)
  if (Math.max(delMid.length, addMid.length) / maxLen > INLINE_DIFF_MAX_CHANGED_RATIO) return null
  const build = (text: string, mid: string): DiffSegment[] => {
    const segs: DiffSegment[] = []
    if (prefix) segs.push({ text: text.slice(0, prefix), changed: false })
    if (mid) segs.push({ text: mid, changed: true })
    if (suffix) segs.push({ text: text.slice(text.length - suffix), changed: false })
    return segs
  }
  return { del: build(del, delMid), add: build(add, addMid) }
}

/** 后处理：将连续 del 块与紧随的 add 块按下标配对，为每对行生成词级差异分段 */
function markInlineDiff(lines: DiffLine[]): void {
  let i = 0
  while (i < lines.length) {
    if (lines[i].type !== "del") { i++; continue }
    const delStart = i
    while (i < lines.length && lines[i].type === "del") i++
    const addStart = i
    while (i < lines.length && lines[i].type === "add") i++
    const pairCount = Math.min(addStart - delStart, i - addStart)
    for (let k = 0; k < pairCount; k++) {
      const delLine = lines[delStart + k]
      const addLine = lines[addStart + k]
      const segs = diffSegments(delLine.text, addLine.text)
      if (segs) {
        delLine.segments = segs.del
        addLine.segments = segs.add
      }
    }
  }
}
