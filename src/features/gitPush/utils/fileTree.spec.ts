// src/features/gitPush/utils/fileTree.spec.ts — 变更文件目录树构建单元测试
//
// 覆盖重点：目录分组与拉平顺序（目录先、文件后、子目录按名排序）、
// 折叠子树剪枝、子树计数、顶层目录收集（「全部收起」）、关键词过滤。
import { describe, expect, it } from "vitest"
import type { FileChange } from "../types"
import {
  buildFileTreeRows,
  buildSectionedTreeRows,
  filterFilesByQuery,
  topLevelDirPaths,
} from "./fileTree"

/** 快捷构造变更条目（path 必填，其余默认未暂存修改） */
function fc(path: string, staged = false): FileChange {
  return { path, status: staged ? "added" : "modified", staged }
}

describe("buildFileTreeRows", () => {
  it("空输入返回空数组", () => {
    expect(buildFileTreeRows([], new Set())).toEqual([])
  })

  it("根级文件（无目录段）输出为 depth 0 的文件行", () => {
    const rows = buildFileTreeRows([fc("README.md")], new Set())
    expect(rows).toEqual([
      { type: "file", key: "README.md", name: "README.md", path: "README.md", depth: 0, count: 1, file: expect.any(Object) },
    ])
  })

  it("嵌套路径生成目录行 + 文件行，目录先于文件、按名排序；目录内文件保持传入序", () => {
    const rows = buildFileTreeRows(
      [fc("b/f.ts"), fc("a/z.ts"), fc("a/y.ts"), fc("root.md")],
      new Set(),
    )
    // 顶层：目录 a、目录 b（按名排序）在前，根文件在后；目录 a 内文件按传入序（z.ts → y.ts）
    expect(rows.map((r) => `${r.type}:${r.path}`)).toEqual([
      "dir:a",
      "file:a/z.ts",
      "file:a/y.ts",
      "dir:b",
      "file:b/f.ts",
      "file:root.md",
    ])
    // 深度语义：文件比其父目录深一层（目录 depth 0，文件 depth 1；根级文件 depth 0）
    expect(rows[0].depth).toBe(0)
    expect(rows[1].depth).toBe(1)
    expect(rows[rows.length - 1].depth).toBe(0)
  })

  it("目录行计数 = 子树内全部变更文件数（含嵌套）", () => {
    const rows = buildFileTreeRows(
      [fc("src/a/b/x.ts"), fc("src/a/y.ts"), fc("src/z.ts"), fc("other.md")],
      new Set(),
    )
    const srcRow = rows.find((r) => r.path === "src")
    const aRow = rows.find((r) => r.path === "src/a")
    const bRow = rows.find((r) => r.path === "src/a/b")
    expect(srcRow?.count).toBe(3)
    expect(aRow?.count).toBe(2)
    expect(bRow?.count).toBe(1)
  })

  it("折叠目录只隐藏子树，目录行自身保留", () => {
    const rows = buildFileTreeRows(
      [fc("src/a/x.ts"), fc("src/b/y.ts"), fc("root.md")],
      new Set(["src/a"]),
    )
    expect(rows.map((r) => `${r.type}:${r.path}`)).toEqual([
      "dir:src",
      "dir:src/a", // 自身行保留
      "dir:src/b",
      "file:src/b/y.ts",
      "file:root.md",
    ])
  })

  it("目录内文件序与传入序一致（调用方按暂存优先排序时保持同序）", () => {
    const rows = buildFileTreeRows(
      [fc("src/staged.ts", true), fc("src/unstaged.ts", false)],
      new Set(),
    )
    const fileRows = rows.filter((r) => r.type === "file")
    expect(fileRows.map((r) => r.name)).toEqual(["staged.ts", "unstaged.ts"])
  })

  it("renamed 等状态原样透传（树按新路径归位）", () => {
    const renamed: FileChange = { path: "new/dir/f.ts", status: "renamed", staged: true, oldPath: "old/f.ts" }
    const rows = buildFileTreeRows([renamed], new Set())
    const fileRow = rows.find((r) => r.type === "file")!
    expect(fileRow.path).toBe("new/dir/f.ts")
    expect(fileRow.file).toBe(renamed)
  })
})

describe("topLevelDirPaths", () => {
  it("收集顶层目录，根级文件不产生目录", () => {
    const top = topLevelDirPaths([fc("src/a/x.ts"), fc("src/b.ts"), fc("docs/d.md"), fc(".gitignore")])
    expect(top.sort()).toEqual(["docs", "src"])
  })

  it("空输入返回空数组", () => {
    expect(topLevelDirPaths([])).toEqual([])
  })
})

describe("filterFilesByQuery", () => {
  const files = [fc("src/a/Xy.ts"), fc("docs/readme.md"), fc("main.ts")]

  it("空/空白词原样返回全部", () => {
    expect(filterFilesByQuery(files, "")).toBe(files)
    expect(filterFilesByQuery(files, "  ")).toBe(files)
  })

  it("大小写不敏感的路径子串匹配", () => {
    expect(filterFilesByQuery(files, "XY").map((f) => f.path)).toEqual(["src/a/Xy.ts"])
    expect(filterFilesByQuery(files, "docs").map((f) => f.path)).toEqual(["docs/readme.md"])
  })

  it("无命中返回空数组（目录由构建器从文件派生，空文件即空树）", () => {
    expect(filterFilesByQuery(files, "不存在的路径")).toEqual([])
  })
})

describe("buildSectionedTreeRows", () => {
  it("两分区各成树：分区行 depth 0，其下目录/文件从 depth 1 起；键带分区前缀", () => {
    const stagedFile = fc("src/s.ts", true)
    const unstagedFile = fc("src/u.ts", false)
    const rows = buildSectionedTreeRows([
      { section: "staged", name: "已暂存", files: [stagedFile] },
      { section: "unstaged", name: "未暂存", files: [unstagedFile] },
    ], new Set())
    expect(rows.map((r) => `${r.type}:${r.key}@${r.depth}`)).toEqual([
      "section:section:staged@0",
      "dir:src@1",
      "file:staged:src/s.ts@2",
      "section:section:unstaged@0",
      "dir:src@1",
      "file:unstaged:src/u.ts@2",
    ])
  })

  it("空分区整段省略；分区折叠时只保留分区行", () => {
    const rows = buildSectionedTreeRows([
      { section: "staged", name: "已暂存", files: [] },
      { section: "unstaged", name: "未暂存", files: [fc("a.ts")] },
    ], new Set(["section:unstaged"]))
    expect(rows.map((r) => r.key)).toEqual(["section:unstaged"])
  })

  it("部分暂存文件两侧分区都出现（键不同、file 引用相同）", () => {
    const partial: FileChange = { path: "m.ts", status: "modified", staged: true, unstaged: true }
    const rows = buildSectionedTreeRows([
      { section: "staged", name: "已暂存", files: [partial] },
      { section: "unstaged", name: "未暂存", files: [partial] },
    ], new Set())
    const fileRows = rows.filter((r) => r.type === "file")
    expect(fileRows.map((r) => r.key)).toEqual(["staged:m.ts", "unstaged:m.ts"])
    expect(fileRows[0].file).toBe(partial)
    expect(fileRows[1].file).toBe(partial)
  })

  it("全部输入为空返回空数组", () => {
    expect(buildSectionedTreeRows([
      { section: "staged", name: "已暂存", files: [] },
      { section: "unstaged", name: "未暂存", files: [] },
    ], new Set())).toEqual([])
  })
})
