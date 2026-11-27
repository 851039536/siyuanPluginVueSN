import { describe, expect, it } from "vitest"
import {
  defaultWorkingDir,
  hasExeExtension,
  isAbsoluteWindowsPath,
  isShortcutLocation,
  normalizeTargetPath,
  validateTargetPathInput,
  validateWorkingDirInput,
  windowsBasename,
  windowsDirname,
} from "./validation"

describe("isAbsoluteWindowsPath", () => {
  it("识别盘符、UNC 与 \\\\?\\ 前缀", () => {
    expect(isAbsoluteWindowsPath("C:\\Tools\\a.exe")).toBe(true)
    expect(isAbsoluteWindowsPath("d:/tools/a.exe")).toBe(true)
    expect(isAbsoluteWindowsPath("\\\\server\\share\\a.exe")).toBe(true)
    expect(isAbsoluteWindowsPath("\\\\?\\C:\\Tools\\a.exe")).toBe(true)
    expect(isAbsoluteWindowsPath("\\\\?\\UNC\\server\\share\\a.exe")).toBe(true)
  })

  it("拒绝相对路径与空值", () => {
    expect(isAbsoluteWindowsPath("tools\\a.exe")).toBe(false)
    expect(isAbsoluteWindowsPath(".\\a.exe")).toBe(false)
    expect(isAbsoluteWindowsPath("")).toBe(false)
  })
})

describe("Windows 路径拆解", () => {
  it("兼容反斜杠与正斜杠", () => {
    expect(windowsBasename("C:\\Tools\\sub\\tool.exe")).toBe("tool.exe")
    expect(windowsBasename("C:/Tools/sub/tool.exe")).toBe("tool.exe")
    expect(windowsBasename("C:\\Tools\\sub\\")).toBe("sub")
    expect(windowsBasename("")).toBe("")
  })

  it("取目录", () => {
    expect(windowsDirname("C:\\Tools\\sub\\tool.exe")).toBe("C:\\Tools\\sub")
    expect(windowsDirname("C:/Tools/sub/tool.exe")).toBe("C:/Tools/sub")
    // 目录形式（尾部带分隔符）取的是其父目录
    expect(windowsDirname("C:\\Tools\\sub\\")).toBe("C:\\Tools")
    expect(windowsDirname("tool.exe")).toBe("")
  })

  it("默认工作目录为 exe 所在目录", () => {
    expect(defaultWorkingDir("C:\\Tools\\tool.exe")).toBe("C:\\Tools")
  })
})

describe("normalizeTargetPath", () => {
  it("去引号、统一反斜杠", () => {
    expect(normalizeTargetPath("\"C:\\Tools\\tool.exe\"")).toBe("C:\\Tools\\tool.exe")
    expect(normalizeTargetPath("  C:/Tools/tool.exe  ")).toBe("C:\\Tools\\tool.exe")
    expect(normalizeTargetPath("'C:\\Tools\\tool.exe'")).toBe("C:\\Tools\\tool.exe")
  })

  it("保留 UNC / 长路径前缀", () => {
    expect(normalizeTargetPath("\\\\server/share/a.exe")).toBe("\\\\server\\share\\a.exe")
    expect(normalizeTargetPath("\\\\?\\C:/a/b.exe")).toBe("\\\\?\\C:\\a\\b.exe")
  })
})

describe("validateTargetPathInput", () => {
  it("按空 / 相对 / 非 exe / 过长分类", () => {
    expect(validateTargetPathInput("")).toBe("empty")
    expect(validateTargetPathInput("   ")).toBe("empty")
    expect(validateTargetPathInput("tools\\a.exe")).toBe("notAbsolute")
    expect(validateTargetPathInput("C:\\Tools\\a.txt")).toBe("notExe")
    expect(validateTargetPathInput(`C:\\${"a".repeat(1100)}.exe`)).toBe("tooLong")
    expect(validateTargetPathInput("C:\\Tools\\a.EXE")).toBeNull()
  })

  it("引号包裹的合法路径可通过", () => {
    expect(validateTargetPathInput("\"C:\\Program Files\\App\\app.exe\"")).toBeNull()
  })
})

describe("validateWorkingDirInput", () => {
  it("允许为空，其余必须绝对", () => {
    expect(validateWorkingDirInput("")).toBeNull()
    expect(validateWorkingDirInput("  ")).toBeNull()
    expect(validateWorkingDirInput("relative\\dir")).toBe("notAbsolute")
    expect(validateWorkingDirInput("C:\\Tools")).toBeNull()
  })
})

describe("其它", () => {
  it("exe 扩展名大小写不敏感", () => {
    expect(hasExeExtension("a.exe")).toBe(true)
    expect(hasExeExtension("a.EXE")).toBe(true)
    expect(hasExeExtension("a.txt")).toBe(false)
  })

  it("快捷方式位置白名单", () => {
    expect(isShortcutLocation("desktop")).toBe(true)
    expect(isShortcutLocation("programs")).toBe(true)
    expect(isShortcutLocation("custom")).toBe(true)
    expect(isShortcutLocation("startup")).toBe(false)
    expect(isShortcutLocation(null)).toBe(false)
  })
})
