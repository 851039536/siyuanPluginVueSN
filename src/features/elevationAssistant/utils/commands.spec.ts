import {
  describe,
  expect,
  it,
} from "vitest"
import {
  buildCreateShortcutScript,
  buildRunElevatedScript,
  buildScanProgramsScript,
  encodePowerShellCommand,
  encodeUtf8Base64,
  isUacCanceled,
  mapIntegritySid,
  parsePowerShellJson,
  parseWhoamiGroups,
  utf16leBytes,
} from "./commands"

function decodeBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"))
}

function decodeUtf16le(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8))
  }
  return out
}

describe("utf16leBytes / encodePowerShellCommand", () => {
  it("-EncodedCommand 使用 UTF-16LE Base64 且可还原", () => {
    const script = "Write-Output 'hello 中文'"
    const encoded = encodePowerShellCommand(script)
    const restored = decodeUtf16le(decodeBase64(encoded))
    expect(restored).toBe(script)
  })

  it("奇数位为 0（UTF-16LE 特征）", () => {
    const bytes = utf16leBytes("AB")
    expect(Array.from(bytes)).toEqual([0x41, 0x00, 0x42, 0x00])
  })

  it("uTF-8 Base64 往返", () => {
    const text = "{\"路径\":\"C:\\\\工具\\\\a.exe\"}"
    const restored = new TextDecoder("utf-8").decode(decodeBase64(encodeUtf8Base64(text)))
    expect(restored).toBe(text)
  })
})

describe("脚本构建不拼接用户输入", () => {
  it("创建快捷方式脚本只含 Base64 参数", () => {
    const malicious = "C:\\a\"; Remove-Item C:\\ -Recurse; \"b.exe"
    const script = buildCreateShortcutScript({
      fileName: "tool",
      targetPath: malicious,
      args: "'$(evil)",
      workingDir: "C:\\a b",
      location: "desktop",
      customDir: "",
      runAsAdmin: true,
      overwrite: false,
    })
    expect(script).not.toContain("Remove-Item C:")
    expect(script).not.toContain(malicious)
    expect(script).toContain("FromBase64String")
    expect(script).toContain("ConvertFrom-Json")
    const encoded = /FromBase64String\('([^']+)'\)/.exec(script)?.[1] || ""
    const payload = JSON.parse(
      new TextDecoder("utf-8").decode(decodeBase64(encoded)),
    ) as Record<string, unknown>
    expect(payload.targetPath).toBe(malicious)
    expect(payload.runAsAdmin).toBe(true)
  })

  it("提权运行脚本同样只含 Base64 参数", () => {
    const script = buildRunElevatedScript("C:\\Tools\\app.exe", "--x", "C:\\Tools")
    expect(script).toContain("RunAs")
    expect(script).not.toContain("C:\\Tools\\app.exe")
  })
})

describe("buildScanProgramsScript", () => {
  it("覆盖四类来源且只通过 Base64 载荷传参", () => {
    const script = buildScanProgramsScript()
    expect(script).toContain("FromBase64String")
    expect(script).toContain("'startMenu'")
    expect(script).toContain("App Paths")
    expect(script).toContain("Get-Process")
    expect(script).toContain("CreateShortcut")
    expect(script).toContain("ConvertTo-Json -Compress -Depth 4")
    // 不在脚本里启动目标程序
    expect(script).not.toContain("Start-Process")
    expect(script).not.toContain("Invoke-Item")
  })
})

describe("parsePowerShellJson", () => {
  it("解析正常 JSON、去 BOM、容忍前后噪声", () => {
    expect(parsePowerShellJson("{\"ok\":true}")).toEqual({ ok: true })
    expect(parsePowerShellJson("\uFEFF {\"ok\":true} \r\n")).toEqual({ ok: true })
    expect(parsePowerShellJson("noise {\"ok\":true} tail")).toEqual({ ok: true })
  })

  it("空输出与非法 JSON 返回 null", () => {
    expect(parsePowerShellJson("")).toBeNull()
    expect(parsePowerShellJson("   ")).toBeNull()
    expect(parsePowerShellJson("not json")).toBeNull()
    expect(parsePowerShellJson("{broken")).toBeNull()
  })
})

describe("mapIntegritySid", () => {
  it("映射常见完整性级别", () => {
    expect(mapIntegritySid("S-1-16-4096")).toBe("low")
    expect(mapIntegritySid("S-1-16-8192")).toBe("medium")
    expect(mapIntegritySid("S-1-16-8448")).toBe("mediumPlus")
    expect(mapIntegritySid("S-1-16-12288")).toBe("high")
    expect(mapIntegritySid("S-1-16-16384")).toBe("system")
    expect(mapIntegritySid("S-1-16-20480")).toBe("protected")
  })

  it("未知 / 空值返回 unknown", () => {
    expect(mapIntegritySid("S-1-16-99999")).toBe("unknown")
    expect(mapIntegritySid("S-1-5-21-1")).toBe("unknown")
    expect(mapIntegritySid(null)).toBe("unknown")
    expect(mapIntegritySid(undefined)).toBe("unknown")
  })
})

describe("parseWhoamiGroups", () => {
  it("从 whoami /groups 文本提取完整性 SID", () => {
    const text = [
      "组信息",
      "------------------",
      "Mandatory Label\\High Mandatory Level  Label  S-1-16-12288",
    ].join("\n")
    expect(parseWhoamiGroups(text)).toBe("S-1-16-12288")
  })

  it("无匹配返回 null", () => {
    expect(parseWhoamiGroups("nothing here")).toBeNull()
  })
})

describe("isUacCanceled", () => {
  it("识别 1223 / 0x800704C7 / 文案", () => {
    expect(isUacCanceled({ code: 1223 })).toBe(true)
    // 0x800704C7 的低 16 位即 1223
    expect(isUacCanceled({ code: "0x800704C7" })).toBe(true)
    expect(isUacCanceled({
      code: null,
      message: "The operation was canceled by the user.",
    })).toBe(true)
    expect(isUacCanceled({
      code: null,
      message: "操作已被用户取消",
    })).toBe(true)
    expect(isUacCanceled({
      code: 0,
      message: "Access is denied",
    })).toBe(false)
  })
})
