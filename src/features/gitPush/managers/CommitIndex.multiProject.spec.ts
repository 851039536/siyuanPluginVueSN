// 本地提交索引 — 多项目隔离回归测试
//
// 背景（本次修复的 bug）：commits/files/filelines 三份 NDJSON 原先各只有「一个」文件名
// （commits.ndjson 等），也就是全项目共用一个文件；而 meta.json 却按项目数组存多条，
// 且 INDEX_MAX_PROJECT_SEGMENTS 还设计了「淘汰最旧项目」。两者语义直接冲突：
// 第二个项目一写入就覆盖掉第一个项目的数据。
//
// 症状：几十个项目的行数排行里，「新增/删除/净增/总行数」大量完全相同 ——
// 因为后写的项目把先写项目的段覆盖后，读回时按单段解析，各项目的文件行数互相串号。
//
// 本测试用例在修复前必须失败（证明 bug 真实存在），修复后通过（证明隔离生效）。
import type { NumstatCommit } from "../reportMetrics"
import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"
import {
  DEFAULT_INDEX_META,

  INDEX_META_VERSION,
} from "../types/indexCache"
import {
  buildRootHash,
  CommitIndex,
} from "./CommitIndex"
import { projectIndexFile } from "./indexIo"
import { MemoryIndexIO } from "./memoryIndexIo.testutil"

/** 构造一条 numstat 提交 */
function commit(hash: string, date: string, author: string, files: Array<[string, number, number]>): NumstatCommit {
  return {
    hash,
    message: `feat: ${hash}`,
    author,
    date,
    files: files.map(([path, added, deleted]) => ({
      path,
      added,
      deleted,
    })),
  }
}

/** 构造索引元数据补丁 */
function metaPatch(rootHash: string) {
  return {
    rootHash,
    analyzedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    complete: true,
    lastCommit: "",
    sinceCoveredDays: 0,
  }
}

/** 构造文件存量行数 Map */
function linesOf(entries: Array<[string, number | null]>): Map<string, number | null> {
  return new Map(entries)
}

/**
 * 强制异步交错的 IO 替身：每次写入前让出事件循环（await 一个宏任务），
 * 使并发调用真正交错执行 —— MemoryIndexIO 是同步的，无法暴露共享文件竞态。
 * 用于证明「按项目分文件」后并发写不再互相覆盖。
 */
class DeferredIndexIO extends MemoryIndexIO {
  async writeText(file: string, text: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 0))
    await super.writeText(file, text)
  }

  async appendLines(file: string, lines: string[]): Promise<void> {
    await new Promise((r) => setTimeout(r, 0))
    await super.appendLines(file, lines)
  }

  async readLines(file: string): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 0))
    return super.readLines(file)
  }
}

/** 索引文件的按项目命名（直接复用生产实现，避免测试里复制一份 slug 逻辑而漂移） */
function projectFile(kind: "commits" | "files" | "fileLines", projectId: string): string {
  return projectIndexFile(kind, projectId)
}

describe("索引多项目隔离", () => {
  let io: MemoryIndexIO
  let index: CommitIndex

  beforeEach(() => {
    io = new MemoryIndexIO()
    index = new CommitIndex(io, { ...DEFAULT_INDEX_META })
  })

  it("两个项目的提交段不互相覆盖（各自独立读回）", async () => {
    await index.append("p1", [
      commit("a1", "2024-01-01T00:00:00Z", "alice", [["src/a.ts", 10, 2]]),
      commit("a2", "2024-01-02T00:00:00Z", "alice", [["src/a.ts", 5, 1]]),
    ], metaPatch("h1:g"))
    await index.append("p2", [
      commit("b1", "2024-02-01T00:00:00Z", "bob", [["lib/b.ts", 100, 50]]),
    ], metaPatch("h2:g"))

    // 两个项目都必须能读回自己的提交（修复前 p1 会被 p2 覆盖）
    expect(index.getLog("p1").map((c) => c.hash)).toEqual(["a1", "a2"])
    expect(index.getLog("p2").map((c) => c.hash)).toEqual(["b1"])

    // 文件变更也不能串号
    expect(index.getLog("p1")[0].files).toEqual([{
      path: "src/a.ts",
      added: 10,
      deleted: 2,
    }])
    expect(index.getLog("p2")[0].files).toEqual([{
      path: "lib/b.ts",
      added: 100,
      deleted: 50,
    }])
  })

  it("两个项目的文件存量行数不互相覆盖", async () => {
    const l1 = linesOf([["src/a.ts", 120], ["src/a2.ts", 30]])
    const l2 = linesOf([["lib/b.ts", 9999]])
    await index.setFileLines("p1", "h1:g", l1)
    await index.setFileLines("p2", "h2:g", l2)

    expect(index.getFileLines("p1", "h1:g")).toEqual(l1)
    expect(index.getFileLines("p2", "h2:g")).toEqual(l2)
  })

  it("重开索引（模拟重启插件）后两个项目仍各自读回自己的数据", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["src/a.ts", 10, 2]])], metaPatch("h1:g"))
    await index.append("p2", [commit("b1", "2024-02-01T00:00:00Z", "bob", [["lib/b.ts", 100, 50]])], metaPatch("h2:g"))
    await index.setFileLines("p1", "h1:g", linesOf([["src/a.ts", 120]]))
    await index.setFileLines("p2", "h2:g", linesOf([["lib/b.ts", 9999]]))

    // 新建实例从磁盘读回（内存缓存全空）
    const reopened = new CommitIndex(io, { ...DEFAULT_INDEX_META })
    expect(reopened.getLog("p1").map((c) => c.hash)).toEqual([])
    await reopened.ensureLoaded("p1")
    await reopened.ensureLoaded("p2")
    expect(reopened.getLog("p1").map((c) => c.hash)).toEqual(["a1"])
    expect(reopened.getLog("p2").map((c) => c.hash)).toEqual(["b1"])
    expect(await reopened.loadFileLines("p1", "h1:g")).toEqual(linesOf([["src/a.ts", 120]]))
    expect(await reopened.loadFileLines("p2", "h2:g")).toEqual(linesOf([["lib/b.ts", 9999]]))
  })

  it("并发写入多个项目（模拟全量分析 Promise.allSettled）不丢数据", async () => {
    const ids = ["p1", "p2", "p3", "p4", "p5"]
    // 并发追加：不加锁时后写者覆盖先写者，修复前只有最后一个项目能读回
    await Promise.all(ids.map((id, i) => index.append(
      id,
      [commit(`${id}h`, "2024-01-01T00:00:00Z", `author${i}`, [[`src/${id}.ts`, i + 1, i]])],
      metaPatch(`${id}:g`),
    )))
    // 并发写入文件存量行数
    await Promise.all(ids.map((id, i) => index.setFileLines(id, `${id}:g`, linesOf([[`src/${id}.ts`, (i + 1) * 111]]))))

    for (const [i, id] of ids.entries()) {
      expect(index.getLog(id).map((c) => c.hash), `项目 ${id} 的提交段丢失`).toEqual([`${id}h`])
      expect(index.getLog(id)[0].files[0].added, `项目 ${id} 的文件变更串号`).toBe(i + 1)
      expect(index.getFileLines(id, `${id}:g`), `项目 ${id} 的存量行数丢失`).toEqual(linesOf([[`src/${id}.ts`, (i + 1) * 111]]))
    }
  })

  it("异步交错并发写入多个项目仍不丢数据（贴近生产 fs.promises 的竞态）", async () => {
    // 生产 FsIndexIO 走 fs.promises（真实异步交错），MemoryIndexIO 同步写入掩盖了竞态，
    // 故此处用 DeferredIndexIO 强制每次读写让出事件循环，确保覆盖共享文件型的竞态会暴露。
    const tokio = new DeferredIndexIO()
    const idx = new CommitIndex(tokio, { ...DEFAULT_INDEX_META })
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`)

    // 并发 append + setFileLines，全部交错执行
    await Promise.all(ids.map(async (id, i) => {
      await idx.append(id, [commit(`${id}h`, "2024-01-01T00:00:00Z", `a${i}`, [[`src/${id}.ts`, i + 1, i]])], metaPatch(`${id}:g`))
      await idx.setFileLines(id, `${id}:g`, linesOf([[`src/${id}.ts`, (i + 1) * 999]]))
    }))

    for (const [i, id] of ids.entries()) {
      expect(idx.getLog(id).map((c) => c.hash), `项目 ${id} 的提交段被并发覆盖`).toEqual([`${id}h`])
      expect(idx.getFileLines(id, `${id}:g`), `项目 ${id} 的存量行数被并发覆盖`).toEqual(linesOf([[`src/${id}.ts`, (i + 1) * 999]]))
    }

    // 重启后从磁盘读回：并发写下的数据必须完整落盘
    const reopened = new CommitIndex(tokio, { ...DEFAULT_INDEX_META })
    for (const [i, id] of ids.entries()) {
      await reopened.ensureLoaded(id)
      expect(reopened.getLog(id).map((c) => c.hash), `项目 ${id} 重启后段丢失`).toEqual([`${id}h`])
      expect(await reopened.loadFileLines(id, `${id}:g`), `项目 ${id} 重启后存量行数丢失`).toEqual(linesOf([[`src/${id}.ts`, (i + 1) * 999]]))
    }
  })

  it("invalidate 单个项目只清该项目，不影响其他项目", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["src/a.ts", 10, 2]])], metaPatch("h1:g"))
    await index.append("p2", [commit("b1", "2024-02-01T00:00:00Z", "bob", [["lib/b.ts", 100, 50]])], metaPatch("h2:g"))
    await index.setFileLines("p2", "h2:g", linesOf([["lib/b.ts", 9999]]))

    await index.invalidate("p1")

    // p1 已清空，p2 必须完好（修复前 invalidate 会把所有项目的段文件整体删掉）
    await index.ensureLoaded("p1")
    expect(index.getLog("p1")).toEqual([])
    await index.ensureLoaded("p2")
    expect(index.getLog("p2").map((c) => c.hash)).toEqual(["b1"])
    expect(await index.loadFileLines("p2", "h2:g")).toEqual(linesOf([["lib/b.ts", 9999]]))
    // meta 中 p1 被移除，p2 保留
    expect(index.getProjectMetas().map((p) => p.projectId)).toEqual(["p2"])
  })

  it("clearAll 清空全部项目的段与磁盘文件", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["src/a.ts", 10, 2]])], metaPatch("h1:g"))
    await index.append("p2", [commit("b1", "2024-02-01T00:00:00Z", "bob", [["lib/b.ts", 100, 50]])], metaPatch("h2:g"))
    await index.setFileLines("p1", "h1:g", linesOf([["src/a.ts", 120]]))

    await index.clearAll()

    expect(index.getProjectMetas()).toHaveLength(0)
    expect(io.raw(projectFile("commits", "p1"))).toBe("")
    expect(io.raw(projectFile("commits", "p2"))).toBe("")
    expect(io.raw(projectFile("fileLines", "p1"))).toBe("")
    await index.ensureLoaded("p1")
    expect(index.getLog("p1")).toEqual([])
  })

  it("项目 id 含路径分隔等特殊字符时文件名安全（不越出索引目录）", async () => {
    // 思源项目 id 由用户可见字符串派生，可能含 / \ : 等字符，直接拼文件名会越目录或非法
    const weird = "a/b\\c:d*e?f"
    await index.append(weird, [commit("w1", "2024-01-01T00:00:00Z", "alice", [["src/a.ts", 1, 0]])], metaPatch("hw:g"))
    await index.setFileLines(weird, "hw:g", linesOf([["src/a.ts", 7]]))
    expect(index.getLog(weird).map((c) => c.hash)).toEqual(["w1"])
    expect(index.getFileLines(weird, "hw:g")).toEqual(linesOf([["src/a.ts", 7]]))
    // 落盘文件名不得含路径分隔符或非法字符（否则 fs 写入会失败或越出索引目录）
    for (const kind of ["commits", "files", "fileLines"] as const) {
      const name = projectFile(kind, weird)
      expect(name).not.toMatch(/[/\\:*?"<>|]/)
      expect(io.files.has(name)).toBe(true)
    }
  })

  it("不同项目 id 不会因 slug 转义而碰撞到同一文件", async () => {
    // "a/b" 与 "a_b" 若用简单 replace 会撞成同一文件名并互相覆盖，逐字符转义必须避免
    await index.append("a/b", [commit("x1", "2024-01-01T00:00:00Z", "alice", [["src/x.ts", 1, 0]])], metaPatch("hx:g"))
    await index.append("a_b", [commit("y1", "2024-01-01T00:00:00Z", "bob", [["src/y.ts", 2, 0]])], metaPatch("hy:g"))
    expect(projectFile("commits", "a/b")).not.toBe(projectFile("commits", "a_b"))
    expect(index.getLog("a/b").map((c) => c.hash)).toEqual(["x1"])
    expect(index.getLog("a_b").map((c) => c.hash)).toEqual(["y1"])
  })

  it("同一项目的段与存量行数写入互不干扰（不同文件）", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["src/a.ts", 10, 2]])], metaPatch("h1:g"))
    await index.setFileLines("p1", "h1:g", linesOf([["src/a.ts", 120]]))
    // 写存量行数不得破坏提交段（修复前两者若共用文件会被互相覆盖）
    await index.ensureLoaded("p1")
    expect(index.getLog("p1").map((c) => c.hash)).toEqual(["a1"])
    expect(index.getCommitCount("p1")).toBe(1)
  })

  it("rootHash 不变时复用缓存，变化时视为未缓存（语义保持）", async () => {
    const l1 = linesOf([["src/a.ts", 120]])
    await index.setFileLines("p1", buildRootHash("head1", "/repo"), l1)
    expect(index.getFileLines("p1", buildRootHash("head1", "/repo"))).toEqual(l1)
    expect(index.getFileLines("p1", buildRootHash("head2", "/repo"))).toBeNull()
  })

  it("索引版本不符时丢弃旧元数据（语义保持）", () => {
    const stale = new CommitIndex(io, {
      version: INDEX_META_VERSION + 99,
      projects: [],
    })
    expect(stale.getProjectMetas()).toEqual([])
  })
})
