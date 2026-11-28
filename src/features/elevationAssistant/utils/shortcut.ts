/**
 * 提权助手 - 快捷方式纯工具函数
 *
 * 这里只做纯字节/字符串处理，不读写文件，便于 vitest 在 node 环境直接测试。
 */
import { windowsBasename } from "./validation"

/** LinkFlags 第二个字节的偏移（0x14 起 4 字节 LinkFlags，bit13 = 0x2000） */
export const RUN_AS_ADMIN_BYTE_OFFSET = 0x15

/** RunAsUser 位：LinkFlags bit13，对应偏移 0x15 的 0x20 */
export const RUN_AS_ADMIN_MASK = 0x20

/** 快捷方式文件名最长字符数（不含 .lnk） */
export const SHORTCUT_NAME_MAX = 100

/** Windows 文件名非法字符（校验用，无全局标志，避免 test 的 lastIndex 状态） */
const ILLEGAL_SHORTCUT_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001F]/
/** 同一字符集的全局版本（清洗用，replace 需替换全部命中） */
const ILLEGAL_SHORTCUT_NAME_CHARS_GLOBAL = /[\\/:*?"<>|\u0000-\u001F]/g

/** Windows 保留设备名（扩展名无关，CON.lnk 同样不允许） */
const RESERVED_DEVICE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export type ShortcutNameError =
  | "empty"
  | "tooLong"
  | "invalidChars"
  | "trailing"
  | "reserved"

/** 校验 Shell Link 头（前 4 字节为 0x4C 00 00 00） */
export function isShortcutHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && bytes[0] === 0x4C
    && bytes[1] === 0x00
    && bytes[2] === 0x00
    && bytes[3] === 0x00
}

/** 读取 .lnk 的 RunAsUser 标记（字节不足时视为未设置） */
export function hasRunAsAdminFlag(bytes: Uint8Array): boolean {
  return bytes.length > RUN_AS_ADMIN_BYTE_OFFSET
    && (bytes[RUN_AS_ADMIN_BYTE_OFFSET] & RUN_AS_ADMIN_MASK) !== 0
}

/** 去掉用户误输入的 .lnk 后缀（大小写不敏感，只去掉一层） */
export function stripLnkExtension(name: string): string {
  return name.trim().replace(/\.lnk$/i, "").trim()
}

/** 规范化用户输入的快捷方式名称 */
export function normalizeShortcutName(name: string): string {
  return stripLnkExtension(name)
}

/** 校验快捷方式名称；合法返回 null，非法返回原因码 */
export function validateShortcutName(name: string): ShortcutNameError | null {
  const value = normalizeShortcutName(name)
  if (!value) return "empty"
  if (value.length > SHORTCUT_NAME_MAX) return "tooLong"
  if (ILLEGAL_SHORTCUT_NAME_CHARS.test(value)) return "invalidChars"
  if (value.endsWith(".") || value.endsWith(" ")) return "trailing"
  if (value === "." || value === "..") return "trailing"
  if (RESERVED_DEVICE_NAMES.test(value)) return "reserved"
  return null
}

/**
 * 将任意名称清洗为可用的快捷方式名（用于从路径生成默认名称）。
 * 只用于建议/兜底，用户输入仍应通过 validateShortcutName 拦截而非静默改写。
 * @param fallback 清洗后为空时使用的名称（由调用方传 i18n，避免硬编码中文）
 */
export function sanitizeShortcutName(name: string, fallback = "shortcut"): string {
  const value = normalizeShortcutName(name)
    .replace(ILLEGAL_SHORTCUT_NAME_CHARS_GLOBAL, "")
    .replace(/[. ]+$/, "")
    .trim()
  if (!value || value === "." || value === ".." || RESERVED_DEVICE_NAMES.test(value)) {
    return fallback
  }
  return value.slice(0, SHORTCUT_NAME_MAX)
}

/**
 * 从 exe 路径推导工具名（不含目录、不含 .exe）
 * @param fallback 无法推导时使用的名称（由调用方传 i18n）
 */
export function suggestToolName(targetPath: string, fallback = "shortcut"): string {
  const base = windowsBasename(targetPath.trim().replace(/["']/g, ""))
  const name = base.replace(/\.exe$/i, "").trim()
  return name ? sanitizeShortcutName(name, fallback) : fallback
}

/** 判断路径是否以 .lnk 结尾（大小写不敏感） */
export function hasLnkExtension(filePath: string): boolean {
  return /\.lnk$/i.test(filePath.trim())
}
