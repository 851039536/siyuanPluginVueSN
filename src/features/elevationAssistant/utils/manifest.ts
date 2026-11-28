/**
 * 提权助手 - PE manifest 纯解析
 *
 * 只依赖 Uint8Array / TextDecoder，不导入 node:fs。
 * 文件读取由 managers/diagnostics.ts 通过 PeReader 适配，便于单测用内存 buffer。
 */
import type {
  DiagnosisReasonCode,
  ElevationRecommendation,
  ManifestLevel,
  ManifestSource,
  PeArch,
} from "../types"

/** PE 文件随机读取接口（异步，避免整文件载入内存） */
export interface PeReader {
  readonly size: number
  read: (offset: number, length: number) => Promise<Uint8Array | null>
}

export interface PeManifestResult {
  manifestXml: string | null
  arch: PeArch
  embedded: boolean
  error?: string
}

export interface ManifestLevelInfo {
  level: ManifestLevel
  uiAccess: boolean
  hasRequestedLevel: boolean
}

export interface ManifestDecision {
  requiresAdmin: boolean
  recommendedElevate: boolean
  recommendation: ElevationRecommendation
  reasonCode: DiagnosisReasonCode
}

const MAX_MANIFEST_SIZE = 1024 * 1024
const MAX_RESOURCE_ENTRIES = 1024
const MAX_SECTIONS = 96
const RESOURCE_TYPE_MANIFEST = 24
const IMAGE_DIRECTORY_ENTRY_RESOURCE = 2

interface PeSection {
  virtualAddress: number
  virtualSize: number
  rawSize: number
  rawPointer: number
}

interface ResourceEntry {
  id: number
  subdir: boolean
  offset: number
}

interface PeHeaders {
  arch: PeArch
  sections: PeSection[]
  resourceRva: number
  resourceSize: number
}

function u16(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function u32(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null
  return (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
  ) >>> 0
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string | null {
  if (offset < 0 || offset + length > bytes.length) return null
  let out = ""
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[offset + i])
  }
  return out
}

async function readExact(reader: PeReader, offset: number, length: number): Promise<Uint8Array | null> {
  if (offset < 0 || length < 0 || offset + length > reader.size) return null
  try {
    const data = await reader.read(offset, length)
    if (!data || data.length !== length) return null
    return data
  } catch {
    return null
  }
}

/** RVA → 文件偏移；映射长度取 virtualSize 与 rawSize 的较小值 */
function mapRvaToOffset(rva: number, sections: readonly PeSection[]): number | null {
  for (const section of sections) {
    const delta = rva - section.virtualAddress
    const span = Math.min(section.virtualSize || section.rawSize, section.rawSize)
    if (delta >= 0 && delta < span) {
      return section.rawPointer + delta
    }
  }
  return null
}

function archFromMachine(machine: number, optionalMagic: number): PeArch {
  if (machine === 0x8664) return "x64"
  if (machine === 0xAA64) return "arm64"
  if (machine === 0x014C) return "x86"
  // 0x01C4 为 ARMNT（ARM32），与 arm64 不是同一架构，不做猜测
  if (machine === 0x01C4) return "unknown"
  if (optionalMagic === 0x20B) return "x64"
  if (optionalMagic === 0x10B) return "x86"
  return "unknown"
}

/**
 * 一次读取 DOS 头、PE 头、可选头与节表。
 * manifest 解析与架构展示共用同一份结果，避免每次诊断重复读 PE 头。
 */
async function readPeHeaders(reader: PeReader): Promise<PeHeaders | null> {
  if (reader.size < 0x40) return null
  const dos = await readExact(reader, 0, 0x40)
  if (!dos) return null
  if (dos[0] !== 0x4D || dos[1] !== 0x5A) return null
  const peOffset = u32(dos, 0x3C)
  if (peOffset === null || peOffset < 0x40 || peOffset + 24 > reader.size) return null

  const peHeader = await readExact(reader, peOffset, 24)
  if (!peHeader) return null
  if (readAscii(peHeader, 0, 4) !== "PE\u0000\u0000") return null
  const machine = u16(peHeader, 4) ?? 0
  const numberOfSections = u16(peHeader, 6) ?? 0
  const sizeOfOptionalHeader = u16(peHeader, 20) ?? 0
  if (numberOfSections <= 0 || numberOfSections > MAX_SECTIONS) return null
  if (sizeOfOptionalHeader < 0x70) return null

  const optionalStart = peOffset + 24
  const optional = await readExact(reader, optionalStart, Math.min(sizeOfOptionalHeader, 0x100))
  if (!optional) return null

  const magic = u16(optional, 0) ?? 0
  const arch = archFromMachine(machine, magic)
  const dataDirectoryOffset = magic === 0x10B ? 96 : magic === 0x20B ? 112 : -1
  const hasDataDirectory = dataDirectoryOffset >= 0 && dataDirectoryOffset + 24 <= optional.length
  const resourceRva = hasDataDirectory
    ? u32(optional, dataDirectoryOffset + IMAGE_DIRECTORY_ENTRY_RESOURCE * 8) ?? 0
    : 0
  const resourceSize = hasDataDirectory
    ? u32(optional, dataDirectoryOffset + IMAGE_DIRECTORY_ENTRY_RESOURCE * 8 + 4) ?? 0
    : 0

  const sectionTableOffset = optionalStart + sizeOfOptionalHeader
  const sectionBytes = await readExact(reader, sectionTableOffset, numberOfSections * 40)
  if (!sectionBytes) { return {
    arch,
    sections: [],
    resourceRva: 0,
    resourceSize: 0,
  }
  }
  const sections: PeSection[] = []
  for (let i = 0; i < numberOfSections; i++) {
    const base = i * 40
    const virtualSize = u32(sectionBytes, base + 8)
    const virtualAddress = u32(sectionBytes, base + 12)
    const rawSize = u32(sectionBytes, base + 16)
    const rawPointer = u32(sectionBytes, base + 20)
    if (virtualSize === null || virtualAddress === null || rawSize === null || rawPointer === null) {
      return {
        arch,
        sections: [],
        resourceRva: 0,
        resourceSize: 0,
      }
    }
    sections.push({
      virtualAddress,
      virtualSize,
      rawSize,
      rawPointer,
    })
  }

  return {
    arch,
    sections,
    resourceRva,
    resourceSize,
  }
}

async function readResourceEntries(
  reader: PeReader,
  resourceBase: number,
  relativeOffset: number,
): Promise<ResourceEntry[] | null> {
  const header = await readExact(reader, resourceBase + relativeOffset, 16)
  if (!header) return null
  const named = u16(header, 12) ?? 0
  const ids = u16(header, 14) ?? 0
  const total = named + ids
  if (total <= 0 || total > MAX_RESOURCE_ENTRIES) return null

  const table = await readExact(reader, resourceBase + relativeOffset + 16, total * 8)
  if (!table) return null

  const entries: ResourceEntry[] = []
  for (let i = 0; i < total; i++) {
    const base = i * 8
    const nameValue = u32(table, base)
    const offsetValue = u32(table, base + 4)
    if (nameValue === null || offsetValue === null) return null
    // 高位置 1 表示该字段是字符串，资源类型 24 与名称 1 都是数字项
    const subdir = (offsetValue & 0x80000000) !== 0
    const id = (nameValue & 0xFFFF) >>> 0
    entries.push({
      id,
      subdir,
      offset: offsetValue & 0x7FFFFFFF,
    })
  }
  return entries
}

/** 从已解析的 PE 头读取 RT_MANIFEST（类型 24、名称 1 或首个名称项） */
async function readEmbeddedManifest(reader: PeReader, headers: PeHeaders): Promise<string | null> {
  if (!headers.resourceRva || !headers.resourceSize || headers.sections.length === 0) return null
  const resourceBase = mapRvaToOffset(headers.resourceRva, headers.sections)
  if (resourceBase === null) return null

  const rootEntries = await readResourceEntries(reader, resourceBase, 0)
  if (!rootEntries) return null
  const typeEntry = rootEntries.find((entry) => entry.id === RESOURCE_TYPE_MANIFEST && entry.subdir)
  if (!typeEntry) return null

  const nameEntries = await readResourceEntries(reader, resourceBase, typeEntry.offset)
  if (!nameEntries) return null
  const nameEntry = nameEntries.find((entry) => entry.id === 1 && entry.subdir)
    ?? nameEntries.find((entry) => entry.subdir)
  if (!nameEntry) return null

  const languageEntries = await readResourceEntries(reader, resourceBase, nameEntry.offset)
  if (!languageEntries) return null
  const leaf = languageEntries.find((entry) => !entry.subdir)
  if (!leaf) return null

  const dataEntry = await readExact(reader, resourceBase + leaf.offset, 16)
  if (!dataEntry) return null
  const dataRva = u32(dataEntry, 0)
  const dataSize = u32(dataEntry, 4)
  if (dataRva === null || dataSize === null || dataSize <= 0 || dataSize > MAX_MANIFEST_SIZE) {
    return null
  }
  const dataOffset = mapRvaToOffset(dataRva, headers.sections)
  if (dataOffset === null) return null
  const manifestBytes = await readExact(reader, dataOffset, dataSize)
  if (!manifestBytes) return null
  return decodeManifestBytes(manifestBytes)
}

/** 解码 manifest 字节（UTF-8 / UTF-16LE，带或不带 BOM） */
export function decodeManifestBytes(bytes: Uint8Array): string {
  if (bytes.length === 0) return ""
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2))
  }
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3))
  }
  // 无 BOM 的 UTF-16LE 常见特征是奇数位为 0
  if (bytes.length > 3 && bytes[0] !== 0 && bytes[1] === 0) {
    return new TextDecoder("utf-16le").decode(bytes)
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder("utf-16le").decode(bytes)
  }
}

/** 解析 manifest 的 requestedExecutionLevel / uiAccess */
export function parseManifestLevel(xml: string): ManifestLevelInfo {
  const hasRequestedLevel = /requestedExecutionLevel\b/i.test(xml)
  const levelMatch = /requestedExecutionLevel\b[^>]*\blevel\s*=\s*["']([^"']+)["']/i.exec(xml)
  const rawLevel = levelMatch?.[1]?.trim().toLowerCase()
  let level: ManifestLevel = "asInvoker"
  if (rawLevel === "requireadministrator") {
    level = "requireAdministrator"
  } else if (rawLevel === "highestavailable") {
    level = "highestAvailable"
  } else if (rawLevel === "asinvoker") {
    level = "asInvoker"
  } else if (rawLevel) {
    level = "unknown"
  } else if (hasRequestedLevel) {
    // 声明了 requestedExecutionLevel 却没有可识别的 level：不能当作 asInvoker
    level = "unknown"
  }
  const uiAccess = /\buiAccess\s*=\s*["']true["']/i.test(xml)
  return {
    level,
    uiAccess,
    hasRequestedLevel,
  }
}

/** 根据 manifest 结论生成推荐结果 */
export function recommendFromManifest(input: {
  level: ManifestLevel
  source: ManifestSource
  uiAccess: boolean
}): ManifestDecision {
  const {
    level,
    source,
    uiAccess,
  } = input

  if (source === "unreadable") {
    return {
      requiresAdmin: false,
      recommendedElevate: false,
      recommendation: "unknown",
      reasonCode: "readError",
    }
  }

  if (level === "unknown") {
    return {
      requiresAdmin: false,
      recommendedElevate: false,
      recommendation: "unknown",
      reasonCode: "parseError",
    }
  }

  if (level === "requireAdministrator") {
    return {
      requiresAdmin: true,
      recommendedElevate: true,
      recommendation: "required",
      reasonCode: "manifestRequireAdministrator",
    }
  }

  if (level === "highestAvailable") {
    return {
      requiresAdmin: false,
      recommendedElevate: true,
      recommendation: "recommended",
      reasonCode: "manifestHighestAvailable",
    }
  }

  if (uiAccess) {
    return {
      requiresAdmin: false,
      recommendedElevate: true,
      recommendation: "recommended",
      reasonCode: "manifestUiAccess",
    }
  }

  if (source === "none") {
    return {
      requiresAdmin: false,
      recommendedElevate: false,
      recommendation: "notRequired",
      reasonCode: "manifestMissing",
    }
  }

  return {
    requiresAdmin: false,
    recommendedElevate: false,
    recommendation: "notRequired",
    reasonCode: "manifestAsInvoker",
  }
}

/** 读取 PE manifest；失败返回 error，不抛异常 */
export async function readPeManifest(reader: PeReader): Promise<PeManifestResult> {
  try {
    const headers = await readPeHeaders(reader)
    if (!headers) {
      return {
        manifestXml: null,
        arch: "unknown",
        embedded: false,
      }
    }
    const xml = await readEmbeddedManifest(reader, headers)
    return {
      manifestXml: xml,
      arch: headers.arch,
      embedded: xml !== null,
    }
  } catch (error) {
    return {
      manifestXml: null,
      arch: "unknown",
      embedded: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
