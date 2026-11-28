import type { PermissionDiagnosis } from "../types"
/**
 * 提权助手 - 目标文件权限诊断
 *
 * 读取 PE 资源中的 manifest 并给出是否需要/建议提权的结论；
 * 不执行目标程序，不改动目标文件。
 */
import type { PeReader } from "../utils/manifest"
import { getNodeModules } from "@/utils/nodeModules"
import {
  decodeManifestBytes,
  parseManifestLevel,
  readPeManifest,
  recommendFromManifest,
} from "../utils/manifest"

const MAX_EXTERNAL_MANIFEST_SIZE = 1024 * 1024

function emptyDiagnosis(partial: Partial<PermissionDiagnosis>): PermissionDiagnosis {
  return {
    checkedAt: Date.now(),
    exists: false,
    kind: "error",
    arch: "unknown",
    size: 0,
    manifestSource: "unreadable",
    manifestLevel: "unknown",
    uiAccess: false,
    requiresAdmin: false,
    recommendedElevate: false,
    recommendation: "unknown",
    reasonCode: "readError",
    ...partial,
  }
}

/** 诊断过程中出现非预期异常时的兜底结果（不抛错给 UI） */
export function createFailedDiagnosis(error?: unknown): PermissionDiagnosis {
  return emptyDiagnosis({
    kind: "error",
    manifestSource: "unreadable",
    reasonCode: "readError",
    error: error === undefined
      ? undefined
      : (error instanceof Error ? error.message : String(error)),
  })
}

function createFileReader(
  handle: { read: (buffer: Buffer, offset: number, length: number, position: number) => Promise<{ bytesRead: number }> },
  size: number,
): PeReader {
  return {
    size,
    read: async (offset, length) => {
      if (offset < 0 || length < 0 || offset + length > size) return null
      const buffer = Buffer.alloc(length)
      const result = await handle.read(buffer, 0, length, offset)
      if (result.bytesRead <= 0) return null
      return buffer.subarray(0, result.bytesRead)
    },
  }
}

async function readExternalManifest(
  fs: NonNullable<ReturnType<typeof getNodeModules>>["fs"],
  targetPath: string,
): Promise<string | null> {
  const manifestPath = `${targetPath}.manifest`
  try {
    const stat = await fs.promises.stat(manifestPath)
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_EXTERNAL_MANIFEST_SIZE) return null
    const bytes = await fs.promises.readFile(manifestPath)
    return decodeManifestBytes(bytes)
  } catch {
    return null
  }
}

/** 诊断一个 exe 的 manifest 与提权建议 */
export async function diagnoseExecutable(targetPath: string): Promise<PermissionDiagnosis> {
  const node = getNodeModules()
  if (!node) {
    return emptyDiagnosis({
      kind: "error",
      reasonCode: "readError",
      error: "Node.js fs/path modules are unavailable",
    })
  }

  const {
    fs,
    path,
  } = node
  const ext = path.extname(targetPath).toLowerCase()

  let stat: Awaited<ReturnType<typeof fs.promises.stat>>
  try {
    stat = await fs.promises.stat(targetPath)
  } catch (error) {
    return emptyDiagnosis({
      kind: "missing",
      error: error instanceof Error ? error.message : String(error),
    })
  }

  if (!stat.isFile()) {
    return emptyDiagnosis({
      exists: true,
      kind: "error",
      size: stat.size,
      error: "Target is not a file",
    })
  }

  if (ext !== ".exe") {
    return emptyDiagnosis({
      exists: true,
      kind: "other",
      size: stat.size,
      reasonCode: "unsupportedFile",
      error: "Only .exe files are supported",
    })
  }

  let peResult: Awaited<ReturnType<typeof readPeManifest>> | null = null
  let readError: string | undefined
  try {
    const handle = await fs.promises.open(targetPath, "r")
    try {
      const reader = createFileReader(handle, stat.size)
      peResult = await readPeManifest(reader)
    } finally {
      await handle.close().catch(() => undefined)
    }
  } catch (error) {
    readError = error instanceof Error ? error.message : String(error)
  }

  let xml = peResult?.manifestXml ?? null
  let source: PermissionDiagnosis["manifestSource"] = peResult?.embedded ? "embedded" : "none"

  if (!xml) {
    const external = await readExternalManifest(fs, targetPath)
    if (external) {
      xml = external
      source = "external"
    }
  }

  if (!xml) {
    const failed = peResult?.error || readError
    if (failed) {
      return emptyDiagnosis({
        exists: true,
        kind: "exe",
        arch: peResult?.arch ?? "unknown",
        size: stat.size,
        manifestSource: "unreadable",
        reasonCode: "parseError",
        error: failed,
      })
    }
    const decision = recommendFromManifest({
      level: "asInvoker",
      source: "none",
      uiAccess: false,
    })
    return {
      checkedAt: Date.now(),
      exists: true,
      kind: "exe",
      arch: peResult?.arch ?? "unknown",
      size: stat.size,
      manifestSource: "none",
      manifestLevel: "asInvoker",
      uiAccess: false,
      ...decision,
    }
  }

  const levelInfo = parseManifestLevel(xml)
  const decision = recommendFromManifest({
    level: levelInfo.level,
    source,
    uiAccess: levelInfo.uiAccess,
  })

  return {
    checkedAt: Date.now(),
    exists: true,
    kind: "exe",
    arch: peResult?.arch ?? "unknown",
    size: stat.size,
    manifestSource: source,
    manifestLevel: levelInfo.level,
    uiAccess: levelInfo.uiAccess,
    ...decision,
  }
}
