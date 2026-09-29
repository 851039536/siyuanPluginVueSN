import type { NumstatCommit } from "../reportMetrics"
// 本地提交索引引擎单测：追加/读回/时间与条数过滤/崩溃半行/序号断层重建/元数据判据
import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"
// 刻意从 indexCache / indexIo 直接导入而非 "../types" 桶：桶会经 storage.ts 拉入运行时的
// siyuan 包（其 exports 字段在 Vitest 的 node 条件下不可解析），而这三个模块是零依赖纯逻辑。
import {
  DEFAULT_INDEX_META,
  INDEX_META_VERSION,
} from "../types/indexCache"
import {
  buildRootHash,
  CommitIndex,
  foldMessage,
  rootHashGitDir,
  rootHashOid,
} from "./CommitIndex"
import { INDEX_FILE } from "./indexIo"
import { MemoryIndexIO } from "./memoryIndexIo.testutil"

/** 构造一条 numstat 提交 */
function commit(hash: string, date: string, author: string, files: Array<[string, number, number]>, message = "feat: x"): NumstatCommit {
  return {
    hash,
    message,
    author,
    date,
    files: files.map(([path, added, deleted]) => ({
      path,
      added,
      deleted,
    })),
  }
}

/** 构造一份索引元数据补丁（模拟扫描完成后的项目元数据） */
function metaPatch(rootHash: string, extra?: Partial<{ complete: boolean, sinceCoveredDays: number, lastCommit: string }>) {
  return {
    rootHash,
    analyzedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    complete: extra?.complete ?? true,
    lastCommit: extra?.lastCommit ?? "",
    sinceCoveredDays: extra?.sinceCoveredDays ?? 0,
  }
}

describe("commitIndex 基础 IO", () => {
  let io: MemoryIndexIO
  let index: CommitIndex

  beforeEach(() => {
    io = new MemoryIndexIO()
    index = new CommitIndex(io, {
      version: INDEX_META_VERSION,
      projects: [],
    })
  })

  it("追加后按顺序读回，文件变更与提交对齐", async () => {
    await index.append("p1", [
      commit("a1", "2024-01-01T10:00:00+08:00", "alice", [["src/a.ts", 10, 2]]),
      commit("b2", "2024-01-02T10:00:00+08:00", "bob", [["src/b.ts", 5, 0], ["src/a.ts", 1, 1]]),
    ], metaPatch(buildRootHash("head1", "/repo/.git")))

    const log = index.getLog("p1")
    expect(log.map((c) => c.hash)).toEqual(["a1", "b2"])
    expect(log[0].files).toEqual([{
      path: "src/a.ts",
      added: 10,
      deleted: 2,
    }])
    expect(log[1].files).toHaveLength(2)
    expect(log[1].author).toBe("bob")
  })

  it("追加写：第二个实例从磁盘重建后仍能读回全部提交", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T10:00:00+08:00", "alice", [["a.ts", 1, 0]])], metaPatch("h:g"))
    await index.append("p1", [commit("b2", "2024-01-02T10:00:00+08:00", "alice", [["b.ts", 2, 0]])], metaPatch("h2:g"))

    // 模拟重启：新实例 + 同一份磁盘
    const reopened = new CommitIndex(io, index.getProjectMetas().length
      ? {
          version: INDEX_META_VERSION,
          projects: index.getProjectMetas(),
        }
      : DEFAULT_INDEX_META)
    await reopened.ensureLoaded("p1")
    expect(reopened.getLog("p1").map((c) => c.hash)).toEqual(["a1", "b2"])
    expect(reopened.getProjectMeta("p1")?.rootHash).toBe("h2:g")
  })

  it("maxCount 从最新往前取（与 git log -n 对齐）", async () => {
    const commits = [1, 2, 3, 4, 5].map((i) => commit(`h${i}`, `2024-01-0${i}T10:00:00+08:00`, "alice", [["a.ts", i, 0]]))
    await index.append("p1", commits, metaPatch("h:g"))
    expect(index.getLog("p1", { maxCount: 2 }).map((c) => c.hash)).toEqual(["h4", "h5"])
    expect(index.getLog("p1", { maxCount: 99 })).toHaveLength(5)
  })

  it("sinceMs 按提交时间过滤下界", async () => {
    await index.append("p1", [
      commit("old", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]]),
      commit("new", "2024-06-01T00:00:00Z", "alice", [["a.ts", 1, 0]]),
    ], metaPatch("h:g"))
    const since = Date.parse("2024-03-01T00:00:00Z")
    expect(index.getLog("p1", { sinceMs: since }).map((c) => c.hash)).toEqual(["new"])
  })

  it("sinceMs 与 maxCount 组合：先按时间过滤再取最近 N 条", async () => {
    // 5 条提交，其中 h1/h2 早于下界
    await index.append("p1", [1, 2, 3, 4, 5].map((i) => commit(`h${i}`, `2024-0${i}-01T00:00:00Z`, "alice", [["a.ts", i, 0]])), metaPatch("h:g"))
    const since = Date.parse("2024-03-01T00:00:00Z")
    // 时间过滤后剩 h3/h4/h5，取最近 2 条 → h4/h5（而非先取 h4/h5 再过滤，也非返回 h1/h2）
    expect(index.getLog("p1", {
      sinceMs: since,
      maxCount: 2,
    }).map((c) => c.hash)).toEqual(["h4", "h5"])
    // 仅时间过滤
    expect(index.getLog("p1", { sinceMs: since }).map((c) => c.hash)).toEqual(["h3", "h4", "h5"])
    // 仅条数限制
    expect(index.getLog("p1", { maxCount: 2 }).map((c) => c.hash)).toEqual(["h4", "h5"])
  })

  it("isHit 只在 rootHash 完全一致时为真（换仓库/换 HEAD 都失效）", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [])], metaPatch(buildRootHash("head1", "/repo/.git")))
    expect(index.isHit("p1", buildRootHash("head1", "/repo/.git"))).toBe(true)
    expect(index.isHit("p1", buildRootHash("head2", "/repo/.git"))).toBe(false)
    // 同一 oid 但不同仓库路径：不得误判命中
    expect(index.isHit("p1", buildRootHash("head1", "/other/.git"))).toBe(false)
  })
})

describe("rootHash 编解码", () => {
  it("含盘符冒号的 Windows 路径可安全往返", () => {
    const rh = buildRootHash("abc123", "E:\\repo\\.git")
    expect(rootHashOid(rh)).toBe("abc123")
    expect(rootHashGitDir(rh)).toBe("E:\\repo\\.git")
  })

  it("格式异常时返回空串而非崩溃", () => {
    expect(rootHashOid("nocolon")).toBe("")
    expect(rootHashGitDir("nocolon")).toBe("")
  })
})

describe("崩溃与损坏恢复", () => {
  let io: MemoryIndexIO
  let index: CommitIndex

  beforeEach(() => {
    io = new MemoryIndexIO()
    index = new CommitIndex(io, {
      version: INDEX_META_VERSION,
      projects: [],
    })
  })

  it("末尾半行 JSON 被丢弃，不影响已完整写入的提交", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g"))
    io.dropTail = true
    await index.append("p1", [commit("b2", "2024-01-02T00:00:00Z", "alice", [["b.ts", 1, 0]])], metaPatch("h2:g"))

    const reopened = new CommitIndex(io, {
      version: INDEX_META_VERSION,
      projects: [],
    })
    await reopened.ensureLoaded("p1")
    expect(reopened.getLog("p1").map((c) => c.hash)).toEqual(["a1"])
  })

  it("孤儿文件行（提交行被截断）被丢尾而非报错，索引保持可用且磁盘被裁齐", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g"))
    // 模拟"提交行只写了一半、文件行已完整落盘"：提交数 1，但文件行引用了序号 1
    io.files.set(INDEX_FILE.files, `{"c":0,"p":"a.ts","a":1,"d":0}\n{"c":1,"p":"ghost.ts","a":9,"d":9}\n`)

    const reopened = new CommitIndex(io, {
      version: INDEX_META_VERSION,
      projects: [],
    })
    await reopened.ensureLoaded("p1")
    expect(reopened.getLog("p1").map((c) => c.hash)).toEqual(["a1"])
    expect(reopened.getLog("p1")[0].files).toEqual([{
      path: "a.ts",
      added: 1,
      deleted: 0,
    }])
    // 磁盘尾部已裁掉孤儿行，后续追加的序号不会错位
    expect(io.raw(INDEX_FILE.files)).not.toContain("ghost.ts")
    await reopened.append("p1", [commit("b2", "2024-01-02T00:00:00Z", "alice", [["b.ts", 2, 0]])], metaPatch("h2:g"))
    expect(reopened.getLog("p1").map((c) => c.hash)).toEqual(["a1", "b2"])
    expect(reopened.getLog("p1")[1].files).toEqual([{
      path: "b.ts",
      added: 2,
      deleted: 0,
    }])
  })

  it("越界序号触发的裁齐会清空 lastCommit 判据（下次走完整校验）", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g", { lastCommit: "a1|alice|2024-01-01T00:00:00Z" }))
    const persistedMeta = {
      version: INDEX_META_VERSION,
      projects: index.getProjectMetas(),
    }
    io.files.set(INDEX_FILE.files, `{"c":5,"p":"ghost.ts","a":1,"d":0}\n`)

    // 与生产一致：从持久化的 meta 构造新实例
    const reopened = new CommitIndex(io, persistedMeta)
    await reopened.ensureLoaded("p1")
    expect(reopened.getProjectMeta("p1")?.lastCommit).toBe("")
  })

  it("invalidate 清空内存与磁盘，且清掉项目元数据", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [["a.ts", 1, 0]])], metaPatch("h:g"))
    await index.invalidate("p1")
    expect(index.getProjectMeta("p1")).toBeUndefined()
    expect(io.raw(INDEX_FILE.commits)).toBe("")
    expect(io.raw(INDEX_FILE.files)).toBe("")
  })

  it("clearAll 后索引为空且可用于重建", async () => {
    await index.append("p1", [commit("a1", "2024-01-01T00:00:00Z", "alice", [])], metaPatch("h:g"))
    await index.clearAll()
    expect(index.getProjectMetas()).toHaveLength(0)
    await index.append("p1", [commit("b2", "2024-01-02T00:00:00Z", "alice", [])], metaPatch("h2:g"))
    expect(index.getLog("p1").map((c) => c.hash)).toEqual(["b2"])
  })
})

describe("文件存量行数缓存", () => {
  it("按 rootHash 复用，不一致则视为未缓存", async () => {
    const io = new MemoryIndexIO()
    const index = new CommitIndex(io, {
      version: INDEX_META_VERSION,
      projects: [],
    })
    const lines = new Map<string, number | null>([["src/a.ts", 120], ["img.png", null]])
    await index.setFileLines("p1", "h:g", lines)
    expect(index.getFileLines("p1", "h:g")).toEqual(lines)
    expect(index.getFileLines("p1", "h2:g")).toBeNull()

    const reopened = new CommitIndex(io, {
      version: INDEX_META_VERSION,
      projects: [],
    })
    expect(await reopened.loadFileLines("p1", "h:g")).toEqual(lines)
    expect(await reopened.loadFileLines("p1", "h2:g")).toBeNull()
  })
})

describe("foldMessage 保证单行 NDJSON 前提", () => {
  it("多行提交信息折叠为单行空格", () => {
    expect(foldMessage("feat: a\n\nbody line")).toBe("feat: a body line")
    expect(foldMessage("chore: x\r\n  indented")).toBe("chore: x indented")
  })
})
