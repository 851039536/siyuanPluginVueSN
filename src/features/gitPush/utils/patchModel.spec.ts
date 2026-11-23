// src/features/gitPush/utils/patchModel.spec.ts — 补丁解析单元测试
//
// 覆盖重点：单/多文件切分、hunk 头与行类型、CRLF 原样保留、二进制标记、
// 无换行标记、计数省略与零长度 hunk。
import { describe, expect, it } from "vitest"
import { parsePatch } from "./patchModel"

const SIMPLE_PATCH = [
  "diff --git a/a.txt b/a.txt",
  "index 1111111..2222222 100644",
  "--- a/a.txt",
  "+++ b/a.txt",
  "@@ -1,4 +1,4 @@",
  " line1",
  "-old2",
  "+new2",
  " line3",
  " line4",
  "@@ -10,4 +10,5 @@ function x",
  " line10",
  "-old11",
  "+new11",
  "+new11b",
  " line12",
  " line13",
].join("\n") + "\n"

describe("parsePatch", () => {
  it("空输入返回空数组", () => {
    expect(parsePatch("")).toEqual([])
  })

  it("解析单文件的两个 hunk 与行类型", () => {
    const [file] = parsePatch(SIMPLE_PATCH)
    expect(file.binary).toBe(false)
    expect(file.preamble).toHaveLength(4)
    expect(file.hunks).toHaveLength(2)

    const [first, second] = file.hunks
    expect(first).toMatchObject({ oldStart: 1, oldCount: 4, newStart: 1, newCount: 4, section: "" })
    expect(second).toMatchObject({ oldStart: 10, oldCount: 4, newStart: 10, newCount: 5, section: " function x" })
    expect(first.lines.map((line) => line.kind)).toEqual(["context", "del", "add", "context", "context"])
    expect(first.lines.map((line) => line.text)).toEqual(["line1", "old2", "new2", "line3", "line4"])
  })

  it("行为每行分配稳定、递增的 id", () => {
    const [file] = parsePatch(SIMPLE_PATCH)
    const ids = file.hunks.flatMap((hunk) => hunk.lines.map((line) => line.id))
    expect(ids).toEqual(Array.from({ length: ids.length }, (_, index) => index))
  })

  it("CRLF 补丁的 raw 与 eol 原样保留", () => {
    const [file] = parsePatch(SIMPLE_PATCH.replace(/\n/g, "\r\n"))
    expect(file.raw.includes("\r\n")).toBe(true)
    expect(file.hunks[0].eol).toBe("\r\n")
    expect(file.hunks[0].lines[0].raw.endsWith("\r\n")).toBe(true)
    expect(file.hunks[0].lines[0].eol).toBe("\r\n")
  })

  it("识别二进制标记且不产出 hunk", () => {
    const [file] = parsePatch([
      "diff --git a/logo.png b/logo.png",
      "index 1111111..2222222 100644",
      "Binary files a/logo.png and b/logo.png differ",
    ].join("\n") + "\n")
    expect(file.binary).toBe(true)
    expect(file.hunks).toEqual([])
    expect(file.preamble).toHaveLength(3)
  })

  it("按 diff 头切分多个文件，并支持省略 ,1 的计数", () => {
    const text = SIMPLE_PATCH + [
      "diff --git a/b.txt b/b.txt",
      "--- a/b.txt",
      "+++ b/b.txt",
      "@@ -1 +1 @@",
      "-x",
      "+y",
    ].join("\n") + "\n"
    const files = parsePatch(text)
    expect(files).toHaveLength(2)
    expect(files[1].hunks[0]).toMatchObject({ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1 })
  })

  it("解析零长度 hunk（新文件）", () => {
    const [file] = parsePatch([
      "diff --git a/new.txt b/new.txt",
      "--- /dev/null",
      "+++ b/new.txt",
      "@@ -0,0 +1,2 @@",
      "+hello",
      "+world",
    ].join("\n") + "\n")
    expect(file.hunks[0]).toMatchObject({ oldStart: 0, oldCount: 0, newStart: 1, newCount: 2 })
    expect(file.hunks[0].lines.map((line) => line.kind)).toEqual(["add", "add"])
  })

  it("无换行标记作为独立行保留", () => {
    const [file] = parsePatch([
      "diff --git a/a.txt b/a.txt",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,2 +1,2 @@",
      " a",
      "-oldb",
      "\\ No newline at end of file",
      "+newb",
      "\\ No newline at end of file",
    ].join("\n") + "\n")
    const hunk = file.hunks[0]
    expect(hunk.lines.map((line) => line.kind)).toEqual(["context", "del", "noNewline", "add", "noNewline"])
    expect(hunk.lines[2].raw).toBe("\\ No newline at end of file\n")
    expect(hunk.lines[2].text).toBe(" No newline at end of file")
  })

  it("末尾没有换行时保留 eol 为空", () => {
    const [file] = parsePatch("@@ -1 +1 @@\n-a\n+b")
    expect(file.hunks[0].lines[1].raw).toBe("+b")
    expect(file.hunks[0].lines[1].eol).toBe("")
  })
})
