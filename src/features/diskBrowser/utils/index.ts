import type {
  CacheData,
  CacheStatus,
  DiskBrowserI18n,
} from "../types"
import { copyToClipboard as _copyToClipboard } from "@/utils/domUtils"

const UNITS = ["B", "KB", "MB", "GB", "TB"]
const K = 1024

export function formatSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B"
  const i = Math.floor(Math.log(bytes) / Math.log(K))
  return `${(bytes / K ** i).toFixed(2)} ${UNITS[i]}`
}

export function getFolderName(path: string): string {
  const parts = path.split("\\")
  return parts[parts.length - 1] || path
}

export function computeCacheStatus<T>(
  cacheData: CacheData<T> | null | undefined,
  i18n: DiskBrowserI18n,
  cacheExpiryTime: number,
  labelType: "full" | "short" = "full",
): CacheStatus {
  if (!cacheData) {
    return {
      text: "",
      isExpired: false,
      tooltip: "",
    }
  }

  const elapsed = Date.now() - cacheData.timestamp
  const remaining = cacheExpiryTime - elapsed

  if (remaining <= 0) {
    return {
      text:
        labelType === "full"
          ? i18n.cacheExpired || "缓存已过期"
          : i18n.expired || "已过期",
      isExpired: true,
      tooltip:
        i18n.cacheExpiredTooltip || "缓存已过期，点击刷新按钮获取最新数据",
    }
  }

  const minutes = Math.floor(remaining / 60000)
  return {
    text:
      labelType === "full"
        ? `${minutes}${i18n.minutesRemaining || "分钟"}`
        : `${minutes}${i18n.min || "分"}`,
    isExpired: false,
    tooltip: i18n.cacheValidTooltip || `缓存有效期剩余 ${minutes}分钟`,
  }
}

let cachedNetworkSlow: boolean | null = null

export function isNetworkSlow(): boolean {
  if (cachedNetworkSlow !== null) return cachedNetworkSlow

  if (typeof navigator !== "undefined" && (navigator as any).connection) {
    const connection = (navigator as any).connection
    cachedNetworkSlow = ["slow-2g", "2g", "3g"].includes(
      connection.effectiveType,
    )
  } else {
    cachedNetworkSlow = false
  }
  return cachedNetworkSlow
}

export function getCacheExpiryTime(): number {
  return isNetworkSlow() ? 10 * 60 * 1000 : 60 * 60 * 1000
}

export function isCacheValid<T>(
  cacheData: CacheData<T> | null | undefined,
  cacheExpiryTime: number,
): cacheData is CacheData<T> {
  if (!cacheData) return false
  return Date.now() - cacheData.timestamp < cacheExpiryTime
}

export function buildPath(basePath: string, name: string): string {
  const separator =
    basePath.endsWith("\\") || basePath.endsWith(":") ? "" : "\\"
  return `${basePath}${separator}${name}`.replace(/\\\\/g, "\\")
}

export function formatDate(dateString: string, i18n: DiskBrowserI18n): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return i18n.today || "今天"
    if (days === 1) return i18n.yesterday || "昨天"
    if (days < 7) return `${days} ${i18n.daysAgo || "天前"}`

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
  } catch {
    return dateString
  }
}

export { _copyToClipboard as copyToClipboard }
