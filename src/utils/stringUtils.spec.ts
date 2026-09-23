// src/utils/stringUtils.spec.ts — 通用字符串工具单元测试（含三套转义函数的互不可替性）
import { describe, expect, it } from "vitest"
import {
  decodeXmlEntities,
  escapeHtml,
  escapeHtmlFull,
  escapeXml,
  getErrorMessage,
  stripHtml,
  stripHtmlSimple,
} from "./stringUtils"

describe("getErrorMessage", () => {
  it("Error 实例取 message", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom")
  })

  it("字符串原样返回", () => {
    expect(getErrorMessage("plain")).toBe("plain")
  })

  it("含 message 字段的普通对象取其字符串形式", () => {
    expect(getErrorMessage({ message: 42 })).toBe("42")
  })

  it("其余输入返回空串（不抛错）", () => {
    expect(getErrorMessage(null)).toBe("")
    expect(getErrorMessage(undefined)).toBe("")
    expect(getErrorMessage(123)).toBe("")
    expect(getErrorMessage({})).toBe("")
  })

  it("Error 子类同样命中 instanceof Error 分支", () => {
    class Custom extends Error {}
    expect(getErrorMessage(new Custom("custom"))).toBe("custom")
  })
})

describe("escapeHtml", () => {
  it("转义五个 HTML 特殊字符", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#039;&lt;/a&gt;")
  })

  it("单引号输出数字实体 &#039;（非命名实体）", () => {
    expect(escapeHtml("'")).toBe("&#039;")
  })

  it("反引号不转义（与 escapeHtmlFull 的关键差异）", () => {
    expect(escapeHtml("`")).toBe("`")
  })

  it("& 先于其它字符转义，不产生二次转义", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;")
  })
})

describe("escapeHtmlFull", () => {
  it("在 escapeHtml 基础上额外转义反引号", () => {
    expect(escapeHtmlFull("`")).toBe("&#96;")
  })

  it("五个基础字符与 escapeHtml 结果一致", () => {
    const input = `<a href="x">&'</a>`
    expect(escapeHtmlFull(input)).toBe(escapeHtml(input))
  })

  it("使用单次正则扫描，不产生链式二次转义", () => {
    expect(escapeHtmlFull("&amp;")).toBe("&amp;amp;")
  })
})

describe("escapeXml", () => {
  it("单引号输出命名实体 &apos;（与 escapeHtml 的关键差异）", () => {
    expect(escapeXml("'")).toBe("&apos;")
  })

  it("反引号不转义", () => {
    expect(escapeXml("`")).toBe("`")
  })

  it("五个 XML 预定义实体的标准映射", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;")
  })
})

describe("三套转义函数不可互替（回归锁定）", () => {
  const input = `<>&"'` + "`"

  it("escapeXml 与 escapeHtml 仅在单引号上分叉", () => {
    expect(escapeHtml(input)).toContain("&#039;")
    expect(escapeXml(input)).toContain("&apos;")
    expect(escapeHtml(input)).not.toContain("&apos;")
    expect(escapeXml(input)).not.toContain("&#039;")
  })

  it("escapeHtmlFull 是唯一转义反引号的实现", () => {
    expect(escapeHtmlFull(input)).toContain("&#96;")
    expect(escapeHtml(input)).not.toContain("&#96;")
    expect(escapeXml(input)).not.toContain("&#96;")
  })

  it("三者对纯文本输入结果一致", () => {
    const safe = "hello world 123"
    expect(escapeHtml(safe)).toBe(safe)
    expect(escapeHtmlFull(safe)).toBe(safe)
    expect(escapeXml(safe)).toBe(safe)
  })
})

describe("decodeXmlEntities", () => {
  it("还原五个命名实体", () => {
    expect(decodeXmlEntities("&amp;&lt;&gt;&quot;&apos;")).toBe(`&<>"'`)
  })

  it("还原十进制数字实体", () => {
    expect(decodeXmlEntities("&#65;&#97;")).toBe("Aa")
    expect(decodeXmlEntities("&#20013;")).toBe("中")
  })

  it("与 escapeXml 构成往返（命名实体路径）", () => {
    const original = `<tag attr="v">it's</tag>`
    expect(decodeXmlEntities(escapeXml(original))).toBe(original)
  })

  it("先解 &amp; 会使后续实体被二次解码（既有顺序，登记为已知行为）", () => {
    // 输入 "&amp;lt;" 表示字面量 "&lt;"，但 &amp; 先被还原为 &，
    // 于是中间态 "&lt;" 又被 &lt; 规则命中 → 得 "<"，属过度解码
    expect(decodeXmlEntities("&amp;lt;")).toBe("<")
  })
})

describe("stripHtml / stripHtmlSimple", () => {
  it("剥离标签并折叠空白", () => {
    expect(stripHtmlSimple("<p>a</p>\n  <p>b</p>")).toBe("a b")
  })

  it("stripHtml 对空输入返回 undefined", () => {
    expect(stripHtml(undefined)).toBeUndefined()
    expect(stripHtml("")).toBeUndefined()
  })

  it("stripHtml 对纯标签输入返回 undefined（结果为空白）", () => {
    expect(stripHtml("<br/>")).toBeUndefined()
  })

  it("stripHtml 返回剥离结果", () => {
    expect(stripHtml("<b>hi</b>")).toBe("hi")
  })

  it("stripHtmlSimple 对空输入返回空串（非 undefined）", () => {
    expect(stripHtmlSimple("")).toBe("")
  })
})
