// src/features/gitPush/utils/diffLayout.spec.ts — diff 视图布局单元测试
//
// 覆盖重点：并排视图的 del/add 行配对（含数量不等与孤立块）、跨整行的 hunk/meta/gap、
// 「仅改动」过滤口径与改动行判定的一致性。
import type { DiffLine } from "./diffText"
import { describe, expect, it } from "vitest"
import { filterOnlyChanges, isChangeLine, toSplitRows } from "./diffLayout"

/** 构造一行测试数据（只填断言需要的字段） */
function line(type: DiffLine["type"], text?: string): DiffLine {
  return {
    type,
    text: text ?? type,
  }
}

describe("toSplitRows", () => {
  it("空输入返回空数组", () => {
    expect(toSplitRows([])).toEqual([])
  })

  it("hunk / meta / gap 跨整行，不拆列", () => {
    const rows = toSplitRows([line("meta"), line("hunk"), line("gap")])
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.full && !r.left && !r.right)).toBe(true)
  })

  it("ctx 行左右同源（两侧各占一列，行号分别是旧/新文件行号）", () => {
    const ctx: DiffLine = {
      type: "ctx",
      text: "keep",
      oldNo: 3,
      newNo: 9,
    }
    const [row] = toSplitRows([ctx])
    expect(row.left).toBe(ctx)
    expect(row.right).toBe(ctx)
  })

  it("等量的 del / add 块逐行配对", () => {
    const rows = toSplitRows([line("del", "a"), line("del", "b"), line("add", "x"), line("add", "y")])
    expect(rows).toHaveLength(2)
    expect(rows[0].left?.text).toBe("a")
    expect(rows[0].right?.text).toBe("x")
    expect(rows[1].left?.text).toBe("b")
    expect(rows[1].right?.text).toBe("y")
  })

  it("del 多于 add：多出来的行只在左列出现", () => {
    const rows = toSplitRows([line("del", "a"), line("del", "b"), line("del", "c"), line("add", "x")])
    expect(rows).toHaveLength(3)
    expect(rows[2].left?.text).toBe("c")
    expect(rows[2].right).toBeUndefined()
  })

  it("add 多于 del：多出来的行只在右列出现", () => {
    const rows = toSplitRows([line("del", "a"), line("add", "x"), line("add", "y")])
    expect(rows).toHaveLength(2)
    expect(rows[1].left).toBeUndefined()
    expect(rows[1].right?.text).toBe("y")
  })

  it("孤立 add（前面没有 del 块）只在右列出现", () => {
    const rows = toSplitRows([line("ctx"), line("add", "new")])
    expect(rows[0].left?.type).toBe("ctx")
    expect(rows[1].left).toBeUndefined()
    expect(rows[1].right?.text).toBe("new")
  })

  it("孤立 del 块（后面没有 add）全部落在左列", () => {
    const rows = toSplitRows([line("del", "gone"), line("ctx")])
    expect(rows[0].left?.text).toBe("gone")
    expect(rows[0].right).toBeUndefined()
    expect(rows[1].left?.type).toBe("ctx")
  })

  it("配对不跨越 ctx 行（两个独立改动块各自配对）", () => {
    const rows = toSplitRows([
      line("del", "a1"),
      line("add", "a2"),
      line("ctx"),
      line("del", "b1"),
      line("add", "b2"),
    ])
    expect(rows).toHaveLength(3)
    expect(rows[2].left?.text).toBe("b1")
    expect(rows[2].right?.text).toBe("b2")
  })
})

describe("filterOnlyChanges", () => {
  it("保留 add / del / hunk，隐去 ctx / meta / gap", () => {
    const lines = [line("meta"), line("hunk"), line("ctx"), line("del"), line("add"), line("gap")]
    expect(filterOnlyChanges(lines).map((l) => l.type)).toEqual(["hunk", "del", "add"])
  })

  it("无改动时返回空数组", () => {
    expect(filterOnlyChanges([line("meta"), line("ctx")])).toEqual([])
  })
})

describe("isChangeLine", () => {
  it("add / del 视为改动，其余类型与空值不算", () => {
    expect(isChangeLine(line("add"))).toBe(true)
    expect(isChangeLine(line("del"))).toBe(true)
    expect(isChangeLine(line("ctx"))).toBe(false)
    expect(isChangeLine(line("hunk"))).toBe(false)
    expect(isChangeLine(line("gap"))).toBe(false)
    expect(isChangeLine(undefined)).toBe(false)
  })
})
