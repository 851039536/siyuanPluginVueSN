// src/features/gitPush/utils/reportSort.spec.ts — 报告表格排序比较器单元测试
//
// 覆盖重点：降序语义、loc=null 排最后、lastModified 按时间戳而非字典序（时区偏移回归）。
import { describe, expect, it } from "vitest"
import { compareByDesc } from "./reportSort"

interface Row {
  modCount: number
  authorCount: number
  lastModified: string
  loc?: number | null
  heat?: number
  riskScore?: number
}

function row(over: Partial<Row>): Row {
  return { modCount: 0, authorCount: 0, lastModified: "", ...over }
}

describe("compareByDesc", () => {
  it("按指定列降序（heat/riskScore/modCount/authorCount）", () => {
    const rows = [row({ heat: 5 }), row({ heat: 9 }), row({ heat: 1 })]
    rows.sort(compareByDesc<Row>("heat"))
    expect(rows.map((r) => r.heat)).toEqual([9, 5, 1])
  })

  it("loc=null 视为最小值排最后（懒加载文件不应排在已读行数前）", () => {
    const rows = [row({ loc: null }), row({ loc: 100 }), row({ loc: 5 })]
    rows.sort(compareByDesc<Row>("loc"))
    expect(rows.map((r) => r.loc)).toEqual([100, 5, null])
  })

  it("lastModified 按时间戳比较（字典序会被时区偏移符号误导）", () => {
    // 字典序上 +01:00 的 "23:00" > Z 的 "22:30"，但真实时刻 22:30Z 更晚
    const rows = [
      row({ lastModified: "2024-01-15T23:00:00+01:00" }),
      row({ lastModified: "2024-01-15T22:30:00Z" }),
    ]
    rows.sort(compareByDesc<Row>("lastModified"))
    expect(rows[0].lastModified).toBe("2024-01-15T22:30:00Z")
  })

  it("空 lastModified 排最后", () => {
    const rows = [row({ lastModified: "" }), row({ lastModified: "2024-01-01T00:00:00Z" })]
    rows.sort(compareByDesc<Row>("lastModified"))
    expect(rows[0].lastModified).toBe("2024-01-01T00:00:00Z")
  })

  it("相等时返回 0（稳定排序保持原相对顺序）", () => {
    const c = compareByDesc<Row>("modCount")
    expect(c(row({ modCount: 3 }), row({ modCount: 3 }))).toBe(0)
  })
})
