// src/features/gitPush/utils/diffText.spec.ts — diff 文本处理单元测试
//
// 覆盖重点：hunk 行号驱动的行分类（首个 hunk 之前与文件头行为 meta）、
// 行号自增语义、末尾空行剥离、词级高亮的配对与占比阈值、预算采样。
import { describe, expect, it } from "vitest"
import {
  buildDiffContext,
  countDiffStats,
  diffCacheKey,
  DIFF_SIGN,
  parseDiffLines,
} from "./diffText"

/** 取数组末元素（tsconfig lib 为 ES2020，无 Array.prototype.at，故用索引替代） */
function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1]
}

describe("diffCacheKey", () => {
  it("暂存态前缀 s，工作区态前缀 u（同一键空间内不冲突）", () => {
    expect(diffCacheKey("a.ts", true)).toBe("s::a.ts")
    expect(diffCacheKey("a.ts", false)).toBe("u::a.ts")
  })

  it("同一路径的两种态产出不同键", () => {
    expect(diffCacheKey("a.ts", true)).not.toBe(diffCacheKey("a.ts", false))
  })
})

describe("DIFF_SIGN", () => {
  it("五种行类型各有符号（del 用 U+2212 而非 ASCII 连字符）", () => {
    expect(DIFF_SIGN.add).toBe("+")
    expect(DIFF_SIGN.del).toBe("−")
    expect(DIFF_SIGN.hunk).toBe("@")
    expect(DIFF_SIGN.ctx).toBe(" ")
    expect(DIFF_SIGN.meta).toBe(" ")
  })
})

describe("parseDiffLines", () => {
  it("空输入返回空数组", () => {
    expect(parseDiffLines("")).toEqual([])
  })

  it("单文件 diff：文件头行归为 meta，hunk 行归为 hunk", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "index 111..222 100644",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,2 +1,2 @@",
      "-old",
      "+new",
      " ctx",
    ].join("\n")

    const lines = parseDiffLines(diff)
    expect(lines.map((l) => l.type)).toEqual(["meta", "meta", "meta", "meta", "hunk", "del", "add", "ctx"])
  })

  it("首个 hunk 之前的所有行均为 meta（即使不以文件头前缀开头）", () => {
    const lines = parseDiffLines("some preamble\n@@ -1 +1 @@\n-a\n+b")
    expect(lines[0].type).toBe("meta")
  })

  it("hunk 行号驱动 add/del/ctx 的行号自增", () => {
    const diff = ["@@ -10,2 +20,2 @@", "-old", "+new", " ctx"].join("\n")
    const [, del, add, ctx] = parseDiffLines(diff)
    expect(del).toMatchObject({ type: "del", oldNo: 10, text: "old" })
    expect(add).toMatchObject({ type: "add", newNo: 20, text: "new" })
    expect(ctx).toMatchObject({ type: "ctx", oldNo: 11, newNo: 21, text: "ctx" })
  })

  it("剥离行首 +/-/空格标记（标记改由渲染层符号列展示）", () => {
    const lines = parseDiffLines("@@ -1 +1 @@\n-abc\n+def\n ghi")
    expect(lines[1].text).toBe("abc")
    expect(lines[2].text).toBe("def")
    expect(lines[3].text).toBe("ghi")
  })

  it("hunk 头省略计数形式（@@ -1 +1 @@）也能解析出行号", () => {
    const lines = parseDiffLines("@@ -5 +7 @@\n-a\n+b")
    expect(lines[1].oldNo).toBe(5)
    expect(lines[2].newNo).toBe(7)
  })

  it("第二个 hunk 重置行号基准", () => {
    const diff = ["@@ -1,1 +1,1 @@", "-a", "+b", "@@ -50,1 +60,1 @@", "-c", "+d"].join("\n")
    const lines = parseDiffLines(diff)
    const secondDel = lines[4]
    const secondAdd = lines[5]
    expect(secondDel).toMatchObject({ oldNo: 50 })
    expect(secondAdd).toMatchObject({ newNo: 60 })
  })

  it("新增文件：new file mode 归为 meta", () => {
    const diff = ["diff --git a/n.ts b/n.ts", "new file mode 100644", "index 000..111", "--- /dev/null", "+++ b/n.ts", "@@ -0,0 +1,1 @@", "+content"].join("\n")
    expect(parseDiffLines(diff)[1].type).toBe("meta")
    expect(last(parseDiffLines(diff))).toMatchObject({ type: "add", newNo: 1 })
  })

  it("Binary files 行归为 meta", () => {
    const diff = ["diff --git a/i.png b/i.png", "Binary files a/i.png and b/i.png differ"].join("\n")
    expect(parseDiffLines(diff)[1].type).toBe("meta")
  })

  it("\\ No newline at end of file 归为 meta", () => {
    const diff = ["@@ -1 +1 @@", "-a", "\\ No newline at end of file", "+b"].join("\n")
    expect(parseDiffLines(diff)[2].type).toBe("meta")
  })

  it("多文件 diff 中间的文件头行仍归为 meta（不因已有 hunk 而误判为 ctx）", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "@@ -1 +1 @@",
      "-a",
      "+b",
      "diff --git a/c.ts b/c.ts",
      "index 111..222 100644",
      "@@ -1 +1 @@",
      "-c",
      "+d",
    ].join("\n")
    const lines = parseDiffLines(diff)
    expect(lines[4].type).toBe("meta")
    expect(lines[5].type).toBe("meta")
    // 第二段的 -c/+d 应被正确识别（而非因前一段存在而塌成 ctx）
    expect(lines[7]).toMatchObject({ type: "del", text: "c" })
    expect(lines[8]).toMatchObject({ type: "add", text: "d" })
  })

  it("末尾换行经 split 产生的空行被剥离", () => {
    const withTrailing = parseDiffLines("@@ -1 +1 @@\n-a\n+b\n")
    const withoutTrailing = parseDiffLines("@@ -1 +1 @@\n-a\n+b")
    expect(withTrailing).toHaveLength(withoutTrailing.length)
    expect(last(withTrailing)?.text).toBe("b")
  })

  it("末尾 ctx 空行同样被剥离", () => {
    const lines = parseDiffLines("@@ -1 +1 @@\n-a\n+b\n ")
    expect(last(lines)?.type).toBe("add")
  })

  it("末尾 add/del 行即使文本为空也保留（不做剥离）", () => {
    const lines = parseDiffLines("@@ -1 +1 @@\n-\n+")
    expect(lines).toHaveLength(3)
    expect(last(lines)?.type).toBe("add")
  })

  it("行内 - 与 + 同时出现于文本内容时按行首字符判定", () => {
    const lines = parseDiffLines("@@ -1 +1 @@\n-- a\n++ b")
    expect(lines[1]).toMatchObject({ type: "del", text: "- a" })
    expect(lines[2]).toMatchObject({ type: "add", text: "+ b" })
  })
})

describe("countDiffStats", () => {
  it("统计 add / del 行数，忽略 hunk / ctx / meta", () => {
    const diff = ["diff --git a/a b/a", "@@ -1,2 +1,2 @@", "-old", "+new", " ctx", "-x", "+y"].join("\n")
    expect(countDiffStats(parseDiffLines(diff))).toEqual({ add: 2, del: 2 })
  })

  it("空输入返回零", () => {
    expect(countDiffStats([])).toEqual({ add: 0, del: 0 })
  })

  it("纯新增文件 del 为 0", () => {
    expect(countDiffStats(parseDiffLines("@@ -0,0 +1,2 @@\n+a\n+b"))).toEqual({ add: 2, del: 0 })
  })
})

describe("parseDiffLines 词级高亮（markInlineDiff）", () => {
  it("成对的 del/add 行生成 changed 分段", () => {
    const diff = ["@@ -1 +1 @@", "-const a = 1", "+const a = 2"].join("\n")
    const [, del, add] = parseDiffLines(diff)
    expect(del.segments).toBeDefined()
    expect(add.segments).toBeDefined()
    expect(del.segments?.some((s) => s.changed)).toBe(true)
    expect(add.segments?.some((s) => s.changed)).toBe(true)
  })

  it("公共前后缀被裁到 changed=false 分段", () => {
    const diff = ["@@ -1 +1 @@", "-foo(1)", "+foo(2)"].join("\n")
    const [, del, add] = parseDiffLines(diff)
    // 前缀 "foo(" 与后缀 ")" 未变
    expect(del.segments?.[0]).toEqual({ text: "foo(", changed: false })
    expect(last(del.segments ?? [])).toEqual({ text: ")", changed: false })
    expect(del.segments?.find((s) => s.changed)?.text).toBe("1")
    expect(add.segments?.find((s) => s.changed)?.text).toBe("2")
  })

  it("完全相同的配对行不生成 segments（无差异可高亮）", () => {
    const diff = ["@@ -1,1 +1,1 @@", "-same", "+same"].join("\n")
    const [, del, add] = parseDiffLines(diff)
    expect(del.segments).toBeUndefined()
    expect(add.segments).toBeUndefined()
  })

  it("变化占比超过阈值时不生成 segments（整行重写，高亮反而添噪）", () => {
    const diff = ["@@ -1 +1 @@", "-aaaaaaaaaa", "+bbbbbbbbbb"].join("\n")
    const [, del, add] = parseDiffLines(diff)
    expect(del.segments).toBeUndefined()
    expect(add.segments).toBeUndefined()
  })

  it("del 数量多于 add 时仅配对数内生成 segments", () => {
    const diff = ["@@ -1,3 +1,1 @@", "-line1", "-line2", "-line3", "+lineX"].join("\n")
    const lines = parseDiffLines(diff)
    // 只有第一对（line1 / lineX）配对
    expect(lines[1].segments).toBeDefined() // line1 配对
    expect(lines[4].segments).toBeDefined() // lineX 配对
    // line2 / line3 无配对
    expect(lines[2].segments).toBeUndefined()
    expect(lines[3].segments).toBeUndefined()
  })

  it("孤立的 del 块（后无 add）不生成 segments", () => {
    const diff = ["@@ -1,2 +1,1 @@", "-removed1", "-removed2", " ctx"].join("\n")
    const lines = parseDiffLines(diff)
    expect(lines[1].segments).toBeUndefined()
    expect(lines[2].segments).toBeUndefined()
  })

  it("ctx / hunk / meta 行始终不携带 segments", () => {
    const diff = ["@@ -1,4 +1,4 @@", " ctx", "-a1", "+a2"].join("\n")
    const lines = parseDiffLines(diff)
    expect(lines[0].segments).toBeUndefined() // hunk
    expect(lines[1].segments).toBeUndefined() // ctx
    expect(lines[2].segments).toBeDefined()   // del（与 add 配对）
    expect(lines[3].segments).toBeDefined()   // add
  })

  it("多组配对各自独立高亮（以 ctx 分隔的两个 del/add 块）", () => {
    const diff = ["@@ -1,4 +1,4 @@", "-a1", "+a2", " ctx", "-b1", "+b2"].join("\n")
    const lines = parseDiffLines(diff)
    // 索引：0=hunk 1=del(a1) 2=add(a2) 3=ctx 4=del(b1) 5=add(b2)
    expect(lines[1].segments?.find((s) => s.changed)?.text).toBe("1")
    expect(lines[4].segments?.find((s) => s.changed)?.text).toBe("1")
    expect(lines[5].segments?.find((s) => s.changed)?.text).toBe("2")
  })

  it("仅一个字符差异的单行替换也会被判定为整行重写（占比阈值生效）", () => {
    // "a" -> "b"：变化占比 100% > 60%，故不高亮（与长文本的细粒度高亮形成对照）
    const lines = parseDiffLines("@@ -1 +1 @@\n-a\n+b")
    expect(lines[1].segments).toBeUndefined()
    expect(lines[2].segments).toBeUndefined()
  })
})

describe("buildDiffContext", () => {
  const makeFileDiff = (name: string, bodySize: number): string =>
    `diff --git a/${name} b/${name}\nindex 1..2 100644\n--- a/${name}\n+++ b/${name}\n@@ -1,1 +1,1 @@\n-${"x".repeat(bodySize)}\n+${"y".repeat(bodySize)}`

  it("无 diff 内容返回空串", () => {
    expect(buildDiffContext("", 10000)).toBe("")
    expect(buildDiffContext("   \n  ", 10000)).toBe("")
  })

  it("单个短文件在预算内完整保留（不加截断提示）", () => {
    const diff = makeFileDiff("a.ts", 10)
    const out = buildDiffContext(diff, 10000)
    expect(out).toBe(diff)
    expect(out).not.toContain("已截断")
  })

  it("单文件超预算时截断并追加提示", () => {
    const diff = makeFileDiff("big.ts", 20000)
    const out = buildDiffContext(diff, 2000)
    expect(out).toContain("（此文件 diff 过长已截断）")
    expect(out.length).toBeLessThan(diff.length + 100)
  })

  it("文件数超出预算容量时只取前 N 个并追加省略提示", () => {
    // capacity = floor(total / 500)；total=1000 → capacity=2
    const diff = [makeFileDiff("a.ts", 5), makeFileDiff("b.ts", 5), makeFileDiff("c.ts", 5), makeFileDiff("d.ts", 5)].join("\n")
    const out = buildDiffContext(diff, 1000)
    expect(out).toContain("（其余 2 个文件的 diff 因上下文预算省略")
    expect(out).toContain("diff --git a/a.ts")
    expect(out).toContain("diff --git a/b.ts")
    expect(out).not.toContain("diff --git a/c.ts")
  })

  it("budget <= 0 时回退默认 10000", () => {
    const diff = makeFileDiff("a.ts", 10)
    expect(buildDiffContext(diff, 0)).toBe(buildDiffContext(diff, 10000))
    expect(buildDiffContext(diff, -5)).toBe(buildDiffContext(diff, 10000))
  })

  it("短文件的剩余配额回补给被截断的长文件", () => {
    // 小文件a + 大文件b：a 未用满的配额使 b 能保留更多内容
    const small = makeFileDiff("small.ts", 5)
    const big = makeFileDiff("big.ts", 3000)
    const out = buildDiffContext(`${small}\n${big}`, 4000)
    // 回补后 b 的保留长度应大于均分配额
    expect(out.length).toBeGreaterThan(0)
    expect(out).toContain("big.ts")
  })

  it("多 hunk 长文件按 hunk 采样时留下省略标记", () => {
    const hunks = Array.from({ length: 10 }, (_, i) => `@@ -${i * 10 + 1},1 +${i * 10 + 1},1 @@\n-${"x".repeat(300)}\n+${"y".repeat(300)}`).join("\n")
    const diff = `diff --git a/big.ts b/big.ts\nindex 1..2\n--- a/big.ts\n+++ b/big.ts\n${hunks}`
    const out = buildDiffContext(diff, 3000)
    // 采样时中间省略位置应有标记（或至少不超预算太多）
    expect(out.length).toBeLessThan(diff.length)
  })

  it("无 hunk 的 diff（二进制）回退头部截断", () => {
    const diff = `diff --git a/i.png b/i.png\nBinary files a/i.png and b/i.png differ\n${"padding".repeat(2000)}`
    const out = buildDiffContext(diff, 500)
    expect(out).toContain("已截断")
    expect(out.length).toBeLessThan(diff.length)
  })

  it("多个文件之间以空行分隔", () => {
    const diff = [makeFileDiff("a.ts", 5), makeFileDiff("b.ts", 5)].join("\n")
    expect(buildDiffContext(diff, 10000)).toContain("\n\n")
  })

  it("空块（仅空白）不计入文件数", () => {
    const diff = `${makeFileDiff("a.ts", 5)}\n   \n`
    expect(buildDiffContext(diff, 10000)).not.toContain("省略")
  })
})
