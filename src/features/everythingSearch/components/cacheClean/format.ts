// cacheClean 展示层纯函数：体积/时间格式化、i18n 占位符替换与提示文案构建

import type { CacheCleanResult } from "../../types"
import type { CachePanelFeedback } from "./types"
import { formatFileSize } from "@/utils/format"

/** i18n 取值函数（缺失返回空串：i18n 是唯一数据源，禁止硬编码兜底） */
export type Translate = (key: string) => string

/** 两位补零（时间格式化内部使用） */
const pad = (value: number): string => String(value).padStart(2, "0")

/**
 * 字节数 → 可读体积。
 * 非法值与负数一律按 0 处理（扫描侧的 size 可能缺失，直接传给格式化会得到 `NaN B`）。
 */
export function formatSize(bytes: number): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
  return formatFileSize(safe)
}

/**
 * 毫秒时间戳 → `YYYY-MM-DD HH:mm`。
 * `0` / 非法值表示「未知」，返回空串（调用方据此不渲染该列）。
 */
export function formatModifiedTime(time: number): string {
  if (!Number.isFinite(time) || time <= 0) return ""
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 用 `{key}` 占位符填充 i18n 文案。
 * 缺失的占位符原样保留（便于暴露漏传变量的问题，而不是静默吞掉）。
 */
export function fillTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  let text = template
  for (const [key, value] of Object.entries(vars)) {
    text = text.split(`{${key}}`).join(String(value))
  }
  return text
}

/** 扫描按钮文案：扫描中 / 已扫描后重新扫描 / 首次扫描 */
export function buildScanLabel(t: Translate, scanning: boolean, scanned: boolean): string {
  if (scanning) return t("cacheScanning")
  return scanned ? t("cacheRescan") : t("cacheScan")
}

/** 扫描耗时文案（秒，保留一位小数） */
export function buildElapsedText(t: Translate, elapsed: number | undefined): string {
  if (!elapsed || elapsed <= 0) return ""
  return fillTemplate(t("cacheElapsed"), { seconds: Math.round(elapsed / 100) / 10 })
}

/** 扫描侧反馈（取消 / 失败；成功时为空） */
export function buildScanFeedback(
  t: Translate,
  error: string,
  cancelled: boolean,
): CachePanelFeedback | null {
  if (error) return { severity: "error", text: `${t("cacheScanFailed")}: ${error}` }
  if (cancelled) return { severity: "warn", text: t("cacheScanCancelled") }
  return null
}

/** 清理侧反馈（成功 / 部分失败 / 失败；空闲时为空） */
export function buildCleanFeedback(
  t: Translate,
  error: string,
  result: CacheCleanResult | null,
): CachePanelFeedback | null {
  if (error) return { severity: "error", text: `${t("cacheCleanFailed")}: ${error}` }
  if (!result) return null
  if (result.failed > 0) {
    return { severity: "warn", text: fillTemplate(t("cacheCleanPartial"), { failed: result.failed }) }
  }
  return {
    severity: "success",
    text: fillTemplate(t("cacheCleanDone"), {
      count: result.deleted,
      size: formatSize(result.freed),
    }),
  }
}

/** 已选统计文案 */
export function buildSelectedText(t: Translate, count: number, size: number): string {
  return fillTemplate(t("cacheSelected"), { count, size: formatSize(size) })
}

/** 清理确认正文（占位符在容器侧填充，确认弹窗本身保持纯展示） */
export function buildConfirmMessage(t: Translate, count: number, size: number): string {
  return fillTemplate(t("cacheCleanConfirmMessage"), { count, size: formatSize(size) })
}
