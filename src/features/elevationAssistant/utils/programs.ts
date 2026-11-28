/**
 * 提权助手 - 本机程序扫描结果清洗与合并（纯函数）
 *
 * PowerShell 扫描结果属于外部输入：路径必须绝对且为 .exe，来源必须白名单，
 * 其余字段只作为展示线索，不作为写盘依据。
 */
import type {
  ProgramCandidate,
  ProgramScanOutcome,
  ProgramScanSource,
} from "../types"
import {
  sanitizeShortcutName,
  suggestToolName,
} from "./shortcut"
import {
  hasExeExtension,
  isAbsoluteWindowsPath,
  normalizeTargetPath,
  windowsBasename,
} from "./validation"

/** JS 侧最多接受的扫描结果数 */
export const MAX_SCANNED_PROGRAMS = 500
/** 脚本内上限（比 JS 侧宽，保证截断由 JS 统一处理） */
export const MAX_SCANNED_PROGRAMS_SCRIPT = 800
/** warnings 最多保留条数（避免异常脚本刷屏） */
const MAX_WARNINGS = 20

/** 来源优先级：数值越小越可信，同一路径保留优先级最高的来源 */
const SOURCE_PRIORITY: Record<ProgramScanSource, number> = {
  startMenu: 0,
  desktop: 1,
  appPaths: 2,
  process: 3,
}

function isScanSource(value: unknown): value is ProgramScanSource {
  return value === "startMenu"
    || value === "desktop"
    || value === "appPaths"
    || value === "process"
}

/** 去掉快捷方式常见的“ - 快捷方式 / - Shortcut”后缀 */
function cleanProgramName(value: string): string {
  return value.trim().replace(/\s*[-–—]\s*(?:快捷方式|shortcut)$/i, "").trim()
}

/** 清洗单条扫描结果；路径不合法时丢弃 */
export function sanitizeProgramCandidate(raw: unknown): ProgramCandidate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  const path = typeof source.path === "string" ? normalizeTargetPath(source.path) : ""
  if (!path || !isAbsoluteWindowsPath(path) || !hasExeExtension(path)) return null
  if (!isScanSource(source.source)) return null

  const rawName = typeof source.name === "string" ? cleanProgramName(source.name) : ""
  const baseName = windowsBasename(path).replace(/\.exe$/i, "").trim()
  return {
    name: sanitizeShortcutName(rawName || baseName, baseName || "shortcut"),
    path,
    source: source.source,
  }
}

/** 兼容数组或 `{ programs, truncated, warnings }` 的脚本输出 */
export function normalizeProgramScanPayload(data: unknown): ProgramScanOutcome {
  const record = data && typeof data === "object" && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(record?.programs) ? record.programs as unknown[] : null
  if (!rawList) {
    return {
      ok: true,
      programs: [],
      truncated: false,
      warnings: [],
    }
  }

  const warnings = Array.isArray(record?.warnings)
    ? (record.warnings as unknown[])
        .filter((item): item is string => typeof item === "string")
        .slice(0, MAX_WARNINGS)
    : []
  const sanitized: ProgramCandidate[] = []
  for (const item of rawList) {
    const candidate = sanitizeProgramCandidate(item)
    if (candidate) sanitized.push(candidate)
  }
  const merged = mergeProgramCandidates(sanitized)
  return {
    ok: true,
    programs: merged.slice(0, MAX_SCANNED_PROGRAMS),
    truncated: record?.truncated === true
      || rawList.length > MAX_SCANNED_PROGRAMS
      || merged.length > MAX_SCANNED_PROGRAMS,
    warnings,
  }
}

/** 按路径去重；同路径保留来源优先级更高、名称更完整的一条 */
export function mergeProgramCandidates(items: readonly ProgramCandidate[]): ProgramCandidate[] {
  const byPath = new Map<string, ProgramCandidate>()
  for (const item of items) {
    const key = item.path.toLowerCase()
    const existing = byPath.get(key)
    if (!existing) {
      byPath.set(key, { ...item })
      continue
    }
    const merged = { ...existing }
    if (SOURCE_PRIORITY[item.source] < SOURCE_PRIORITY[existing.source]) {
      merged.source = item.source
    }
    if (!merged.name && item.name) merged.name = item.name
    byPath.set(key, merged)
  }
  return [...byPath.values()]
}

export interface ProgramAdditionPlan {
  accepted: ProgramCandidate[]
  duplicateCount: number
  overflowCount: number
}

/** 计算可添加的候选：去掉已有路径，并按工具上限截断 */
export function planProgramAdditions(
  existingPaths: readonly string[],
  candidates: readonly ProgramCandidate[],
  maxTools: number,
): ProgramAdditionPlan {
  const existing = new Set(existingPaths.map((path) => path.toLowerCase()))
  const unique: ProgramCandidate[] = []
  let duplicateCount = 0
  for (const candidate of mergeProgramCandidates(candidates)) {
    const key = candidate.path.toLowerCase()
    if (existing.has(key)) {
      duplicateCount += 1
      continue
    }
    existing.add(key)
    unique.push(candidate)
  }
  const slots = Math.max(0, maxTools - existingPaths.length)
  const accepted = unique.slice(0, slots)
  return {
    accepted,
    duplicateCount,
    overflowCount: unique.length - accepted.length,
  }
}

/** 工具名称：优先扫描到的名称，其次由 exe 文件名推导 */
export function suggestProgramName(candidate: ProgramCandidate, fallback = "shortcut"): string {
  const name = candidate.name.trim()
  if (name) return sanitizeShortcutName(name, suggestToolName(candidate.path, fallback))
  return suggestToolName(candidate.path, fallback)
}
