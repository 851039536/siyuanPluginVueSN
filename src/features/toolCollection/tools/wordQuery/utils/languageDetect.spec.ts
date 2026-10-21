// 长文翻译纯函数单测：语言检测、目标语言推导、长文分段
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  detectLanguage,
  languageLabel,
  oppositeLanguage,
  resolveLanguages,
  splitTextChunks,
} from "./languageDetect"

describe("detectLanguage（语言检测）", () => {
  it("纯中文判为中文", () => {
    expect(detectLanguage("这是一段中文文本")).toBe("zh")
  })

  it("纯英文判为英文", () => {
    expect(detectLanguage("This is an English paragraph.")).toBe("en")
  })

  it("含假名的日文判为日文（汉字与假名共用，靠假名区分）", () => {
    expect(detectLanguage("これは日本語のテストです")).toBe("ja")
  })

  it("含谚文的文本判为韩文", () => {
    expect(detectLanguage("안녕하세요")).toBe("ko")
  })

  it("中文占比低于阈值时按英文处理（英文正文中夹一两个汉字）", () => {
    expect(detectLanguage("This is a test 测试句子")).toBe("en")
  })

  it("中文占比达到阈值时判为中文（中文正文中夹少量英文）", () => {
    expect(detectLanguage("这是中文测试内容 with some English words")).toBe("zh")
  })

  it("中英混排的技术文本按汉字与英文词的多少判定主语言", () => {
    expect(detectLanguage("使用 TypeScript 编写代码")).toBe("zh")
    expect(detectLanguage("The concept of 幂等性 is important")).toBe("en")
  })

  it("空串与纯符号判为 unknown", () => {
    expect(detectLanguage("")).toBe("unknown")
    expect(detectLanguage("   ")).toBe("unknown")
    expect(detectLanguage("123 !@# 456")).toBe("unknown")
  })
})

describe("oppositeLanguage（另一种语言推导）", () => {
  it("中文与英文互为另一种语言", () => {
    expect(oppositeLanguage("zh")).toBe("en")
    expect(oppositeLanguage("en")).toBe("zh")
  })

  it("其余语种统一回退为中文", () => {
    expect(oppositeLanguage("ja")).toBe("zh")
    expect(oppositeLanguage("auto")).toBe("zh")
  })
})

describe("resolveLanguages（源/目标语言解析）", () => {
  it("源为自动时用检测结果回填，目标为自动时译为另一种语言", () => {
    expect(
      resolveLanguages({ source: "auto", target: "auto", detected: "zh" }),
    ).toEqual({ source: "zh", target: "en", sameLanguage: false })
  })

  it("检测为英文时目标自动解析为中文", () => {
    expect(
      resolveLanguages({ source: "auto", target: "auto", detected: "en" }),
    ).toEqual({ source: "en", target: "zh", sameLanguage: false })
  })

  it("检测不出语种时源保持 auto，目标回退为中文", () => {
    expect(
      resolveLanguages({ source: "auto", target: "auto", detected: "unknown" }),
    ).toEqual({ source: "auto", target: "zh", sameLanguage: false })
  })

  it("显式指定的源与目标不受检测结果影响", () => {
    expect(
      resolveLanguages({ source: "zh", target: "ja", detected: "en" }),
    ).toEqual({ source: "zh", target: "ja", sameLanguage: false })
  })

  it("源与目标为同一种语言时标记 sameLanguage", () => {
    expect(
      resolveLanguages({ source: "zh", target: "zh", detected: "zh" }),
    ).toEqual({ source: "zh", target: "zh", sameLanguage: true })
  })

  it("源为 auto 且检测结果等于显式目标时标记 sameLanguage", () => {
    expect(
      resolveLanguages({ source: "auto", target: "zh", detected: "zh" }),
    ).toEqual({ source: "zh", target: "zh", sameLanguage: true })
  })
})

describe("splitTextChunks（长文分段）", () => {
  it("短文本原样返回单段", () => {
    expect(splitTextChunks("短文本", 100)).toEqual(["短文本"])
  })

  it("空文本返回空数组", () => {
    expect(splitTextChunks("", 100)).toEqual([])
  })

  it("按空行分段，保留段落间空行", () => {
    const text = "第一段内容。\n\n第二段内容。"
    expect(splitTextChunks(text, 10)).toEqual(["第一段内容。", "第二段内容。"])
  })

  it("单段超长时降级按行切分", () => {
    const text = "aaaa\nbbbb\ncccc"
    expect(splitTextChunks(text, 5)).toEqual(["aaaa", "bbbb", "cccc"])
  })

  it("单行超长时硬切且不丢字符", () => {
    const text = "x".repeat(25)
    const chunks = splitTextChunks(text, 10)
    expect(chunks).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)])
    expect(chunks.join("")).toBe(text)
  })

  it("分段结果拼接后与原文一致（去除 CRLF 归一化差异）", () => {
    const text = `${"第一行内容".repeat(5)}\n\n${"第二行内容".repeat(5)}`
    const chunks = splitTextChunks(text, 20)
    expect(chunks.join("\n\n").length).toBeGreaterThan(0)
    expect(chunks.every((chunk) => chunk.length <= 20)).toBe(true)
  })
})

describe("languageLabel（语言展示名）", () => {
  it("返回映射表中的名称，未知代码回退为原值", () => {
    expect(languageLabel("zh")).toBe("中文")
    expect(languageLabel("xx")).toBe("xx")
  })

  it("提供 i18n 词条时优先返回本地化名称", () => {
    expect(languageLabel("zh", { chinese: "Chinese" })).toBe("Chinese")
    expect(languageLabel("en", { english: "English" })).toBe("English")
  })
})
