// gitPush 差异文本处理（纯函数）：缓存键、着色行解析、词级高亮、AI 上下文预算采样

/** 差异缓存键（fileDiffs 缓存 / diffLoading 标记 / 面板预取共用同一键空间） */
export function diffCacheKey(filePath: string, staged: boolean): string {
  return `${staged ? "s" : "u"}::${filePath}`
}

/**
 * diff 文本行类型：
 * - add/del/ctx：着色正文行
 * - hunk：`@@ -a,b +c,d @@` 分段头
 * - meta：diff --git / index / --- / +++ 等文件头行
 * - gap：两个 hunk 之间被 git 省略的未变行折叠条（不渲染内容，只提示相隔行数）
 */
export type DiffLineType = "add" | "del" | "hunk" | "ctx" | "meta" | "gap"

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
  /**
   * hunk 头尾部的所属作用域（git 从 `@@ -a,b +c,d @@` 之后带出的函数 / 类名，
   * 取决于仓库的 diff 驱动配置）；仅 hunk 行有值，hunk 行的 text 已剥离该部分
   */
  scope?: string
  /** 折叠条覆盖的未变行数；仅 gap 行有值 */
  gapCount?: number
}

/**
 * diff 文件头行前缀（渲染时淡化显示，不参与行号计算）。
 *  单个预编译正则替代逐前缀 startsWith：万行级 diff 每行省 13 次字符串扫描
 */
const DIFF_META_RE = /^(?:diff --git|index |--- |\+\+\+ |new file|deleted file|old mode|new mode|rename |copy |similarity |dissimilarity |Binary files|\\ No newline)/

/**
 * hunk 头：`@@ -旧起始,旧行数 +新起始,新行数 @@ 所属作用域`。
 * 行数省略时按 1 计（`@@ -5 +7 @@`）；作用域由 git 按语言规则带出（可能为空）。
 */
const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/

/**
 * 将 diff 文本解析为带类型与行号的行数组（剥离行首 +/-/空格标记，标记改由渲染层的符号列展示）。
 *
 * 相邻 hunk 之间会插入 `gap` 行（未变行折叠条）：git 默认只带 3 行上下文，
 * 两处改动相距较远时中间的行完全不出现在 diff 里，折叠条让「相隔多远」可见。
 */
export function parseDiffLines(diffText: string): DiffLine[] {
  if (!diffText) return []
  let oldNo = 0
  let newNo = 0
  /** 上一个 hunk 覆盖到的旧文件行号（null = 当前文件还没有出现 hunk） */
  let prevOldEnd: number | null = null
  const result: DiffLine[] = []
  for (const line of diffText.split("\n")) {
    // 首字符分流：hunk 正则只在 '@' 开头时执行（万行级 diff 绝大多数行免付正则开销）
    const head = line.charCodeAt(0)
    const hunk = head === 64 /* '@' */ ? HUNK_RE.exec(line) : null
    if (hunk) {
      const oldStart = Number(hunk[1])
      const oldCount = hunk[2] === undefined ? 1 : Number(hunk[2])
      const newStart = Number(hunk[3])
      // 未变行数：首个 hunk 取 oldStart - 1（纯新增文件 oldStart=0 时自然为 0），
      // 其后取与上一 hunk 末行之间的间隔
      const unseen = prevOldEnd === null ? oldStart - 1 : oldStart - prevOldEnd - 1
      if (unseen > 0) {
        result.push({
          text: "",
          type: "gap",
          gapCount: unseen,
        })
      }
      oldNo = oldStart
      newNo = newStart
      // hunk 行的 text 剥掉尾部作用域（由渲染层弱化展示），便于样式与复制分离
      const scope = hunk[5]?.trim() ?? ""
      result.push({
        text: line.slice(0, line.length - (hunk[5]?.length ?? 0)).trimEnd(),
        type: "hunk",
        scope: scope || undefined,
      })
      // 纯删除（oldCount=0）时该 hunk 不覆盖任何旧行，末行即起始行本身
      prevOldEnd = oldCount === 0 ? oldStart : oldStart + oldCount - 1
    } else if ((oldNo === 0 && newNo === 0) || DIFF_META_RE.test(line)) {
      // 首个 hunk 之前的所有行、以及多文件 diff 中间的文件头行均为 meta
      // 新文件头重置折叠基准，避免把上一个文件的末行算进本文件的首个 hunk
      if (head === 100 /* 'd' */ && line.startsWith("diff --git ")) prevOldEnd = null
      result.push({
        text: line,
        type: "meta",
      })
    } else if (line.startsWith("+")) {
      result.push({
        text: line.slice(1),
        type: "add",
        newNo: newNo++,
      })
    } else if (line.startsWith("-")) {
      result.push({
        text: line.slice(1),
        type: "del",
        oldNo: oldNo++,
      })
    } else {
      result.push({
        text: line.slice(1),
        type: "ctx",
        oldNo: oldNo++,
        newNo: newNo++,
      })
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
  gap: "⋯",
}

/** 统计 diff 增/删行数（标题行 +N / −N 展示） */
export function countDiffStats(lines: DiffLine[]): { add: number, del: number } {
  let add = 0
  let del = 0
  for (const line of lines) {
    if (line.type === "add") add++
    else if (line.type === "del") del++
  }
  return {
    add,
    del,
  }
}

/**
 * 从**原始 diff 文本**快速统计增删行数（不做行解析、不做词级对齐）。
 *
 * 用于「大量文件、只要一个数字」的场景（如审阅流侧栏每个文件的 +N −N）：
 * 跳过首个 hunk 之前的文件头，之后只按行首字符计数。
 * 比 parseDiffLines 快一个数量级——那条路径会建行对象、跑 LCS，给上百个文件算数字不值当。
 */
export function countRawDiffLines(raw: string): { add: number, del: number } {
  let add = 0
  let del = 0
  let inBody = false
  for (const line of raw.split("\n")) {
    if (!inBody) {
      if (line.startsWith("@@")) inBody = true
      continue
    }
    const head = line.charCodeAt(0)
    if (head === 43 /* '+' */) add++
    else if (head === 45 /* - */) del++
  }
  return {
    add,
    del,
  }
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
    return {
      full,
      quota: truncated ? baseQuota : full.length,
      truncated,
    }
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

// ── 词级高亮：token 级 LCS 对齐 + 变化块首尾字符裁剪 ──

/** 行内变化占比阈值：变化总量超过此比例视为整行重写，不做词级高亮（高亮反而添噪） */
const INLINE_DIFF_MAX_CHANGED_RATIO = 0.6
/** 参与 LCS 的最大 token 数：超长单行退化为「整行一个变化块」处理，避免 O(n²) DP 拖慢解析 */
const MAX_INLINE_TOKENS = 240
/** token 切分：标识符 / 空白段 / 单个符号（CJK 与标点逐字切分，天然按字级对齐） */
const TOKEN_RE = /[\w$]+|\s+|[^\w\s$]/g

/** 对齐后的块：eq 为两侧共有片段，chg 为两侧各自的改动片段（某侧可能为空串） */
type InlineBlock = { kind: "eq", text: string } | { kind: "chg", del: string, add: string }

function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? []
}

/**
 * 最长公共子序列对齐：产出 eq / chg 交替的块序列。
 * 比逐字符 diff 稳（不会把 `|| strict` 的零散字母错配到别处），相邻的删/插合并为同一个 chg 块。
 */
function alignBlocks(a: string[], b: string[]): InlineBlock[] {
  const n = a.length
  const m = b.length
  const width = m + 1
  // dp[i * width + j] = a[i..] 与 b[j..] 的 LCS 长度；token 数受 MAX_INLINE_TOKENS 约束，Uint16 足够
  const dp = new Uint16Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] = a[i] === b[j]
        ? dp[(i + 1) * width + j + 1] + 1
        : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
    }
  }
  const blocks: InlineBlock[] = []
  let delRun = ""
  let addRun = ""
  const flush = () => {
    if (!delRun && !addRun) return
    blocks.push({
      kind: "chg",
      del: delRun,
      add: addRun,
    })
    delRun = ""
    addRun = ""
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush()
      blocks.push({
        kind: "eq",
        text: a[i],
      })
      i++
      j++
      continue
    }
    // 相等时偏向「删除」：让两侧片段顺序稳定，避免同一输入产出不同分段
    if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      delRun += a[i++]
    } else {
      addRun += b[j++]
    }
  }
  while (i < n) delRun += a[i++]
  while (j < m) addRun += b[j++]
  flush()
  return blocks
}

/** 公共前缀长度 */
function commonPrefixLen(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a[i] === b[i]) i++
  return i
}

/** 公共后缀长度（不与已裁掉的前缀重叠） */
function commonSuffixLen(a: string, b: string, prefix: number): number {
  const max = Math.min(a.length, b.length) - prefix
  let i = 0
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i++
  return i
}

/**
 * 把变化块按公共前后缀再拆细：`line1` / `lineX` → eq"line" + chg"1"/"X"。
 * token 相同但拼写相近的标识符（改后缀、改数字）靠这一步拿到精确的字符级差异。
 */
function refineBlock(del: string, add: string): InlineBlock[] {
  const prefix = commonPrefixLen(del, add)
  const suffix = commonSuffixLen(del, add, prefix)
  const out: InlineBlock[] = []
  if (prefix) {
    out.push({
      kind: "eq",
      text: del.slice(0, prefix),
    })
  }
  const delMid = del.slice(prefix, del.length - suffix)
  const addMid = add.slice(prefix, add.length - suffix)
  if (delMid || addMid) {
    out.push({
      kind: "chg",
      del: delMid,
      add: addMid,
    })
  }
  if (suffix) {
    out.push({
      kind: "eq",
      text: del.slice(del.length - suffix),
    })
  }
  return out
}

/** 把块序列投影到某一侧的差异分段（相邻同类分段合并） */
function blocksToSegments(blocks: InlineBlock[], side: "del" | "add"): DiffSegment[] {
  const segs: DiffSegment[] = []
  for (const b of blocks) {
    const text = b.kind === "eq" ? b.text : b[side]
    if (!text) continue
    const changed = b.kind === "chg"
    const prev = segs[segs.length - 1]
    if (prev && prev.changed === changed) prev.text += text
    else segs.push({
      text,
      changed,
    })
  }
  return segs
}

/** 对配对的 del/add 行生成词级差异分段；完全相同时返回 null，变化过大时也返回 null（整行重写不做词级高亮） */
function diffSegments(del: string, add: string): { del: DiffSegment[], add: DiffSegment[] } | null {
  const delTokens = tokenize(del)
  const addTokens = tokenize(add)
  // 超长单行跳过 DP：整行当作一个变化块，只做首尾裁剪（O(n)）
  const raw: InlineBlock[] = delTokens.length > MAX_INLINE_TOKENS || addTokens.length > MAX_INLINE_TOKENS
    ? refineBlock(del, add)
    : alignBlocks(delTokens, addTokens).flatMap((b) => (b.kind === "chg" ? refineBlock(b.del, b.add) : [b]))

  let changedDel = 0
  let changedAdd = 0
  for (const b of raw) {
    if (b.kind !== "chg") continue
    changedDel += b.del.length
    changedAdd += b.add.length
  }
  if (!changedDel && !changedAdd) return null
  const maxLineLen = Math.max(del.length, add.length)
  if (Math.max(changedDel, changedAdd) / maxLineLen > INLINE_DIFF_MAX_CHANGED_RATIO) return null

  const delSegs = blocksToSegments(raw, "del")
  const addSegs = blocksToSegments(raw, "add")
  // 纯插入/纯删除：无变化的那一侧不拆段（整行同色才是最准确的表达）
  return {
    del: delSegs.some((s) => s.changed) ? delSegs : [],
    add: addSegs.some((s) => s.changed) ? addSegs : [],
  }
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
      if (!segs) continue
      // 单侧无变化时保持 segments 缺省，渲染层直接输出整行文本
      if (segs.del.length) delLine.segments = segs.del
      if (segs.add.length) addLine.segments = segs.add
    }
  }
}
