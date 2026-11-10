// src/features/gitPush/utils/fileTree.spec.ts — 变更文件目录树构建单元测试
//
// 覆盖重点：目录分组与拉平顺序（目录先、文件后、子目录按名排序）、
// 折叠子树剪枝、子树计数、顶层目录收集（「全部收起」）、关键词过滤。
import { describe, expect, it } from "vitest"
import type { FileChange } from "../types"
import {
  buildFileTreeRows,
  buildPathTreeRows,
  buildSectionedTreeRows,
  collectDirectoryPaths,
  filterFilesByQuery,
  filterPathsByQuery,
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

describe("collectDirectoryPaths", () => {
  it("收集各层父目录，不含文件名本身", () => {
    expect(collectDirectoryPaths(["src/a/b.ts", "src/c.ts", "README.md"]).sort()).toEqual([
      "src",
      "src/a",
    ])
  })

  it("空输入返回空数组", () => {
    expect(collectDirectoryPaths([])).toEqual([])
  })
})

describe("filterPathsByQuery", () => {
  it("大小写不敏感的子串匹配；空词返回全部", () => {
    const paths = ["src/App.vue", "docs/README.md"]
    expect(filterPathsByQuery(paths, "app")).toEqual(["src/App.vue"])
    expect(filterPathsByQuery(paths, "  ")).toEqual(paths)
  })
})

describe("buildPathTreeRows", () => {
  it("默认全部收起：只输出根层目录与根级文件", () => {
    const rows = buildPathTreeRows(["src/a/x.ts", "src/y.ts", "README.md"], new Set())
    expect(rows.map((r) => `${r.type}:${r.path}@${r.depth}`)).toEqual([
      "dir:src@0",
      "file:README.md@0",
    ])
  })

  it("展开目录后输出其子目录与直属文件，未展开的子目录仍不输出内容", () => {
    const rows = buildPathTreeRows(
      ["src/a/x.ts", "src/y.ts", "README.md"],
      new Set(["src"]),
    )
    expect(rows.map((r) => `${r.type}:${r.path}@${r.depth}`)).toEqual([
      "dir:src@0",
      "dir:src/a@1",
      "file:src/y.ts@1",
      "file:README.md@0",
    ])
  })

  it("目录计数 = 子树内文件总数；输出行不带变更元数据", () => {
    const rows = buildPathTreeRows(["src/a/x.ts", "src/a/y.ts", "src/z.ts"], new Set(["src"]))
    const src = rows.find((r) => r.path === "src")
    const a = rows.find((r) => r.path === "src/a")
    expect(src?.count).toBe(3)
    expect(a?.count).toBe(2)
    expect(rows.every((r) => r.type !== "file" || !("file" in r))).toBe(true)
  })

  it("depthOffset 整体平移缩进（与变更树同义）", () => {
    const rows = buildPathTreeRows(["src/a.ts"], new Set(["src"]), 1)
    expect(rows.map((r) => `${r.type}:${r.path}@${r.depth}`)).toEqual([
      "dir:src@1",
      "file:src/a.ts@2",
    ])
  })

  it("空输入返回空数组", () => {
    expect(buildPathTreeRows([], new Set())).toEqual([])
  })

  it("同名文件与目录共存时行键不冲突（已跟踪文件被目录替换的边界）", () => {
    // git 仍列已跟踪文件 foo，同时 --others 列出 foo/bar.ts，根层会同时出现目录 foo 与文件 foo
    const rows = buildPathTreeRows(["foo", "foo/bar.ts"], new Set())
    expect(rows.map((r) => `${r.type}:${r.path}`)).toEqual(["dir:foo", "file:foo"])
    const keys = rows.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("buildFileTreeRows compact（单子目录链压缩）", () => {
  it("只有单个子目录且自身无文件的链条合并成一行", () => {
    const rows = buildFileTreeRows([fc("src/features/gitPush/utils/x.ts")], new Set(), 0, "", true)
    const dirs = rows.filter((r) => r.type === "dir")
    expect(dirs).toHaveLength(1)
    expect(dirs[0]).toMatchObject({ name: "src/features/gitPush/utils", depth: 0, key: "src/features/gitPush/utils" })
    // 文件挂在合并后的那一行下面，只深一层
    expect(rows.find((r) => r.type === "file")).toMatchObject({ name: "x.ts", depth: 1 })
  })

  it("分支处停止合并（多个子目录不合并）", () => {
    const rows = buildFileTreeRows([fc("src/a/x.ts"), fc("src/b/z.ts")], new Set(), 0, "", true)
    expect(rows.filter((r) => r.type === "dir").map((r) => r.name)).toEqual(["src", "a", "b"])
  })

  it("目录自身有文件时停止合并", () => {
    const rows = buildFileTreeRows([fc("src/a/x.ts"), fc("src/a/y.ts")], new Set(), 0, "", true)
    expect(rows.filter((r) => r.type === "dir").map((r) => r.name)).toEqual(["src/a"])
  })

  it("折叠合并行时整条链一起收起（键为最深路径）", () => {
    const rows = buildFileTreeRows([fc("src/features/x.ts")], new Set(["src/features"]), 0, "", true)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: "dir", name: "src/features" })
  })

  it("compact 关闭时保持逐层输出（既有调用方行为不变）", () => {
    const rows = buildFileTreeRows([fc("src/features/x.ts")])
    expect(rows.filter((r) => r.type === "dir").map((r) => r.name)).toEqual(["src", "features"])
  })
})
