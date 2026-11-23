// src/features/gitPush/utils/hunkPatch.spec.ts — hunk 级补丁重建单元测试
//
// 覆盖重点：未选 + 丢弃、未选 - 降上下文、跨 hunk 位移、纯增删头、
// CRLF 与 no-newline 标记的跟随关系。
import type { FilePatch, PatchLine } from "./patchModel"
import { describe, expect, it } from "vitest"
import { buildHunkPatch, buildSelectedPatch, selectHunkLines } from "./hunkPatch"
import { parsePatch } from "./patchModel"

const PATCH = [
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

const PREAMBLE = [
  "diff --git a/a.txt b/a.txt",
  "index 1111111..2222222 100644",
  "--- a/a.txt",
  "+++ b/a.txt",
].join("\n") + "\n"

const NO_NEWLINE_PATCH = [
  "diff --git a/a.txt b/a.txt",
  "--- a/a.txt",
  "+++ b/a.txt",
  "@@ -1,2 +1,2 @@",
  " a",
  "-oldb",
  "\\ No newline at end of file",
  "+newb",
  "\\ No newline at end of file",
].join("\n") + "\n"

const NO_NEWLINE_PREAMBLE = [
  "diff --git a/a.txt b/a.txt",
  "--- a/a.txt",
  "+++ b/a.txt",
].join("\n") + "\n"

function findLine(file: FilePatch, kind: PatchLine["kind"], text: string): PatchLine {
  const line = file.hunks.flatMap((hunk) => hunk.lines).find((item) => item.kind === kind && item.text === text)
  if (!line) throw new Error(`missing ${kind} ${text}`)
  return line
}

describe("selectHunkLines", () => {
  it("只返回 add / del 行", () => {
    const [file] = parsePatch(PATCH)
    const ids = selectHunkLines(file, 0)
    expect(ids.size).toBe(2)
    expect(ids.has(findLine(file, "add", "new2").id)).toBe(true)
    expect(ids.has(findLine(file, "del", "old2").id)).toBe(true)
  })

  it("越界 hunk 返回空集合", () => {
    const [file] = parsePatch(PATCH)
    expect(selectHunkLines(file, 99).size).toBe(0)
  })
})

describe("buildHunkPatch", () => {
  it("全选时原样还原 hunk", () => {
    const [file] = parsePatch(PATCH)
    expect(buildHunkPatch(file, 0)).toBe(file.preamble.join("") + file.hunks[0].raw)
    expect(buildHunkPatch(file, 1)).toBe(file.preamble.join("") + file.hunks[1].raw)
  })

  it("只选一个 add：未选 + 丢弃、未选 - 降为上下文", () => {
    const [file] = parsePatch(PATCH)
    const add = findLine(file, "add", "new2")
    expect(buildHunkPatch(file, 0, new Set([add.id]))).toBe(PREAMBLE + [
      "@@ -1,4 +1,5 @@",
      " line1",
      " old2",
      "+new2",
      " line3",
      " line4",
    ].join("\n") + "\n")
  })

  it("只选一个 del：未选 + 丢弃，保留删除", () => {
    const [file] = parsePatch(PATCH)
    const del = findLine(file, "del", "old2")
    expect(buildHunkPatch(file, 0, new Set([del.id]))).toBe(PREAMBLE + [
      "@@ -1,4 +1,3 @@",
      " line1",
      "-old2",
      " line3",
      " line4",
    ].join("\n") + "\n")
  })

  it("未选中任何改动的 hunk 不输出", () => {
    const [file] = parsePatch(PATCH)
    const add = findLine(file, "add", "new11b")
    const built = buildHunkPatch(file, 1, new Set([add.id]))
    expect(built).toBe(PREAMBLE + [
      "@@ -10,4 +10,5 @@ function x",
      " line10",
      " old11",
      "+new11b",
      " line12",
      " line13",
    ].join("\n") + "\n")
  })

  it("选中行为空时返回空串", () => {
    const [file] = parsePatch(PATCH)
    expect(buildHunkPatch(file, 0, new Set())).toBe("")
    expect(buildSelectedPatch(file, new Set())).toBe("")
  })
})

describe("buildSelectedPatch", () => {
  it("跨 hunk 选择时后续 newStart 按已选增删累计位移", () => {
    const [file] = parsePatch(PATCH)
    const add1 = findLine(file, "add", "new2")
    const add2 = findLine(file, "add", "new11b")
    expect(buildSelectedPatch(file, new Set([add1.id, add2.id]))).toBe(PREAMBLE + [
      "@@ -1,4 +1,5 @@",
      " line1",
      " old2",
      "+new2",
      " line3",
      " line4",
      "@@ -10,4 +11,5 @@ function x",
      " line10",
      " old11",
      "+new11b",
      " line12",
      " line13",
    ].join("\n") + "\n")
  })

  it("限定 hunkIndexes 时被排除的 hunk 不参与位移", () => {
    const [file] = parsePatch(PATCH)
    const add1 = findLine(file, "add", "new2")
    const add2 = findLine(file, "add", "new11b")
    const built = buildSelectedPatch(file, new Set([add1.id, add2.id]), new Set([1]))
    expect(built).toContain("@@ -10,4 +10,5 @@ function x")
    expect(built).not.toContain("+new2")
  })

  it("纯插入的零长度 hunk 修正 newStart", () => {
    const insert = [
      "diff --git a/new.txt b/new.txt",
      "--- /dev/null",
      "+++ b/new.txt",
      "@@ -0,0 +1,2 @@",
      "+hello",
      "+world",
    ].join("\n") + "\n"
    const [file] = parsePatch(insert)
    expect(buildHunkPatch(file, 0)).toBe(insert)
    expect(buildHunkPatch(file, 0, new Set([findLine(file, "add", "hello").id]))).toBe([
      "diff --git a/new.txt b/new.txt",
      "--- /dev/null",
      "+++ b/new.txt",
      "@@ -0,0 +1 @@",
      "+hello",
    ].join("\n") + "\n")
  })

  it("纯删除的零长度 hunk 修正 newStart", () => {
    const remove = [
      "diff --git a/old.txt b/old.txt",
      "--- a/old.txt",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-bye",
      "-world",
    ].join("\n") + "\n"
    const [file] = parsePatch(remove)
    expect(buildHunkPatch(file, 0)).toBe(remove)
  })

  it("二进制补丁没有可重建的 hunk", () => {
    const [file] = parsePatch([
      "diff --git a/logo.png b/logo.png",
      "Binary files a/logo.png and b/logo.png differ",
    ].join("\n") + "\n")
    expect(buildSelectedPatch(file, new Set([1, 2]))).toBe("")
    expect(buildHunkPatch(file, 0)).toBe("")
  })
})

describe("no-newline 与 CRLF", () => {
  it("丢弃的 + 行连同其无换行标记一起丢弃", () => {
    const [file] = parsePatch(NO_NEWLINE_PATCH)
    const add = findLine(file, "add", "newb")
    expect(buildHunkPatch(file, 0, new Set([add.id]))).toBe(NO_NEWLINE_PREAMBLE + [
      "@@ -1,2 +1,3 @@",
      " a",
      " oldb",
      "+newb",
      "\\ No newline at end of file",
    ].join("\n") + "\n")
  })

  it("保留的 - 行保留其无换行标记", () => {
    const [file] = parsePatch(NO_NEWLINE_PATCH)
    const del = findLine(file, "del", "oldb")
    expect(buildHunkPatch(file, 0, new Set([del.id]))).toBe(NO_NEWLINE_PREAMBLE + [
      "@@ -1,2 +1 @@",
      " a",
      "-oldb",
      "\\ No newline at end of file",
    ].join("\n") + "\n")
  })

  it("全选时无换行标记原样保留", () => {
    const [file] = parsePatch(NO_NEWLINE_PATCH)
    expect(buildHunkPatch(file, 0)).toBe(file.preamble.join("") + file.hunks[0].raw)
  })

  it("CRLF 补丁重建后不产生裸 LF", () => {
    const [file] = parsePatch(PATCH.replace(/\n/g, "\r\n"))
    expect(buildHunkPatch(file, 0)).toBe(file.preamble.join("") + file.hunks[0].raw)
    const built = buildHunkPatch(file, 0, new Set([findLine(file, "add", "new2").id]))
    expect(built.includes("\r\n")).toBe(true)
    expect(built.replace(/\r\n/g, "")).not.toContain("\n")
  })
})
