// `lineScan` 增量扫描单测 —— 这是行数排行刷新性能的核心，错判会直接导致行数错误或每次全量重读。
//
// 用真实临时目录 + 真实 fs（Node 环境），不 mock：mtime/size 失效判据本身就是与
// 文件系统交互的行为，mock fs 只能验证「代码调用了什么」，验不出「结果是否正确」。
import type { FileLinesRecord } from "./LineStatsStore"
import { mkdtempSync, rmSync, writeFileSync, utimesSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { scanProjectFileLines, sumScannedLines, FILE_LINES_MAX_BYTES } from "./lineScan"

describe("scanProjectFileLines（增量扫描）", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gpush-linescan-"))
  })

  // ── 回归：切分支场景下 git status 变更集不可靠 ──
  //
  // 这是曾经的真实 bug：GitPushManager 在「HEAD 已变化」时用
  // `git status --porcelain` 的变更集决定哪些文件重算，但 git status 只比较
  // 「工作区 vs index」。切分支时 index 同步更新，于是它报「干净」（变更集为空），
  // 所有文件沿用旧行数 —— 行数从此永久错误，且没有任何报错。
  // 生产路径已改为一律逐文件 statSync，本用例锁住 stat 判据的正确性。
  it("切分支后内容变化必须被 stat 判据发现（变更集为空也不能沿用旧行数）", () => {
    // 模拟：旧缓存记录 a.ts 为 3 行
    const old = write("a.ts", "1\n2\n3\n")
    // 模拟切分支：内容变为 7 行（size 与 mtime 都变）
    writeFileSync(join(dir, "a.ts"), "1\n2\n3\n4\n5\n6\n7\n", "utf8")

    // 逐文件 stat 判据（生产路径）：必须发现变化
    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", old]]))
    expect(r.files[0].lines).toBe(7)
    expect(r.files[0].reused).toBe(false)
  })

  it("对照：若误用空变更集，该文件会被错误复用为旧行数（说明该模式在此场景不可靠）", () => {
    const old = write("a.ts", "1\n2\n3\n")
    writeFileSync(join(dir, "a.ts"), "1\n2\n3\n4\n5\n6\n7\n", "utf8")

    // 变更集为空 = git status 报「干净」时的真实返回
    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", old]]), new Set<string>())
    // 这就是 bug 的表现：内容已变 7 行，却沿用 3 行
    expect(r.files[0].lines).toBe(3)
    expect(r.files[0].reused).toBe(true)
    // 注释保留此用例是为了说明「为什么生产路径不用变更集模式」
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  /** 写入文件并返回其 stat 记录（模拟落库的缓存条目） */
  function write(file: string, content: string): FileLinesRecord {
    writeFileSync(join(dir, file), content, "utf8")
    const st = scanProjectFileLines(dir, [file], new Map())
    return st.files[0]
  }

  // ── 回归：切分支场景下 git status 变更集不可靠 ──
  //
  // 这是曾经的真实 bug：GitPushManager 在「HEAD 已变化」时用
  // `git status --porcelain` 的变更集决定哪些文件重算，但 git status 只比较
  // 「工作区 vs index」。切分支时 index 同步更新，于是它报「干净」（变更集为空），
  // 所有文件沿用旧行数 —— 行数从此永久错误，且没有任何报错。
  // 生产路径已改为一律逐文件 statSync，本用例锁住 stat 判据的正确性。
  it("切分支后内容变化必须被 stat 判据发现（变更集为空也不能沿用旧行数）", () => {
    const old = write("a.ts", "1\n2\n3\n")
    // 模拟切分支：内容变为 7 行（size 与 mtime 都变）
    writeFileSync(join(dir, "a.ts"), "1\n2\n3\n4\n5\n6\n7\n", "utf8")

    // 逐文件 stat 判据（生产路径）：必须发现变化
    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", old]]))
    expect(r.files[0].lines).toBe(7)
    expect(r.files[0].reused).toBe(false)
  })

  it("对照：若误用空变更集，该文件会被错误复用为旧行数（说明该模式在此场景不可靠）", () => {
    const old = write("a.ts", "1\n2\n3\n")
    writeFileSync(join(dir, "a.ts"), "1\n2\n3\n4\n5\n6\n7\n", "utf8")

    // 空 Set = git status 报「干净」时的真实返回
    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", old]]), new Set<string>())
    // 这就是 bug 的表现：内容已变 7 行，却沿用 3 行
    expect(r.files[0].lines).toBe(3)
    expect(r.files[0].reused).toBe(true)
    // 保留此用例是为了说明「为什么生产路径不用变更集模式」
  })

  it("首次扫描（空缓存）读取全部文件并给出正确行数", () => {
    writeFileSync(join(dir, "a.ts"), "1\n2\n3\n", "utf8")
    writeFileSync(join(dir, "b.ts"), "1\n2", "utf8") // 末行无换行

    const r = scanProjectFileLines(dir, ["a.ts", "b.ts"], new Map())
    expect(r.files.map((f) => f.lines)).toEqual([3, 2])
    expect(r.reusedCount).toBe(0)
    expect(r.readCount).toBe(2)
  })

  it("mtime 与 size 都未变时复用缓存，不重新读取", () => {
    const rec = write("a.ts", "1\n2\n3\n")
    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", rec]]))

    expect(r.files[0].lines).toBe(3)
    expect(r.files[0].reused).toBe(true)
    expect(r.reusedCount).toBe(1)
    expect(r.readCount).toBe(0)
  })

  it("文件被修改（size 变化）后重新读取并更新行数", () => {
    const rec = write("a.ts", "1\n")
    writeFileSync(join(dir, "a.ts"), "1\n2\n3\n4\n5\n", "utf8")

    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", rec]]))
    expect(r.files[0].lines).toBe(5)
    expect(r.files[0].reused).toBe(false)
    expect(r.readCount).toBe(1)
  })

  it("size 相同但 mtime 变化时也判定为已修改（等长内容替换）", () => {
    const rec = write("a.ts", "aaa\n")
    // 等长内容：size 完全一致，只有 mtime 能区分
    writeFileSync(join(dir, "a.ts"), "bbb\n", "utf8")
    // 显式把 mtime 推后，避免同毫秒写入导致判据误判为未变（真实开发中 mtime 必然推进）
    const future = new Date(Date.now() + 5000)
    utimesSync(join(dir, "a.ts"), future, future)

    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", rec]]))
    expect(r.files[0].reused).toBe(false)
    expect(r.readCount).toBe(1)
  })

  it("新增文件（缓存中不存在）会被读取，已缓存文件仍复用", () => {
    const a = write("a.ts", "1\n2\n")
    writeFileSync(join(dir, "c.ts"), "1\n2\n3\n", "utf8")

    const r = scanProjectFileLines(dir, ["a.ts", "c.ts"], new Map([["a.ts", a]]))
    expect(r.files.map((f) => f.lines)).toEqual([2, 3])
    expect(r.reusedCount).toBe(1)
    expect(r.readCount).toBe(1)
  })

  it("删除的文件不在结果中（由调用方按 ls-files 清单决定范围）", () => {
    const a = write("a.ts", "1\n")
    rmSync(join(dir, "a.ts"))

    // ls-files 已不含 a.ts，故不传；此处验证「传了就按缺失处理」
    const r = scanProjectFileLines(dir, [], new Map([["a.ts", a]]))
    expect(r.files).toHaveLength(0)
  })

  it("ls-files 列出的文件已从磁盘删除时记 null（不抛错）", () => {
    const r = scanProjectFileLines(dir, ["gone.ts"], new Map())
    expect(r.files[0].lines).toBeNull()
    expect(r.files[0].reused).toBe(false)
  })

  it("超过 2MB 的文件不读内容，行数记 null", () => {
    // 建一个刚好超过上限的文件（用空格避免行数统计干扰）
    writeFileSync(join(dir, "big.bin"), "a".repeat(FILE_LINES_MAX_BYTES + 1), "utf8")
    const r = scanProjectFileLines(dir, ["big.bin"], new Map())
    expect(r.files[0].lines).toBeNull()
  })

  it("子目录中的文件按相对路径正确解析", () => {
    mkdirSync(join(dir, "src", "deep"), { recursive: true })
    writeFileSync(join(dir, "src", "deep", "x.ts"), "1\n2\n", "utf8")

    const r = scanProjectFileLines(dir, ["src/deep/x.ts"], new Map())
    expect(r.files[0].lines).toBe(2)
  })

  it("缓存命中的记录也回报当前 mtime/size（供下一轮继续复用）", () => {
    const rec = write("a.ts", "1\n2\n")
    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", rec]]))
    expect(r.files[0].mtimeMs).toBe(rec.mtimeMs)
    expect(r.files[0].size).toBe(rec.size)
  })

  // ── 方案 B：传入 changedPaths（git status 变更集）时，未变更文件不再 statSync ──
  it("变更集内未列出的文件直接复用缓存，即使磁盘 mtime 已变也不重读", () => {
    const rec = write("a.ts", "1\n2\n3\n")
    // 模拟「文件其实被改过，但 git status 说没变」——此时应完全信任变更集
    writeFileSync(join(dir, "a.ts"), "1\n2\n3\n4\n5\n6\n7\n", "utf8")
    const future = new Date(Date.now() + 5000)
    utimesSync(join(dir, "a.ts"), future, future)

    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", rec]]), new Set<string>())
    expect(r.files[0].lines).toBe(3) // 沿用缓存
    expect(r.files[0].reused).toBe(true)
    expect(r.readCount).toBe(0)
  })

  it("变更集内列出的文件强制重读并得到新行数", () => {
    const rec = write("a.ts", "1\n")
    writeFileSync(join(dir, "a.ts"), "1\n2\n3\n4\n", "utf8")

    const r = scanProjectFileLines(dir, ["a.ts"], new Map([["a.ts", rec]]), new Set(["a.ts"]))
    expect(r.files[0].lines).toBe(4)
    expect(r.files[0].reused).toBe(false)
    expect(r.readCount).toBe(1)
  })

  it("变更集里未缓存的文件仍会被读取（新增文件不会被漏掉）", () => {
    writeFileSync(join(dir, "new.ts"), "1\n2\n", "utf8")
    // 变更集没列出 new.ts，但缓存里也没有 → 必须读
    const r = scanProjectFileLines(dir, ["new.ts"], new Map(), new Set<string>())
    expect(r.files[0].lines).toBe(2)
    expect(r.readCount).toBe(1)
  })

  it("变更集模式下混合场景：复用/重读各自计数正确", () => {
    const a = write("a.ts", "1\n")
    const b = write("b.ts", "1\n2\n")
    writeFileSync(join(dir, "c.ts"), "1\n2\n3\n", "utf8")
    const cache = new Map([["a.ts", a], ["b.ts", b]])
    const r = scanProjectFileLines(dir, ["a.ts", "b.ts", "c.ts"], cache, new Set(["b.ts"]))

    expect(r.reusedCount).toBe(2) // a 不在变更集 → 复用；b 在变更集但内容未变 → 也复用
    expect(r.readCount).toBe(1) // 仅 c 真正读内容
    expect(r.files.find((f) => f.path === "a.ts")?.lines).toBe(1)
    expect(r.files.find((f) => f.path === "b.ts")?.lines).toBe(2)
    expect(r.files.find((f) => f.path === "c.ts")?.lines).toBe(3)
  })
})

describe("sumScannedLines（合计）", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gpush-linesum-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("只合计可读且通过过滤的文件", () => {
    writeFileSync(join(dir, "a.ts"), "1\n2\n3\n", "utf8")
    writeFileSync(join(dir, "b.md"), "1\n2\n", "utf8")
    writeFileSync(join(dir, "big.bin"), "a".repeat(FILE_LINES_MAX_BYTES + 1), "utf8")

    const r = scanProjectFileLines(dir, ["a.ts", "b.md", "big.bin"], new Map())
    // 无过滤：a=3 + b=2（big 为 null 不计）
    expect(sumScannedLines(r.files, () => true)).toBe(5)
    // 排除 .md：只剩 a=3
    expect(sumScannedLines(r.files, (p) => !p.endsWith(".md"))).toBe(3)
    // 全过滤：0
    expect(sumScannedLines(r.files, () => false)).toBe(0)
  })

  it("被过滤的文件依然被扫描并保留在结果中（供切换过滤条件时复用缓存）", () => {
    writeFileSync(join(dir, "a.ts"), "1\n", "utf8")
    const r = scanProjectFileLines(dir, ["a.ts"], new Map())
    // 过滤只发生在合计阶段，扫描结果始终完整
    expect(r.files).toHaveLength(1)
    expect(sumScannedLines(r.files, () => false)).toBe(0)
  })
})
