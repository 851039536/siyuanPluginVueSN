import { describe, expect, it } from "vitest"
import {
  createScriptId,
  detectLanguage,
  hasIllegalFileNameChars,
} from "./utils"

describe("detectLanguage", () => {
  it("按扩展名识别主流语言", () => {
    expect(detectLanguage("a.py")).toBe("python")
    expect(detectLanguage("a.sh")).toBe("bash")
    expect(detectLanguage("a.ps1")).toBe("powershell")
    expect(detectLanguage("a.js")).toBe("nodejs")
    expect(detectLanguage("a.bat")).toBe("batch")
  })

  it("识别别名扩展名", () => {
    expect(detectLanguage("a.pyw")).toBe("python")
    expect(detectLanguage("a.bash")).toBe("bash")
    expect(detectLanguage("a.mjs")).toBe("nodejs")
    expect(detectLanguage("a.cmd")).toBe("batch")
  })

  it("大小写不敏感", () => {
    expect(detectLanguage("A.PY")).toBe("python")
    expect(detectLanguage("B.JS")).toBe("nodejs")
  })

  it("未知或无扩展名归为 other", () => {
    expect(detectLanguage("a.txt")).toBe("other")
    expect(detectLanguage("noext")).toBe("other")
  })
})

describe("hasIllegalFileNameChars", () => {
  it("拦截 Windows 非法字符", () => {
    for (const ch of ["\\", "/", ":", "*", "?", '"', "<", ">", "|"]) {
      expect(hasIllegalFileNameChars(`a${ch}b`)).toBe(true)
    }
  })

  it("放行常规名称（含中文、空格、点、连字符）", () => {
    expect(hasIllegalFileNameChars("备份脚本 v2")).toBe(false)
    expect(hasIllegalFileNameChars("build.prod-1")).toBe(false)
  })
})

describe("createScriptId", () => {
  it("带 script- 前缀且多次生成不重复", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createScriptId()))
    expect(ids.size).toBe(1000)
    for (const id of ids) {
      expect(id.startsWith("script-")).toBe(true)
    }
  })
})
