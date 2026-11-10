// gitPush diff 视图布局（纯函数）：并排视图的行配对、仅改动过滤
// 与 diffText 的分工：那边负责「一行是什么」，这边负责「行怎么摆」。

import type { DiffLine } from "./diffText"
import { pairChangeBlock } from "./diffText"

/** diff 布局：unified 统一 / split 并排 / auto 按可用宽度自适应 */
export type DiffLayout = "unified" | "split" | "auto"

/** 并排视图的一行：full 为跨整行的行，left/right 为左右单元格（空位表示该侧此行无内容） */
export interface DiffSplitRow {
  left?: DiffLine
  right?: DiffLine
  /**
   * 跨整行的行（hunk / meta / gap）：不拆列。
   * 折叠条与分段头本就是整行语义，拆成两列反而读不出「这里跳过了 N 行」。
   */
  full?: DiffLine
}

/**
 * 把统一视图的行序列重排为并排行序列。
 *
 * 配对规则与 markInlineDiff 一致（连续 del 块与紧随的 add 块按下标一一对应），
 * 保证左右两侧的单元格正是词级高亮配对的那一对；未配对上的行各自独占一侧。
 */
export function toSplitRows(lines: DiffLine[]): DiffSplitRow[] {
  const rows: DiffSplitRow[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.type === "del") {
      const delStart = i
      while (i < lines.length && lines[i].type === "del") i++
      const addStart = i
      while (i < lines.length && lines[i].type === "add") i++
      const dels = lines.slice(delStart, addStart)
      const adds = lines.slice(addStart, i)
      if (!dels.length) {
        for (const add of adds) rows.push({ right: add })
        continue
      }
      if (!adds.length) {
        for (const del of dels) rows.push({ left: del })
        continue
      }
      // 与词级高亮共用同一套配对（文本锚点 + 位置补足），左右看到的对即是染色的对
      const pairs = pairChangeBlock(dels.map((d) => d.text), adds.map((a) => a.text))
      for (const pair of pairs) {
        rows.push({
          left: pair.del >= 0 ? dels[pair.del] : undefined,
          right: pair.add >= 0 ? adds[pair.add] : undefined,
        })
      }
      continue
    }
    if (line.type === "add") {
      // 没有前置 del 块的新增行：只在右列出现
      rows.push({ right: line })
      i++
      continue
    }
    if (line.type === "ctx") {
      // 未变行两侧同源：左右各占一列（与 GitHub / hunk 的并排语义一致）
      rows.push({
        left: line,
        right: line,
      })
      i++
      continue
    }
    rows.push({ full: line })
    i++
  }
  return rows
}

/**
 * 「仅改动」视图：只保留 add/del 行与 hunk 分段头。
 * 保留 hunk 头是为了留住「改动落在文件哪一段」的位置感；未变行与折叠条一并隐去。
 */
export function filterOnlyChanges(lines: DiffLine[]): DiffLine[] {
  return lines.filter((line) => line.type === "add" || line.type === "del" || line.type === "hunk")
}

/** 判断某行在并排视图下是否构成一次「改动」（供改动跳转定位，与 filterOnlyChanges 同口径） */
export function isChangeLine(line: DiffLine | undefined): boolean {
  return !!line && (line.type === "add" || line.type === "del")
}
