// gitPush hunk 级补丁重建（纯函数）：把「用户在 diff 里选中的行」还原成可 apply 的 patch。
//
// 关键口径（与 diff 审阅的直觉一致）：
//   - 未选中的 `+` 行：丢弃，不进入结果；
//   - 未选中的 `-` 行：降为上下文（保留在文件里）；
//   - hunk 头按选择重算行数，newStart 按前面已选改动的累计位移修正；
//   - `\ No newline at end of file` 跟随它所属的行，行被丢弃时标记也要丢弃。

import type { FilePatch, PatchHunk, PatchLine } from "./patchModel"
import { isSelectableLine } from "./patchModel"

/** 选中行的 id 集合；context / noNewline 的 id 会被忽略 */
export type LineSelection = ReadonlySet<number>

interface BuiltHunk {
  text: string
  oldCount: number
  newCount: number
}

/** 选中整个 hunk（所有 add / del），供「按 hunk 暂存」直接使用 */
export function selectHunkLines(file: FilePatch, hunkIndex: number): Set<number> {
  const hunk = file.hunks[hunkIndex]
  if (!hunk) return new Set()
  return new Set(hunk.lines.filter(isSelectableLine).map((line) => line.id))
}

/**
 * 生成只包含指定 hunk 的补丁；不传 selection 时表示整段 hunk 全选。
 * 结果自带 preamble（diff --git / --- / +++），可直接交给 `git apply`。
 */
export function buildHunkPatch(file: FilePatch, hunkIndex: number, selection?: LineSelection): string {
  const hunk = file.hunks[hunkIndex]
  if (!hunk) return ""
  const selected = selection ?? selectHunkLines(file, hunkIndex)
  return buildSelectedPatch(file, selected, new Set([hunk.index]))
}

/**
 * 按选中的行重建整份文件的补丁。
 *
 * `hunkIndexes` 用于限定只处理某几个 hunk（例如单 hunk 操作）；未包含的 hunk
 * 不参与 newStart 的位移累计，等价于「这些改动没有应用」。
 */
export function buildSelectedPatch(
  file: FilePatch,
  selected: LineSelection,
  hunkIndexes?: ReadonlySet<number>,
): string {
  if (!file.hunks.length) return ""
  const out: string[] = [...file.preamble]
  let delta = 0
  let emitted = 0

  for (const hunk of file.hunks) {
    if (hunkIndexes && !hunkIndexes.has(hunk.index)) continue
    const built = buildHunk(hunk, selected, delta)
    if (!built) continue
    out.push(built.text)
    // 后面的 hunk 的 newStart 要跟着「实际应用了多少增删」走
    delta += built.newCount - built.oldCount
    emitted++
  }

  return emitted ? out.join("") : ""
}

function buildHunk(hunk: PatchHunk, selected: LineSelection, deltaBefore: number): BuiltHunk | null {
  // 先算每一行是否会被输出：noNewline 标记要判断「前一行是否还在」以及
  // 「后面是否还有内容」，否则会把 EOF 标记错误地留在文件中间。
  const plan = hunk.lines.map((line) => {
    if (line.kind === "add") return { emit: selected.has(line.id), kind: "add" as const }
    if (line.kind === "del") {
      return selected.has(line.id)
        ? { emit: true, kind: "del" as const }
        : { emit: true, kind: "demotedDel" as const }
    }
    if (line.kind === "context") return { emit: true, kind: "context" as const }
    return { emit: false, kind: "noNewline" as const }
  })

  const out: string[] = []
  let oldCount = 0
  let newCount = 0
  let hasChange = false
  let emittedAfter = plan.reduce((n, item) => n + (item.emit ? 1 : 0), 0)

  for (let i = 0; i < hunk.lines.length; i++) {
    const line: PatchLine = hunk.lines[i]
    const item = plan[i]

    if (line.kind === "noNewline") {
      const prev = plan[i - 1]
      // 前一行没输出 → 标记属于被丢弃的 + 行，一并丢弃；
      // 前一行是由 `-` 降级的上下文且后面还有输出 → 该上下文不在 EOF，标记不成立。
      if (prev?.emit && !(prev.kind === "demotedDel" && emittedAfter > 0)) {
        out.push(line.raw)
      }
      continue
    }

    if (!item.emit) continue

    if (item.kind === "demotedDel") {
      // 降级为上下文：只换首列前缀，内容与行尾保持原样
      out.push(` ${line.text}${line.eol}`)
      oldCount++
      newCount++
    } else if (line.kind === "add") {
      out.push(line.raw)
      newCount++
      hasChange = true
    } else if (line.kind === "del") {
      out.push(line.raw)
      oldCount++
      hasChange = true
    } else {
      out.push(line.raw)
      oldCount++
      newCount++
    }
    emittedAfter--
  }

  // 整段没有任何被选中的增删：不输出该 hunk（否则会生成一个只含上下文的空补丁）
  if (!hasChange) return null

  const newStart = computeNewStart(hunk.oldStart, deltaBefore, oldCount, newCount)
  const eol = hunk.eol || "\n"
  const header = `@@ -${formatRange(hunk.oldStart, oldCount)} +${formatRange(newStart, newCount)} @@${hunk.section}${eol}`
  return { text: header + out.join(""), oldCount, newCount }
}

/**
 * 新文件侧的起始行。
 *
 * 普通 hunk 是 `oldStart + 累计位移`；纯插入的 oldStart 指向插入点前一行，
 * 纯删除的 newStart 指向删除点前一行，这两种 hunk 头的约定与普通 hunk 不同。
 */
function computeNewStart(oldStart: number, deltaBefore: number, oldCount: number, newCount: number): number {
  if (newCount === 0) return Math.max(0, oldStart + deltaBefore - 1)
  if (oldCount === 0) return oldStart + deltaBefore + 1
  return oldStart + deltaBefore
}

/** git 的惯例：长度为 1 时省略 `,1`，零长度必须写成 `,0` */
function formatRange(start: number, count: number): string {
  return count === 1 ? `${start}` : `${start},${count}`
}
