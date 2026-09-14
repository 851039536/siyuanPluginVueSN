/**
 * 快捷键模块 - 导入导出纯逻辑
 * 与存储、UI 完全解耦：只需传入数据与文件文本，返回结构化结果
 */
import type {
  ShortcutExportPayload,
  ShortcutImportResult,
  ShortcutInfo,
  ShortcutMergeResult,
} from "./types"
import {
  EXPORT_PAYLOAD_TYPE,
  EXPORT_PAYLOAD_VERSION,
} from "./types"
import { sanitizeShortcutArray } from "./utils"

/** 导入失败原因：文件不是合法 JSON */
export const IMPORT_ERROR_INVALID_JSON = "invalidJson"
/** 导入失败原因：JSON 结构中没有快捷键数组 */
export const IMPORT_ERROR_INVALID_STRUCTURE = "invalidStructure"

/**
 * 构建导出载荷（仅自定义项，预置来自代码无需导出）
 */
export function buildExportPayload(
  custom: ShortcutInfo[],
  now: Date = new Date(),
): ShortcutExportPayload {
  return {
    type: EXPORT_PAYLOAD_TYPE,
    version: EXPORT_PAYLOAD_VERSION,
    exportedAt: now.toISOString(),
    shortcuts: sanitizeShortcutArray(custom, true),
  }
}

/**
 * 序列化为下载文本（带缩进便于人工查看与手工编辑）
 */
export function serializeExport(payload: ShortcutExportPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`
}

/**
 * 构建导出文件名（含日期，避免多次导出互相覆盖）
 */
export function buildExportFileName(now: Date = new Date()): string {
  const date = now.toISOString().slice(0, 10)
  return `shortcuts-${date}.json`
}

/**
 * 解析导入文本：
 * - 支持本模块导出的载荷结构，也兼容「裸数组」形式（容错）
 * - 字段非法条目与「id 与预置冲突」的条目一律剔除并计数
 */
export function parseImportPayload(
  text: string,
  presetIds: ReadonlySet<string>,
): ShortcutImportResult {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return { ok: false, error: IMPORT_ERROR_INVALID_JSON, items: [], ignored: 0 }
  }

  const rawList = Array.isArray(payload)
    ? payload
    : (payload as { shortcuts?: unknown } | null)?.shortcuts

  if (!Array.isArray(rawList)) {
    return { ok: false, error: IMPORT_ERROR_INVALID_STRUCTURE, items: [], ignored: 0 }
  }

  const sanitized = sanitizeShortcutArray(rawList, true)
  const items = sanitized.filter((item) => !presetIds.has(item.id))

  return {
    ok: true,
    items,
    ignored: rawList.length - sanitized.length + (sanitized.length - items.length),
  }
}

/**
 * 合并导入项：同 id 覆盖，新 id 追加
 */
export function mergeImport(
  current: ShortcutInfo[],
  incoming: ShortcutInfo[],
): ShortcutMergeResult {
  const next = [...current]
  const indexById = new Map(next.map((item, index) => [item.id, index]))
  let added = 0
  let updated = 0

  for (const item of incoming) {
    const index = indexById.get(item.id)
    if (index === undefined) {
      indexById.set(item.id, next.length)
      next.push(item)
      added += 1
    } else {
      next[index] = item
      updated += 1
    }
  }

  return { next, added, updated }
}
