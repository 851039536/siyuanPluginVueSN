// 写操作日志单测：追加 / 读取顺序 / 损坏行容忍 / 轮转 / 失败吞掉 / 操作前状态解析
import { describe, expect, it, vi } from "vitest"
import { projectIndexFile } from "./indexIo"
import { MemoryIndexIO } from "./memoryIndexIo.testutil"
import {
  JOURNAL_MAX_ENTRIES,
  WriteJournal,
  journalLabel,
  parsePreWriteState,
} from "./WriteJournal"
import type { WriteJournalEntry } from "./WriteJournal"

const KEY = "p1"
const FILE = projectIndexFile("journal", KEY)

function fixedClock(iso: string): () => number {
  return () => new Date(iso).getTime()
}

function entry(overrides: Partial<Omit<WriteJournalEntry, "at">> = {}): Omit<WriteJournalEntry, "at"> {
  return {
    op: "commit",
    headBefore: "abc123",
    branchBefore: "main",
    reflogBefore: "HEAD@{0}: commit: 上一条",
    label: "本次提交",
    ...overrides,
  }
}

describe("WriteJournal", () => {
  it("追加后可读回，最新在前，at 由时间源注入", async () => {
    const io = new MemoryIndexIO()
    const journal = new WriteJournal(io, fixedClock("2026-11-24T10:00:00.000Z"))
    await journal.record(KEY, entry({ label: "第一条" }))
    await journal.record(KEY, entry({ label: "第二条" }))

    const list = await journal.list(KEY)
    expect(list.map((e) => e.label)).toEqual(["第二条", "第一条"])
    expect(list[0].at).toBe("2026-11-24T10:00:00.000Z")
    // 落盘是一行一条 JSON，便于追加与崩溃后丢尾行自愈
    expect(io.raw(FILE).trim().split("\n")).toHaveLength(2)
  })

  it("损坏行（崩溃半行 / 非法 JSON）被跳过，其余记录照常返回", async () => {
    const io = new MemoryIndexIO()
    await io.writeText(FILE, [
      JSON.stringify({ ...entry({ label: "好行" }), at: "2026-11-24T00:00:00.000Z" }),
      "{\"op\":\"commit\",\"at\":\"2026-11-24T00:00:01.000Z\",\"headBef",
      JSON.stringify({ foo: "缺少必填字段" }),
    ].join("\n") + "\n")

    const list = await new WriteJournal(io).list(KEY)
    expect(list).toHaveLength(1)
    expect(list[0].label).toBe("好行")
  })

  it("超过上限后裁到保留条数，之后继续追加仍可读", async () => {
    const io = new MemoryIndexIO()
    const journal = new WriteJournal(io)
    for (let i = 0; i < JOURNAL_MAX_ENTRIES + 1; i++) {
      await journal.record(KEY, entry({ label: `#${i}` }))
    }
    // 201 条触发一次轮转：保留最近 100 条
    expect(io.raw(FILE).trim().split("\n")).toHaveLength(100)

    await journal.record(KEY, entry({ label: "最新" }))
    const list = await journal.list(KEY)
    expect(list[0].label).toBe("最新")
    expect(list).toHaveLength(101)
  })

  it("写入失败只告警，不向调用方抛出", async () => {
    class AppendFailingIO extends MemoryIndexIO {
      override async appendLine(): Promise<void> { throw new Error("磁盘被占用") }
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await expect(new WriteJournal(new AppendFailingIO()).record(KEY, entry())).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it("readLines 失败时 list 返回空数组（不抛错）", async () => {
    class ReadFailingIO extends MemoryIndexIO {
      override async readLines(): Promise<string[]> { throw new Error("读取失败") }
    }
    await expect(new WriteJournal(new ReadFailingIO()).list(KEY)).resolves.toEqual([])
  })

  it("clear 删除该项目日志", async () => {
    const io = new MemoryIndexIO()
    const journal = new WriteJournal(io)
    await journal.record(KEY, entry())
    await journal.clear(KEY)
    expect(io.raw(FILE)).toBe("")
  })

  it("按项目隔离：不同项目不互相覆盖", async () => {
    const io = new MemoryIndexIO()
    const journal = new WriteJournal(io)
    await journal.record("p1", entry({ label: "项目一" }))
    await journal.record("p2", entry({ label: "项目二" }))
    expect((await journal.list("p1"))[0].label).toBe("项目一")
    expect((await journal.list("p2"))[0].label).toBe("项目二")
  })
})

describe("parsePreWriteState", () => {
  it("从 log 装饰中取当前分支，reflog 选择器与说明拼成一条记录", () => {
    const state = parsePreWriteState(
      "abc123\0HEAD -> main, origin/main, v1.0\0",
      "HEAD@{0}\0commit: 修复登录\0",
    )
    expect(state).toEqual({
      headBefore: "abc123",
      branchBefore: "main",
      reflogBefore: "HEAD@{0}: commit: 修复登录",
    })
  })

  it("detached HEAD 没有 HEAD -> 装饰，分支留空", () => {
    const state = parsePreWriteState("abc123\0\0", "HEAD@{0}\0checkout: moving from main to abc123\0")
    expect(state.headBefore).toBe("abc123")
    expect(state.branchBefore).toBe("")
  })

  it("空仓库 / 无 reflog：命令失败传入空串时不抛错、字段全空", () => {
    expect(parsePreWriteState("", "")).toEqual({ headBefore: "", branchBefore: "", reflogBefore: "" })
  })
})

describe("journalLabel", () => {
  it("取提交信息首行并截断超长内容", () => {
    expect(journalLabel("修复登录\n\n详细说明")).toBe("修复登录")
    expect(journalLabel("   ")).toBe("")
    expect(journalLabel("长".repeat(100))).toBe(`${"长".repeat(80)}…`)
  })
})
