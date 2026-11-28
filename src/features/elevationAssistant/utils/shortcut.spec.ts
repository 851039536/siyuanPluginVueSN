import {
  describe,
  expect,
  it,
} from "vitest"
import {
  hasLnkExtension,
  hasRunAsAdminFlag,
  isShortcutHeader,
  normalizeShortcutName,
  sanitizeShortcutName,
  stripLnkExtension,
  suggestToolName,
  validateShortcutName,
} from "./shortcut"

/** 构造一个最小合法 .lnk 字节序列（0x4C 头 + 足够长度） */
function makeLnk(linkFlagsByte = 0x00, length = 0x20): Uint8Array {
  const bytes = new Uint8Array(length)
  bytes[0] = 0x4C
  bytes[1] = 0x00
  bytes[2] = 0x00
  bytes[3] = 0x00
  bytes[0x15] = linkFlagsByte
  return bytes
}

describe("isShortcutHeader", () => {
  it("识别合法 Shell Link 头", () => {
    expect(isShortcutHeader(makeLnk())).toBe(true)
  })

  it("拒绝过短或签名错误的字节", () => {
    expect(isShortcutHeader(new Uint8Array([0x4C, 0x00, 0x00]))).toBe(false)
    expect(isShortcutHeader(new Uint8Array([0x4D, 0x5A, 0x00, 0x00]))).toBe(false)
  })
})

describe("hasRunAsAdminFlag", () => {
  it("按 0x15 的 0x20 位判断", () => {
    expect(hasRunAsAdminFlag(makeLnk(0x00))).toBe(false)
    expect(hasRunAsAdminFlag(makeLnk(0x20))).toBe(true)
    // 其他位不影响判定
    expect(hasRunAsAdminFlag(makeLnk(0xFF))).toBe(true)
    expect(hasRunAsAdminFlag(makeLnk(0x80))).toBe(false)
  })

  it("字节不足时视为未设置", () => {
    expect(hasRunAsAdminFlag(makeLnk(0x20, 0x10))).toBe(false)
  })
})

describe("快捷方式名称", () => {
  it("去掉一层 .lnk 后缀（大小写不敏感）", () => {
    expect(stripLnkExtension("tool.lnk")).toBe("tool")
    expect(stripLnkExtension("tool.LNK")).toBe("tool")
    expect(stripLnkExtension(" tool.lnk.lnk ")).toBe("tool.lnk")
    expect(normalizeShortcutName("  my tool  ")).toBe("my tool")
  })

  it("拦截非法字符与 Windows 保留名", () => {
    for (const ch of ["\\", "/", ":", "*", "?", "\"", "<", ">", "|"]) {
      expect(validateShortcutName(`a${ch}b`)).toBe("invalidChars")
    }
    expect(validateShortcutName("CON")).toBe("reserved")
    expect(validateShortcutName("com1")).toBe("reserved")
    expect(validateShortcutName("nul.lnk")).toBe("reserved")
  })

  it("拦截空名、过长名与尾部点/空格", () => {
    expect(validateShortcutName("   ")).toBe("empty")
    expect(validateShortcutName(".lnk")).toBe("empty")
    expect(validateShortcutName("a".repeat(101))).toBe("tooLong")
    expect(validateShortcutName("tool.")).toBe("trailing")
    // 首尾空白会被规范化掉，不算尾部空格错误
    expect(validateShortcutName("tool ")).toBeNull()
    expect(validateShortcutName("..")).toBe("trailing")
  })

  it("放行中文、空格、点与连字符", () => {
    expect(validateShortcutName("备份工具 v2")).toBeNull()
    expect(validateShortcutName("build.prod-1")).toBeNull()
    expect(validateShortcutName("工具.lnk")).toBeNull()
  })

  it("清洗后总能得到可用名称", () => {
    expect(sanitizeShortcutName("a/b:c")).toBe("abc")
    expect(sanitizeShortcutName("CON", "快捷方式")).toBe("快捷方式")
    expect(sanitizeShortcutName("   ", "快捷方式")).toBe("快捷方式")
    expect(sanitizeShortcutName("tool.")).toBe("tool")
    // 未传兜底时使用英文技术默认值，避免纯函数里硬编码中文
    expect(sanitizeShortcutName("CON")).toBe("shortcut")
  })

  it("从 exe 路径推导名称", () => {
    expect(suggestToolName("C:\\Tools\\notepad.EXE")).toBe("notepad")
    expect(suggestToolName("D:/Soft/某工具.exe")).toBe("某工具")
    expect(suggestToolName("\"C:\\a b\\tool.exe\"")).toBe("tool")
    expect(suggestToolName("", "快捷方式")).toBe("快捷方式")
    expect(suggestToolName("")).toBe("shortcut")
  })

  it("识别 .lnk 扩展名", () => {
    expect(hasLnkExtension("C:\\a\\b.lnk")).toBe(true)
    expect(hasLnkExtension("C:\\a\\b.LNK")).toBe(true)
    expect(hasLnkExtension("C:\\a\\b.exe")).toBe(false)
  })
})
