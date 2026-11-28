import type { PeReader } from "./manifest"
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  decodeManifestBytes,
  parseManifestLevel,
  readPeManifest,
  recommendFromManifest,
} from "./manifest"

/** 把内存 buffer 适配成 PeReader（仅测试使用） */
function createBufferPeReader(buffer: Uint8Array): PeReader {
  return {
    size: buffer.length,
    read: async (offset, length) => {
      if (offset < 0 || length < 0 || offset + length > buffer.length) return null
      return buffer.subarray(offset, offset + length)
    },
  }
}

const MANIFEST_REQUIRE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>`

const MANIFEST_HIGHEST = `<assembly><trustInfo><security><requestedPrivileges>
  <requestedExecutionLevel uiAccess="true" level="highestAvailable"/>
</requestedPrivileges></security></trustInfo></assembly>`

interface PeOptions {
  magic?: number
  machine?: number
  manifest?: string | null
  manifestEncoding?: "utf8" | "utf8bom" | "utf16le" | "utf16bom"
}

function writeU16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xFF
  bytes[offset + 1] = (value >> 8) & 0xFF
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xFF
  bytes[offset + 1] = (value >>> 8) & 0xFF
  bytes[offset + 2] = (value >>> 16) & 0xFF
  bytes[offset + 3] = (value >>> 24) & 0xFF
}

function encodeText(text: string, encoding: PeOptions["manifestEncoding"]): Uint8Array {
  switch (encoding) {
    case "utf8bom": {
      const body = new TextEncoder().encode(text)
      const out = new Uint8Array(body.length + 3)
      out.set([0xEF, 0xBB, 0xBF], 0)
      out.set(body, 3)
      return out
    }
    case "utf16le":
    case "utf16bom": {
      const body = encodeUtf16le(text)
      if (encoding === "utf16le") return body
      const out = new Uint8Array(body.length + 2)
      out.set([0xFF, 0xFE], 0)
      out.set(body, 2)
      return out
    }
    default:
      return new TextEncoder().encode(text)
  }
}

function encodeUtf16le(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    out[i * 2] = code & 0xFF
    out[i * 2 + 1] = (code >> 8) & 0xFF
  }
  return out
}

/**
 * 构造最小可解析 PE：
 * DOS 头(0x40) → PE 头(0x80) → Optional Header → 1 个节 → 资源节(RVA 0x1000 / 文件偏移 0x200)
 */
function buildPe(options: PeOptions = {}): Uint8Array {
  const magic = options.magic ?? 0x20B
  const machine = options.machine ?? 0x8664
  const isPe32Plus = magic === 0x20B
  const optionalSize = isPe32Plus ? 0xF0 : 0xE0
  const rawPointer = 0x200
  const rawSize = 0x1000
  const total = rawPointer + rawSize
  const bytes = new Uint8Array(total)

  // DOS 头
  bytes[0] = 0x4D
  bytes[1] = 0x5A
  writeU32(bytes, 0x3C, 0x80)

  // PE 签名 + COFF 头
  bytes.set([0x50, 0x45, 0x00, 0x00], 0x80)
  writeU16(bytes, 0x80 + 4, machine)
  writeU16(bytes, 0x80 + 6, 1) // NumberOfSections
  writeU16(bytes, 0x80 + 20, optionalSize)

  // Optional Header
  const optionalAt = 0x80 + 24
  writeU16(bytes, optionalAt, magic)
  const dataDirectoryAt = optionalAt + (isPe32Plus ? 112 : 96)

  const manifest = options.manifest === null ? null : (options.manifest ?? MANIFEST_REQUIRE)
  if (manifest !== null) {
    // 资源目录 RVA
    writeU32(bytes, dataDirectoryAt + 2 * 8, 0x1000)
    writeU32(bytes, dataDirectoryAt + 2 * 8 + 4, 0x400)
  }

  // 节表
  const sectionAt = optionalAt + optionalSize
  writeU32(bytes, sectionAt + 8, 0x1000) // VirtualSize
  writeU32(bytes, sectionAt + 12, 0x1000) // VirtualAddress
  writeU32(bytes, sectionAt + 16, rawSize)
  writeU32(bytes, sectionAt + 20, rawPointer)

  if (manifest === null) return bytes

  const data = encodeText(manifest, options.manifestEncoding ?? "utf8")
  const R = rawPointer

  // root 目录：16 字节头 + 1 条目（类型 24 → 子目录 0x18）
  writeU16(bytes, R + 12, 0)
  writeU16(bytes, R + 14, 1)
  writeU32(bytes, R + 16, 24)
  writeU32(bytes, R + 20, 0x80000018)

  // 类型目录（R+0x18）：名称 1 → 子目录 0x30
  writeU16(bytes, R + 0x18 + 12, 0)
  writeU16(bytes, R + 0x18 + 14, 1)
  writeU32(bytes, R + 0x28, 1)
  writeU32(bytes, R + 0x2C, 0x80000030)

  // 语言目录（R+0x30）：语言 0x409 → 数据项 0x48
  writeU16(bytes, R + 0x30 + 12, 0)
  writeU16(bytes, R + 0x30 + 14, 1)
  writeU32(bytes, R + 0x40, 0x409)
  writeU32(bytes, R + 0x44, 0x48)

  // 数据项
  writeU32(bytes, R + 0x48, 0x1000 + 0x60)
  writeU32(bytes, R + 0x4C, data.length)

  // manifest 数据
  bytes.set(data, R + 0x60)
  return bytes
}

describe("parseManifestLevel", () => {
  it("识别三种执行级别", () => {
    expect(parseManifestLevel(MANIFEST_REQUIRE).level).toBe("requireAdministrator")
    expect(parseManifestLevel(MANIFEST_HIGHEST).level).toBe("highestAvailable")
    expect(parseManifestLevel("<requestedExecutionLevel level=\"asInvoker\"/>").level).toBe("asInvoker")
  })

  it("属性顺序无关、单引号可用、大小写不敏感", () => {
    const xml = "<requestedExecutionLevel uiAccess='true' level='REQUIREADMINISTRATOR'/>"
    const info = parseManifestLevel(xml)
    expect(info.level).toBe("requireAdministrator")
    expect(info.uiAccess).toBe(true)
  })

  it("缺失 level 时：无标签默认 asInvoker，有标签却缺 level 判为 unknown", () => {
    expect(parseManifestLevel(MANIFEST_REQUIRE).hasRequestedLevel).toBe(true)
    const empty = parseManifestLevel("<assembly></assembly>")
    expect(empty.level).toBe("asInvoker")
    expect(empty.hasRequestedLevel).toBe(false)
    expect(empty.uiAccess).toBe(false)
    // 声明了 requestedExecutionLevel 但没有 level：不能当作无需管理员
    expect(parseManifestLevel("<requestedExecutionLevel uiAccess=\"false\"/>").level).toBe("unknown")
  })
})

describe("recommendFromManifest", () => {
  it("requireAdministrator 必须管理员", () => {
    const result = recommendFromManifest({
      level: "requireAdministrator",
      source: "embedded",
      uiAccess: false,
    })
    expect(result.requiresAdmin).toBe(true)
    expect(result.recommendedElevate).toBe(true)
    expect(result.recommendation).toBe("required")
  })

  it("highestAvailable 建议管理员", () => {
    const result = recommendFromManifest({
      level: "highestAvailable",
      source: "embedded",
      uiAccess: false,
    })
    expect(result.requiresAdmin).toBe(false)
    expect(result.recommendation).toBe("recommended")
  })

  it("uiAccess 建议提权", () => {
    const result = recommendFromManifest({
      level: "asInvoker",
      source: "embedded",
      uiAccess: true,
    })
    expect(result.recommendation).toBe("recommended")
    expect(result.reasonCode).toBe("manifestUiAccess")
  })

  it("无清单/asInvoker 无需管理员", () => {
    expect(recommendFromManifest({
      level: "asInvoker",
      source: "none",
      uiAccess: false,
    }).reasonCode).toBe("manifestMissing")
    expect(recommendFromManifest({
      level: "asInvoker",
      source: "embedded",
      uiAccess: false,
    }).recommendation).toBe("notRequired")
  })
})

describe("decodeManifestBytes", () => {
  it("解码 UTF-8 BOM / 无 BOM / UTF-16LE BOM", () => {
    const text = "<assembly>提权</assembly>"
    expect(decodeManifestBytes(encodeText(text, "utf8bom"))).toContain("提权")
    expect(decodeManifestBytes(encodeText(text, "utf8"))).toContain("提权")
    expect(decodeManifestBytes(encodeText(text, "utf16bom"))).toContain("提权")
  })
})

describe("readPeManifest", () => {
  it("pE32+ 内嵌清单：返回 x64 与 XML", async () => {
    const result = await readPeManifest(createBufferPeReader(buildPe()))
    expect(result.arch).toBe("x64")
    expect(result.embedded).toBe(true)
    expect(result.manifestXml).toContain("requireAdministrator")
  })

  it("pE32 内嵌清单：返回 x86", async () => {
    const result = await readPeManifest(createBufferPeReader(buildPe({
      magic: 0x10B,
      machine: 0x014C,
    })))
    expect(result.arch).toBe("x86")
    expect(result.embedded).toBe(true)
  })

  it("arm64 通过 Machine 识别", async () => {
    const result = await readPeManifest(createBufferPeReader(buildPe({ machine: 0xAA64 })))
    expect(result.arch).toBe("arm64")
  })

  it("aRMNT（0x01C4）不映射为 arm64", async () => {
    const result = await readPeManifest(createBufferPeReader(buildPe({ machine: 0x01C4 })))
    expect(result.arch).toBe("unknown")
  })

  it("无资源目录时返回无清单但仍有架构", async () => {
    const result = await readPeManifest(createBufferPeReader(buildPe({ manifest: null })))
    expect(result.manifestXml).toBeNull()
    expect(result.embedded).toBe(false)
    expect(result.arch).toBe("x64")
  })

  it("非 PE / 截断数据不抛错", async () => {
    const garbage = new Uint8Array(64)
    const result = await readPeManifest(createBufferPeReader(garbage))
    expect(result.manifestXml).toBeNull()
    expect(result.arch).toBe("unknown")

    const truncated = buildPe().subarray(0, 0x90)
    const truncatedResult = await readPeManifest(createBufferPeReader(truncated))
    expect(truncatedResult.manifestXml).toBeNull()
  })

  it("uTF-16LE BOM 清单可解析出级别", async () => {
    const bytes = buildPe({ manifestEncoding: "utf16bom" })
    const result = await readPeManifest(createBufferPeReader(bytes))
    expect(result.manifestXml).toContain("requestedExecutionLevel")
    expect(parseManifestLevel(result.manifestXml || "").level).toBe("requireAdministrator")
  })

  it("读取越界时 reader 返回 null 而非抛错", async () => {
    const reader = createBufferPeReader(new Uint8Array(16))
    expect(await reader.read(-1, 4)).toBeNull()
    expect(await reader.read(8, 100)).toBeNull()
  })
})
