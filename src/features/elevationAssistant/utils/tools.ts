/**
 * 提权助手 - 工具清单清洗与 id 生成
 */
import type {
  ElevationTool,
  ShortcutLocation,
  ShortcutRecord,
} from "../types"
import { isAbsoluteWindowsPath } from "./validation"
import { hasLnkExtension } from "./shortcut"

export const MAX_TOOLS = 50
export const MAX_SHORTCUTS_PER_TOOL = 10

const LOCATIONS: readonly ShortcutLocation[] = ["desktop", "programs", "custom"]

/** 生成工具 id（尽量使用 crypto.randomUUID） */
export function createToolId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `elevation-${crypto.randomUUID()}`
  }
  return `elevation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function sanitizeShortcut(raw: unknown): ShortcutRecord | null {
  if (!raw || typeof raw !== "object") return null
  const source = raw as Record<string, unknown>
  const path = asString(source.path).trim()
  const location = source.location
  if (!path || !isAbsoluteWindowsPath(path) || !hasLnkExtension(path)) return null
  if (!LOCATIONS.includes(location as ShortcutLocation)) return null
  const createdAt = asNumber(source.createdAt) ?? Date.now()
  return {
    path,
    location: location as ShortcutLocation,
    runAsAdmin: source.runAsAdmin === true,
    createdAt,
  }
}

function sanitizeShortcutList(raw: unknown): ShortcutRecord[] {
  if (!Array.isArray(raw)) return []
  // 同一路径只保留最后一条（数组越靠后代表越新的写入，避免旧值覆盖新值）
  const byPath = new Map<string, ShortcutRecord>()
  for (const item of raw) {
    const shortcut = sanitizeShortcut(item)
    if (!shortcut) continue
    byPath.set(shortcut.path.toLowerCase(), shortcut)
  }
  const result = [...byPath.values()]
  result.sort((a, b) => b.createdAt - a.createdAt)
  return result.slice(0, MAX_SHORTCUTS_PER_TOOL)
}

function sanitizeTool(raw: unknown): ElevationTool | null {
  if (!raw || typeof raw !== "object") return null
  const source = raw as Record<string, unknown>
  const id = asString(source.id).trim()
  const name = asString(source.name).trim()
  const path = asString(source.path).trim()
  if (!id || !name || !path) return null
  const now = Date.now()
  const createdAt = asNumber(source.createdAt) ?? now
  const updatedAt = asNumber(source.updatedAt) ?? createdAt
  const tool: ElevationTool = {
    id,
    name,
    path,
    args: asString(source.args).slice(0, 4096),
    workingDir: asString(source.workingDir).trim(),
    requireAdmin: source.requireAdmin === true,
    shortcuts: sanitizeShortcutList(source.shortcuts),
    createdAt,
    updatedAt,
  }
  const lastRunAt = asNumber(source.lastRunAt)
  if (lastRunAt !== null) tool.lastRunAt = lastRunAt
  return tool
}

/** 清洗持久化的工具数组：去重 id、裁剪上限、按更新时间倒序 */
export function sanitizeTools(raw: unknown): ElevationTool[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const result: ElevationTool[] = []
  for (const item of raw) {
    const tool = sanitizeTool(item)
    if (!tool || seen.has(tool.id)) continue
    seen.add(tool.id)
    result.push(tool)
  }
  result.sort((a, b) => b.updatedAt - a.updatedAt)
  return result.slice(0, MAX_TOOLS)
}

/** 按 id 查找快捷方式所属工具（用于避免两个工具管理同一 .lnk） */
export function findShortcutOwner(
  tools: readonly ElevationTool[],
  shortcutPath: string,
  excludeToolId: string,
): ElevationTool | null {
  const target = shortcutPath.toLowerCase()
  for (const tool of tools) {
    if (tool.id === excludeToolId) continue
    if (tool.shortcuts.some((shortcut) => shortcut.path.toLowerCase() === target)) {
      return tool
    }
  }
  return null
}
