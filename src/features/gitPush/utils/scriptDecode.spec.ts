// 脚本输出解码器单测 —— 乱码修复的核心：Windows 中文输出 GBK/UTF-8 混杂，
// 误判码制会把「中文」变成乱码。逐场景覆盖：
//   - UTF-8 中文（含 chunk 边界截断多字节字符）不得误判为 GBK
//   - GBK 中文必须自动识别并正确解码
//   - 纯 ASCII 立即放行（无滞留）
//   - ANSI 彩色转义必须清掉（预览区是纯文本）
//   - flush 时暂扣字节不得丢失
import { describe, expect, it } from "vitest"
import { createScriptOutputDecoder } from "./scriptDecode"

const utf8Bytes = (s: string) => new Uint8Array(Buffer.from(s, "utf-8"))
/** "中文" 的 GBK 编码字节 */
const GBK_ZHONG_WEN = new Uint8Array([0xD6, 0xD0, 0xCE, 0xC4])

describe("createScriptOutputDecoder", () => {
  it("UTF-8 中文正确解码（含多字节字符被 chunk 边界截断）", () => {
    const d = createScriptOutputDecoder()
    const bytes = utf8Bytes("构建中文输出")
    const cut = 2 // 「构」(E6 9E 84) 的三字节中间切开
    const part1 = d.push(bytes.subarray(0, cut))
    const part2 = d.push(bytes.subarray(cut))
    expect(part1 + part2).toBe("构建中文输出")
  })

  it("GBK 中文自动识别并正确解码（Windows 乱码根因场景）", () => {
    const d = createScriptOutputDecoder()
    const text = d.push(GBK_ZHONG_WEN) + d.flush()
    expect(text).toBe("中文")
  })

  it("GBK 输出混排 ASCII 也正确", () => {
    const d = createScriptOutputDecoder()
    const bytes = new Uint8Array([0x65, 0x63, 0x68, 0x6F, 0x3A, 0x20, ...GBK_ZHONG_WEN])
    const text = d.push(bytes) + d.flush()
    expect(text).toBe("echo: 中文")
  })

  it("纯 ASCII 立即放行不滞留", () => {
    const d = createScriptOutputDecoder()
    expect(d.push(utf8Bytes("hello\n"))).toBe("hello\n")
  })

  it("UTF-8 输出不足判定阈值时由 flush 收尾，不丢字节", () => {
    const d = createScriptOutputDecoder()
    const part = d.push(utf8Bytes("中"))
    expect(part).toBe("") // 3 个高位字节 < 4，暂扣等待判定
    expect(d.flush()).toBe("中")
  })

  it("ANSI 彩色转义被清理", () => {
    const d = createScriptOutputDecoder()
    expect(d.push(utf8Bytes("\x1b[32mOK\x1b[0m\n"))).toBe("OK\n")
    expect(d.push(new Uint8Array([0x1B, 0x5B, 0x33, 0x31, 0x6D, ...GBK_ZHONG_WEN])) + d.flush()).toBe("中文")
  })
})
