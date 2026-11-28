/**
 * 提权助手 - 纯路径/表单校验
 *
 * 不导入 node:path，保持可在 vitest 与浏览器环境直接使用；
 * 实际文件系统操作在 managers/ 内完成。
 */
import type { ShortcutLocation } from "../types"

/** 目标路径输入长度上限 */
export const TARGET_PATH_MAX = 1024
/** 启动参数长度上限 */
export const ARGUMENTS_MAX = 4096

/** 是否 Windows 绝对路径（盘符、UNC、\\?\ 前缀） */
export function isAbsoluteWindowsPath(value: string): boolean {
  if (!value) return false
  if (/^[a-z]:[\\/]/i.test(value)) return true
  if (/^\\\\[^\\]/.test(value)) return true
  if (/^\\\\\?\\[a-z]:[\\/]/i.test(value)) return true
  if (/^\\\\\?\\UNC\\/i.test(value)) return true
  return false
}

/** 取 Windows 路径的文件名（兼容 / 与 \） */
export function windowsBasename(value: string): string {
  const normalized = value.replace(/[\\/]+$/, "")
  const parts = normalized.split(/[\\/]/)
  return parts[parts.length - 1] || ""
}

/** 取 Windows 路径的目录（兼容 / 与 \；盘符根目录返回 `C:\`） */
export function windowsDirname(value: string): string {
  const normalized = value.replace(/[\\/]+$/, "")
  const index = Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/"))
  if (index <= 0) return ""
  const parent = normalized.slice(0, index)
  // "C:" 不是可用的绝对目录，盘符根统一补回分隔符
  if (/^[a-z]:$/i.test(parent)) return `${parent}\\`
  return parent
}

/** 是否 .exe 扩展名（大小写不敏感） */
export function hasExeExtension(value: string): boolean {
  return /\.exe$/i.test(value.trim())
}

/** 清理用户输入路径：去首尾空白、去掉成对引号、把正斜杠统一为反斜杠（保留 UNC 前缀） */
export function normalizeTargetPath(value: string): string {
  let next = value.trim()
  if (next.length >= 2) {
    const first = next[0]
    const last = next[next.length - 1]
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      next = next.slice(1, -1).trim()
    }
  }
  if (next.startsWith("\\\\?\\") || next.startsWith("\\\\")) {
    const prefix = next.startsWith("\\\\?\\") ? "\\\\?\\" : "\\\\"
    const rest = next.slice(prefix.length).replace(/\//g, "\\")
    return prefix + rest
  }
  return next.replace(/\//g, "\\")
}

/** 校验目标路径的基本形态（不访问文件系统） */
export function validateTargetPathInput(value: string): "empty" | "notAbsolute" | "notExe" | "tooLong" | null {
  const path = normalizeTargetPath(value)
  if (!path) return "empty"
  if (path.length > TARGET_PATH_MAX) return "tooLong"
  if (!isAbsoluteWindowsPath(path)) return "notAbsolute"
  if (!hasExeExtension(path)) return "notExe"
  return null
}

/** 校验工作目录输入（允许为空，表示使用 exe 所在目录） */
export function validateWorkingDirInput(value: string): "notAbsolute" | "tooLong" | null {
  const dir = normalizeTargetPath(value)
  if (!dir) return null
  if (dir.length > TARGET_PATH_MAX) return "tooLong"
  if (!isAbsoluteWindowsPath(dir)) return "notAbsolute"
  return null
}

/** 默认工作目录：目标 exe 所在目录 */
export function defaultWorkingDir(targetPath: string): string {
  return windowsDirname(normalizeTargetPath(targetPath))
}

/** 快捷方式位置合法性 */
export function isShortcutLocation(value: unknown): value is ShortcutLocation {
  return value === "desktop" || value === "programs" || value === "custom"
}

/** 截断过长参数，避免 PowerShell EncodedCommand 过大 */
export function clampArguments(value: string): string {
  return value.length > ARGUMENTS_MAX ? value.slice(0, ARGUMENTS_MAX) : value
}
