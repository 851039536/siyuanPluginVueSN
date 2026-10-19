/**
 * S3 文件管理器纯工具函数测试
 *
 * 覆盖前缀/名称路径运算、名称校验、目录聚合（delimiter 降级用）、
 * 日志失败清单构造与排序比较器 —— 均为无 IO 的纯函数。
 */
import { describe, it, expect } from "vitest"
import type { S3FileInfo } from "@/utils/s3/types"
import {
  aggregateEntries,
  buildEntries,
  buildFailDetail,
  compareEntries,
  isValidEntryName,
  joinPrefix,
  nameFromKey,
  normalizeListing,
  parentPrefix,
  prefixFromSegments,
  relativeSegments,
  splitPrefixSegments,
} from "./utils"

/** 构造 S3FileInfo 的便捷工厂 */
function file(key: string, size = 0): S3FileInfo {
  return { name: nameFromKey(key), key, size, lastModified: "" }
}

describe("前缀/名称路径运算", () => {
  it("joinPrefix：文件夹结果以 / 结尾，文件不加", () => {
    expect(joinPrefix("a/", "b", true)).toBe("a/b/")
    expect(joinPrefix("a/", "b.txt", false)).toBe("a/b.txt")
  })

  it("parentPrefix：取父级前缀，根返回空串", () => {
    expect(parentPrefix("a/b/")).toBe("a/")
    expect(parentPrefix("a/b/c.txt")).toBe("a/b/")
    expect(parentPrefix("a/")).toBe("")
    expect(parentPrefix("")).toBe("")
  })

  it("nameFromKey：取末段名称，文件夹去掉尾斜杠", () => {
    expect(nameFromKey("a/b/")).toBe("b")
    expect(nameFromKey("a/c.txt")).toBe("c.txt")
    expect(nameFromKey("c.txt")).toBe("c.txt")
  })

  it("splitPrefixSegments：按 / 拆分并过滤空段", () => {
    expect(splitPrefixSegments("a/b/")).toEqual(["a", "b"])
    expect(splitPrefixSegments("")).toEqual([])
    expect(splitPrefixSegments("//a//")).toEqual(["a"])
  })

  it("prefixFromSegments：由段索引重组前缀", () => {
    expect(prefixFromSegments(["a", "b"], 0)).toBe("a/")
    expect(prefixFromSegments(["a", "b"], 1)).toBe("a/b/")
  })

  it("relativeSegments：prefix 以 root 开头时切片，否则整串分段", () => {
    expect(relativeSegments("root/a/b/", "root/")).toEqual(["a", "b"])
    expect(relativeSegments("other/x/", "root/")).toEqual(["other", "x"])
    expect(relativeSegments("root/", "root/")).toEqual([])
  })
})

describe("isValidEntryName", () => {
  it("非法名：空、纯空白、纯点名、含路径分隔符", () => {
    expect(isValidEntryName("")).toBe(false)
    expect(isValidEntryName("   ")).toBe(false)
    expect(isValidEntryName(".")).toBe(false)
    expect(isValidEntryName("..")).toBe(false)
    expect(isValidEntryName("a/b")).toBe(false)
    expect(isValidEntryName("a\\b")).toBe(false)
  })

  it("合法名：普通名称（含首尾空格会被 trim）", () => {
    expect(isValidEntryName("a.txt")).toBe(true)
    expect(isValidEntryName("  笔记.md  ")).toBe(true)
    expect(isValidEntryName("...")).toBe(true) // 非纯点名（三个点不在禁止列表）
  })
})

describe("aggregateEntries（delimiter 降级聚合）", () => {
  it("直接子文件收集，嵌套 key 折叠为文件夹前缀", () => {
    const result = aggregateEntries(
      [file("p/a.txt"), file("p/sub/x.txt"), file("p/sub/y.txt")],
      "p/",
    )
    expect(result.files.map((f) => f.key)).toEqual(["p/a.txt"])
    expect(result.folders).toEqual(["p/sub/"])
  })

  it("跳过当前目录自身占位对象与不属于本层的 key", () => {
    const result = aggregateEntries(
      [file("p/"), file("other/z.txt"), file("p/a.txt")],
      "p/",
    )
    expect(result.files.map((f) => f.key)).toEqual(["p/a.txt"])
    expect(result.folders).toEqual([])
  })

  it("双斜杠异常键（首段为空）不产生假文件夹", () => {
    const result = aggregateEntries([file("p//x.txt")], "p/")
    expect(result.folders).toEqual([])
    expect(result.files).toEqual([])
  })

  it("返回结构只含 files/folders（conflicts 死字段已移除）", () => {
    const result = aggregateEntries([file("p/a.txt")], "p/")
    expect(Object.keys(result).sort()).toEqual(["files", "folders"])
  })
})

describe("normalizeListing（统一聚合口径）", () => {
  it("files 为空时短路：不触发聚合扫描，folders 原样保留", () => {
    const listing = { files: [] as S3FileInfo[], folders: ["p/sub/"] }
    const result = normalizeListing(listing, "p/")
    expect(result).toEqual({ files: [], folders: ["p/sub/"] })
    // 短路分支零拷贝：files/folders 与入参同引用
    expect(result.files).toBe(listing.files)
    expect(result.folders).toBe(listing.folders)
  })

  it("delimiter 正常：直接子项透传，folders 为服务端与聚合结果并集去重", () => {
    const result = normalizeListing(
      { files: [file("p/a.txt")], folders: ["p/sub/"] },
      "p/",
    )
    expect(result.files.map((f) => f.key)).toEqual(["p/a.txt"])
    expect(result.folders).toEqual(["p/sub/"])
  })

  it("delimiter 被静默忽略：嵌套对象折回当前层文件夹", () => {
    const result = normalizeListing(
      { files: [file("p/sub/x.txt"), file("p/a.txt")], folders: [] },
      "p/",
    )
    expect(result.files.map((f) => f.key)).toEqual(["p/a.txt"])
    expect(result.folders).toEqual(["p/sub/"])
  })
})

describe("buildEntries", () => {
  it("文件夹条目 size=0、lastModified 为空串；文件条目字段透传", () => {
    const entries = buildEntries(
      [{ name: "a.txt", key: "p/a.txt", size: 42, lastModified: "2026-01-01", timestamp: 1000 }],
      ["p/sub/"],
    )
    expect(entries).toHaveLength(2)
    const folder = entries.find((e) => e.isFolder)!
    expect(folder).toMatchObject({ name: "sub", key: "p/sub/", size: 0, lastModified: "" })
    const f = entries.find((e) => !e.isFolder)!
    expect(f).toMatchObject({ name: "a.txt", key: "p/a.txt", size: 42, lastModified: "2026-01-01", timestamp: 1000 })
  })
})

describe("buildFailDetail（失败清单构造）", () => {
  it("空数组返回 undefined", () => {
    expect(buildFailDetail([])).toBeUndefined()
  })

  it("不超上限时全量返回且 omitted 为 0", () => {
    const detail = buildFailDetail(["a", "b"])
    expect(detail).toEqual({ failed: ["a", "b"], omitted: 0 })
  })
})

describe("compareEntries（排序比较器）", () => {
  const folder = { name: "dir", key: "p/dir/", isFolder: true, size: 0, lastModified: "" }
  const fileA = { name: "a.txt", key: "p/a.txt", isFolder: false, size: 2, lastModified: "", timestamp: 200 }
  const fileB = { name: "b.txt", key: "p/b.txt", isFolder: false, size: 1, lastModified: "", timestamp: 100 }

  it("文件夹恒置顶（与排序方向无关）", () => {
    expect(compareEntries(folder, fileA, "name", true)).toBeLessThan(0)
    expect(compareEntries(folder, fileA, "name", false)).toBeLessThan(0)
  })

  it("size 字段按数值比较；asc=false 翻转", () => {
    expect(compareEntries(fileA, fileB, "size", true)).toBeGreaterThan(0)
    expect(compareEntries(fileA, fileB, "size", false)).toBeLessThan(0)
  })

  it("time 字段：timestamp 缺省按 0", () => {
    const noTs = { ...fileA, timestamp: undefined }
    expect(compareEntries(noTs, fileB, "time", true)).toBeLessThan(0)
  })

  it("同值回退到名称 localeCompare（numeric）", () => {
    const a2 = { ...fileA, size: 1 }
    expect(compareEntries(a2, fileB, "size", true)).toBeLessThan(0)
  })
})
