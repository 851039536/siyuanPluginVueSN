// gitPush 报告指标引擎 — numstat 解析层：git log --numstat 输出 → 结构化提交块（纯函数）
// 子模块间直连 import（不走 barrel 防环）；Node 单测可加载（禁 import "../utils" / "../types" 桶）。
import type { NumstatCommit } from "./types"

/** 去除 git 路径的 C 风格引号（与 WorktreeOps 同策略：仅剥首尾引号，极端字符有限支持） */
export function unquotePath(s: string): string {
  const t = s.trim()
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
}

/**
 * 解析 git log --numstat 输出（header 段数自适应，兼容两种 format）。
 * 结构：每条提交 = "<RS>header 段...\n" + 若干 "新增\t删除\t路径\n" 行，提交间以空行分隔。
 * - 旧格式（getNumstatLog，报告视图）：header = "<US>作者<US>ISO日期"（2 段），解析 author/date
 * - 新格式（getCommitStatsLog，行数统计）：header = "<US>hash<US>作者<US>ISO日期<US>主题"（4 段），额外解析 hash/message
 *
 * 增量扫描（fetchIncremental）复用 parseNumstatBlock 逐块解析同一份输出，两者语义必须保持一致。
 */
export function parseNumstatBlocks(raw: string): NumstatCommit[] {
  const commits: NumstatCommit[] = []
  const chunks = raw.split("\x1e")
  for (let i = 1; i < chunks.length; i++) {
    const parsed = parseNumstatBlock(chunks[i])
    if (parsed) commits.push(parsed)
  }
  return commits
}

/**
 * 解析单个 numstat 块（不含前导 \x1e 分隔符）。
 * 供 parseNumstatBlocks（整段解析）与 ReportOps.fetchIncremental（逐块增量解析）共用，
 * 避免两处各写一份 header 段数判定逻辑而漂移。无法解析（header 段数不足/缺作者或日期）返回 null。
 */
export function parseNumstatBlock(chunk: string): NumstatCommit | null {
  const lines = chunk.split("\n")
  const header = lines[0] || ""
  const parts = header.split("\x1f")
  // 4 段新格式：hash / author / date / message（subject 内含 \x1f 时用 slice(3) 保底还原）
  if (parts.length >= 4) {
    const hash = parts[0].trim()
    const author = parts[1].trim()
    const date = parts[2].trim()
    const message = parts.slice(3).join("\x1f").trim()
    if (!author || !date) return null
    return { hash, author, date, message, files: parseFileLines(lines) }
  }
  // 2 段旧格式：author / date
  if (parts.length >= 2) {
    const author = parts[0].trim()
    const date = parts[1].trim()
    if (!author || !date) return null
    return { author, date, files: parseFileLines(lines) }
  }
  return null
}

/** 解析 numstat 块内的文件变更行（"新增\t删除\t路径"，二进制文件 git 输出 "-\t-" 跳过，无效行跳过） */
function parseFileLines(lines: string[]): NumstatCommit["files"] {
  const files: NumstatCommit["files"] = []
  for (let j = 1; j < lines.length; j++) {
    const line = lines[j]
    if (!line) continue
    const parts = line.split("\t")
    if (parts.length < 3) continue
    const added = Number.parseInt(parts[0], 10)
    const deleted = Number.parseInt(parts[1], 10)
    if (Number.isNaN(added) || Number.isNaN(deleted)) continue
    files.push({ path: unquotePath(parts.slice(2).join("\t")), added, deleted })
  }
  return files
}

/**
 * 解析 ISO 日期为毫秒时间戳（无法解析返回 0）。
 * 跨子模块共用的时间解析原语（aggregateAuthor / aggregateFile / rhythm / scoring 皆需），
 * 归入本解析层避免兄弟模块互引成环。
 */
export function parseIsoMs(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}
