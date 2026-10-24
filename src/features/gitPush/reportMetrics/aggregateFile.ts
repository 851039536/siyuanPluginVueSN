// gitPush 报告指标引擎 — 文件聚合层：提交块 → 文件统计 Map + 跨项目行数汇总（纯函数）
import type { NumstatCommit } from "./types"
import { parseIsoMs } from "./parseNumstat"

/** 文件聚合中间态 */
export interface FileAgg {
  modCount: number
  authors: Set<string>
  lastIso: string
  /** lastIso 对应的毫秒时间戳（0 = 无有效日期），用于跨时区按真实时刻比较 */
  lastMs: number
  /** numstat 新增行汇总 */
  added: number
  /** numstat 删除行汇总 */
  deleted: number
}

/** 聚合文件统计（修改次数/参与人数/最后修改；返回 Map 路径→聚合态） */
export function aggregateFileStats(commits: NumstatCommit[]): Map<string, FileAgg> {
  const map = new Map<string, FileAgg>()
  for (const c of commits) {
    for (const f of c.files) {
      let agg = map.get(f.path)
      if (!agg) {
        agg = { modCount: 0, authors: new Set(), lastIso: "", lastMs: 0, added: 0, deleted: 0 }
        map.set(f.path, agg)
      }
      agg.modCount++
      agg.added += f.added
      agg.deleted += f.deleted
      agg.authors.add(c.author)
      // 按时间戳比较取最后修改：ISO 字符串字典序会因时区偏移符号 +/− 误判先后（如 +08:00 > -07:00）
      const ms = parseIsoMs(c.date)
      if (ms > agg.lastMs) {
        agg.lastMs = ms
        agg.lastIso = c.date
      }
    }
  }
  return map
}

/** 文件路径是否应纳入统计（extensions 黑名单排除语义：空数组/undefined = 不过滤，全部通过；勾选 = 排除该格式） */
export function shouldIncludeFile(filePath: string, extensions?: string[]): boolean {
  if (!extensions || extensions.length === 0) return true
  const lower = filePath.toLowerCase()
  return !extensions.some(ext => lower.endsWith(ext.toLowerCase()))
}

/** 行数增量（新增/删除行） */
export interface LineDelta {
  added: number
  deleted: number
}

/** 单次遍历同时汇总项目合计与按作者分组（extensions 可选黑名单排除过滤）。
 * sumProjectLines / sumAuthorLines 的共用核心：原先两函数各自完整遍历一遍 commits×files，
 * 跨项目全量分析（"all" + 大仓库）时是纯 CPU 浪费，合并后单遍产出两者。 */
export function sumLineDeltas(
  commits: NumstatCommit[],
  extensions?: string[],
): { project: LineDelta, authors: Map<string, LineDelta> } {
  const project: LineDelta = { added: 0, deleted: 0 }
  const authors = new Map<string, LineDelta>()
  for (const c of commits) {
    let agg = authors.get(c.author)
    if (!agg) {
      agg = { added: 0, deleted: 0 }
      authors.set(c.author, agg)
    }
    for (const f of c.files) {
      if (!shouldIncludeFile(f.path, extensions)) continue
      project.added += f.added
      project.deleted += f.deleted
      agg.added += f.added
      agg.deleted += f.deleted
    }
  }
  return { project, authors }
}

/** 从 NumstatCommit[] 汇总单项目总增删行数（extensions 可选黑名单排除过滤）；薄包装 sumLineDeltas 的 project 维度 */
export function sumProjectLines(commits: NumstatCommit[], extensions?: string[]): LineDelta {
  return sumLineDeltas(commits, extensions).project
}

/** 从 NumstatCommit[] 汇总每人增删行数（Map<作者名, {added, deleted}>，extensions 可选黑名单排除过滤）；薄包装 sumLineDeltas 的 authors 维度 */
export function sumAuthorLines(commits: NumstatCommit[], extensions?: string[]): Map<string, LineDelta> {
  return sumLineDeltas(commits, extensions).authors
}
