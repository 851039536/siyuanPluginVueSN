// FileUpload 的文件校验与类型匹配（纯函数，零 Vue 依赖）
// 沿用 splitter/sizes.ts、confirm/position.ts 的「计算外置、组件只做编排」先例
import type { FileUploadError } from "./types"
import { interpolate } from "./types"

export interface FileValidationOptions {
  /** `accept` 字符串（如 `image/*,.pdf`），空值表示不限制 */
  accept?: string
  /** 单文件大小上限（字节），未传表示不限制 */
  maxFileSize?: number
  /** 已选数量（用于数量上限的增量判断） */
  currentCount: number
  /** 待加入的文件数 */
  incomingCount: number
  /** 数量上限，未传表示不限制 */
  fileLimit?: number
  /** 可读大小格式化函数（由组件注入共享的 `formatFileSize`，此模块不重复实现） */
  formatSize: (bytes: number) => string
  /** 三处文案模板（已由组件的 props 默认值兜底） */
  messages: {
    invalidFileSizeMessage: string
    invalidFileTypeMessage: string
    invalidFileLimitMessage: string
  }
}

/** 把 `accept` 拆成规则数组（去空格、去空项） */
export const parseAccept = (accept?: string): string[] =>
  (accept ?? "")
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)

/**
 * 单个文件是否命中 `accept` 规则。支持三种官方形态：
 * - `.pdf`：扩展名精确匹配
 * - `image/*`：主类型通配
 * - `image/png`：完整 MIME 精确匹配
 *
 * ⚠️ 浏览器下 `File.type` 可能为空（如某些无扩展名或系统未识别的文件），
 * 此时**回退到扩展名匹配**，避免把合法文件一律拒掉。
 */
export const matchesAccept = (file: File, rules: string[]): boolean => {
  if (rules.length === 0) return true
  const type = (file.type || "").toLowerCase()
  const name = (file.name || "").toLowerCase()
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : ""

  return rules.some((rule) => {
    if (rule.startsWith(".")) return extension === rule
    if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1))
    return type === rule
  })
}

/**
 * 校验一批文件，返回全部失败项（通过的文件由调用方从原数组中自行筛出）。
 * 数量上限按「已有 + 本次」累计判断，且**只在超过上限时为溢出部分报错**，
 * 而不是一票否决整批 —— 用户一次拖入过多文件时，能加的先加上。
 */
export function validateFiles(
  files: File[],
  options: FileValidationOptions,
): FileUploadError[] {
  const rules = parseAccept(options.accept)
  const errors: FileUploadError[] = []
  const { maxFileSize, fileLimit, formatSize, messages } = options

  files.forEach((file, index) => {
    if (maxFileSize !== undefined && file.size > maxFileSize) {
      errors.push({
        fileName: file.name,
        reason: "size",
        message: interpolate(
          messages.invalidFileSizeMessage,
          file.name,
          formatSize(maxFileSize),
        ),
      })
      return
    }

    if (!matchesAccept(file, rules)) {
      errors.push({
        fileName: file.name,
        reason: "type",
        message: interpolate(messages.invalidFileTypeMessage, file.name),
      })
      return
    }

    if (fileLimit !== undefined && options.currentCount + index + 1 > fileLimit) {
      errors.push({
        fileName: file.name,
        reason: "limit",
        message: interpolate(messages.invalidFileLimitMessage, fileLimit),
      })
    }
  })

  return errors
}

/** 按校验结果筛出可加入的文件（保持原有顺序，仅剔除报错项） */
export function filterAcceptedFiles(
  files: File[],
  errors: FileUploadError[],
): File[] {
  if (errors.length === 0) return files
  const rejected = new Set(errors.map((error) => error.fileName))
  return files.filter((file) => !rejected.has(file.name))
}
