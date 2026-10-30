// splitLogLinks 行为断言：链接切分、尾随标点剥离、非链接文本保持原样
import { describe, expect, it } from "vitest"
import { splitLogLinks } from "./logLinks"

describe("splitLogLinks", () => {
  it("空文本返回空数组", () => {
    expect(splitLogLinks("")).toEqual([])
  })

  it("无链接时整段作为普通文本", () => {
    expect(splitLogLinks("vite v5 ready in 300ms")).toEqual([
      { text: "vite v5 ready in 300ms" },
    ])
  })

  it("从 vite 输出中识别本地链接", () => {
    expect(splitLogLinks("  ➜  Local:   http://localhost:5173/\n")).toEqual([
      { text: "  ➜  Local:   " },
      { text: "http://localhost:5173/", url: "http://localhost:5173/" },
      { text: "\n" },
    ])
  })

  it("剥离链接尾部的句子标点与右括号", () => {
    expect(splitLogLinks("see (https://example.com/a?b=1), done")).toEqual([
      { text: "see (" },
      { text: "https://example.com/a?b=1", url: "https://example.com/a?b=1" },
      { text: ")," },
      { text: " done" },
    ])
  })

  it("一段文本中的多个链接都会识别", () => {
    const segments = splitLogLinks("http://a.dev 与 https://b.dev")
    expect(segments.filter(s => s.url).map(s => s.url)).toEqual([
      "http://a.dev",
      "https://b.dev",
    ])
  })

  it("只有 scheme 不算链接", () => {
    expect(splitLogLinks("https:// 后面没有地址")).toEqual([
      { text: "https:// 后面没有地址" },
    ])
  })
})
