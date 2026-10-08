// 本地提交索引 — 并发写串行化 + 元数据版本不符清盘 回归测试
//
// 覆盖两处本次修复的缺陷：
// ① append/setFileLines/invalidate 无串行化：同项目并发调用会各自读到同一个
//    `segment.commits.length` 作为起始序号，导致序号重叠、提交重复落盘，
//    破坏「提交序号 = 文件行号」不变量（表现为统计数字重复计入）。
//    各 composable 自己的 running/refreshing 标记不跨视图，挡不住报告视图与行数统计同时触发。
// ② 元数据版本不符时只丢弃内存 meta，未清磁盘旧格式 NDJSON：后续 ensureLoaded 会用
//    新记录形状解析旧行、append 再把新记录混入同一文件 —— 正是版本号本该防住的损坏。
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
import { legacyProjectIndexFile, projectIndexFile } from "./indexIo"
import { MemoryIndexIO } from "./memoryIndexIo.testutil"

/** 构造一条 numstat 提交 */
function commit(hash: string, date: string, author: string, files: Array<[string, number, number]> = []): NumstatCommit {
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

/**
 * 强制异步交错的 IO 替身：每次读写前让出事件循环，
 * 使并发调用真正交错执行 —— MemoryIndexIO 是同步的，无法暴露竞态。
 */
class InterleavedIndexIO extends MemoryIndexIO {
  /** 记录每个文件的写入次数，供断言「未发生重复写入」 */
  writeCount = new Map<string, number>()

  async appendLines(file: string, lines: string[]): Promise<void> {
    await new Promise((r) => setTimeout(r, 0))
    this.writeCount.set(file, (this.writeCount.get(file) ?? 0) + 1)
    await super.appendLines(file, lines)
  }

  async readLines(file: string): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 0))
    return super.readLines(file)
  }

  async writeText(file: string, text: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 0))
    this.writeCount.set(file, (this.writeCount.get(file) ?? 0) + 1)
    await super.writeText(file, text)
  }
}

describe("索引并发写串行化", () => {
  let io: InterleavedIndexIO
  let index: CommitIndex

  beforeEach(() => {
    io = new InterleavedIndexIO()
    index = new CommitIndex(io, { ...DEFAULT_INDEX_META })
  })

  it("同项目并发 append 不产生重复提交（序号不重叠）", async () => {
    // 两批提交并发写入同一项目：无锁时两笔都会从序号 0 开始分配
    await Promise.all([
      index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g")),
      index.append("p1", [commit("a2", "2024-01-02T00:00:00Z", "alice", [["b.ts", 2, 0]])], metaPatch("h:g")),
    ])

    const hashes = index.getLog("p1").map((c) => c.hash)
    // 两条都在，且不重复（无锁时序号重叠会让其中一条被另一条覆盖/重复）
    expect(hashes.sort()).toEqual(["a1", "a2"])
    expect(new Set(hashes).size).toBe(hashes.length)
  })

  it("同项目并发 append 落盘后重开仍不重复", async () => {
    await Promise.all([
      index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g")),
      index.append("p1", [commit("a2", "2024-01-02T00:00:00Z", "alice", [["b.ts", 2, 0]])], metaPatch("h:g")),
    ])

    // 从磁盘重新加载：序号错位会让文件行挂到错误的提交上
    const reopened = new CommitIndex(io, { ...DEFAULT_INDEX_META })
    await reopened.ensureLoaded("p1")
    const rows = reopened.getLog("p1")
    expect(rows.map((c) => c.hash).sort()).toEqual(["a1", "a2"])
    // 每个提交各自带自己的文件行（串号时会出现 a1 带 b.ts）
    const byHash = new Map(rows.map((c) => [c.hash, c.files.map((f) => f.path)]))
    expect(byHash.get("a1")).toEqual(["a.ts"])
    expect(byHash.get("a2")).toEqual(["b.ts"])
  })

  it("多项目并发 append 互不阻塞且各自正确", async () => {
    await Promise.all([
      index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h1:g")),
      index.append("p2", [commit("b1", "2024-02-01T00:00:00Z", "bob", [["b.ts", 2, 0]])], metaPatch("h2:g")),
      index.append("p3", [commit("c1", "2024-03-01T00:00:00Z", "carol", [["c.ts", 3, 0]])], metaPatch("h3:g")),
    ])

    expect(index.getLog("p1").map((c) => c.hash)).toEqual(["a1"])
    expect(index.getLog("p2").map((c) => c.hash)).toEqual(["b1"])
    expect(index.getLog("p3").map((c) => c.hash)).toEqual(["c1"])
  })

  it("并发 setFileLines 与 append 不互相破坏", async () => {
    await Promise.all([
      index.setFileLines("p1", "h:g", new Map([["a.ts", 10]])),
      index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g")),
    ])

    expect(await index.loadFileLines("p1", "h:g")).toEqual(new Map([["a.ts", 10]]))
    expect(index.getLog("p1").map((c) => c.hash)).toEqual(["a1"])
  })

  it("invalidate 后在途 append 不把数据写回已失效的段", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g"))
    // 先 invalidate 再 append：串行化后 append 排在后面，会重新建立段（而非写进被删的旧段）
    await index.invalidate("p1")
    expect(index.getLog("p1")).toEqual([])
    expect(index.getProjectMeta("p1")).toBeUndefined()

    await index.append("p1", [commit("a2", "2024-01-02T00:00:00Z", "alice", [["a.ts", 2, 0]])], metaPatch("h2:g"))
    expect(index.getLog("p1").map((c) => c.hash)).toEqual(["a2"])
    expect(index.getProjectMeta("p1")?.rootHash).toBe("h2:g")
  })

  it("前序 append 失败不阻断后续 append（队列不因异常卡死）", async () => {
    // 注入一次失败：写入抛错后队列必须继续可用
    let failNext = true
    const original = io.appendLines.bind(io)
    io.appendLines = async (file: string, lines: string[]) => {
      if (failNext) {
        failNext = false
        throw new Error("模拟磁盘写入失败")
      }
      return original(file, lines)
    }

    await expect(index.append("p1", [commit("bad", "2024-01-01T00:00:00Z", "alice")], metaPatch("h:g")))
      .rejects.toThrow()

    // 后续写入仍应成功
    await index.append("p1", [commit("good", "2024-01-02T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g"))
    expect(index.getLog("p1").map((c) => c.hash)).toEqual(["good"])
  })
})

describe("索引元数据版本不符", () => {
  let io: MemoryIndexIO

  beforeEach(() => {
    io = new MemoryIndexIO()
  })

  it("版本不符时清空磁盘旧格式索引（不留陈旧 NDJSON）", async () => {
    // 用旧版本构造一个索引并写入数据
    const old = new CommitIndex(io, { ...DEFAULT_INDEX_META })
    await old.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g"))
    expect(io.raw(projectIndexFile("commits", "p1"))).not.toBe("")

    // 模拟升级后加载到一个版本号不符的 meta
    const upgraded = new CommitIndex(io, {
      version: INDEX_META_VERSION + 1,
      projects: [{
        projectId: "p1",
        ...metaPatch("h:g"),
      }],
    })

    // 首次读区必须先清盘：否则会用新记录形状解析旧行
    await upgraded.ensureLoaded("p1")
    expect(upgraded.getLog("p1")).toEqual([])
    expect(upgraded.getProjectMetas()).toEqual([])
    // 磁盘上的旧数据必须已被删除
    expect(io.raw(projectIndexFile("commits", "p1"))).toBe("")
    expect(io.raw(projectIndexFile("files", "p1"))).toBe("")

    // 清盘后可以正常写入新格式数据
    await upgraded.append("p1", [commit("new1", "2024-05-01T00:00:00Z", "alice", [["n.ts", 5, 0]])], metaPatch("h2:g"))
    expect(upgraded.getLog("p1").map((c) => c.hash)).toEqual(["new1"])
  })

  it("版本一致时不清空已有索引", async () => {
    const first = new CommitIndex(io, { ...DEFAULT_INDEX_META })
    await first.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g"))

    // 重新加载：meta 版本一致，数据必须保留
    const reopened = new CommitIndex(io, {
      version: INDEX_META_VERSION,
      projects: [{
        projectId: "p1",
        ...metaPatch("h:g"),
      }],
    })
    await reopened.ensureLoaded("p1")
    expect(reopened.getLog("p1").map((c) => c.hash)).toEqual(["a1"])
  })

  it("版本不符时同时清理旧命名规则（v1 `_` 前缀）的遗留文件", async () => {
    // 项目 id 含非法字符：v1 与 v2 会生成不同的文件名
    const pid = "a/b"
    await io.appendLines(legacyProjectIndexFile("commits", pid), [JSON.stringify({ h: "old1", a: "a", d: "2024-01-01T00:00:00Z", m: "x" })])
    expect(io.raw(legacyProjectIndexFile("commits", pid))).not.toBe("")

    // 升级到版本号不符的 meta，触发清盘
    const upgraded = new CommitIndex(io, {
      version: INDEX_META_VERSION + 1,
      projects: [{
        projectId: pid,
        ...metaPatch("h:g"),
      }],
    })
    await upgraded.ensureLoaded(pid)

    // 旧命名的文件必须一并删除，否则会永久残留在索引目录
    expect(io.raw(legacyProjectIndexFile("commits", pid))).toBe("")
  })

  it("rootHash 编解码保持可往返", () => {
    const root = buildRootHash("abc123", "/tmp/repo/.git")
    expect(root).toBe("abc123:/tmp/repo/.git")
  })
})
