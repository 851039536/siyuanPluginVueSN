// 磁盘浏览器纯工具函数 — 大小格式化、路径构建、缓存状态计算、日期格式化、目录读取
import type {
  CacheData,
  CacheStatus,
  DiskBrowserI18n,
  DiskInfo,
  FolderInfo,
} from "../types"
import { getNodeModules, getNodeProcessModules } from "@/utils/nodeModules"

/** 读取本地磁盘信息（wmic 比 PowerShell 快 10x+） */
export function getDiskInfo(): DiskInfo[] | null {
  const node = getNodeProcessModules()
  if (!node) return null

  try {
    const stdout = node.child_process.execSync(
      "wmic logicaldisk get DeviceID,VolumeName,Size,FreeSpace /format:csv",
      { timeout: 3000, encoding: "utf8" },
    ) as string

    return stdout
      .split("\n")
      .slice(2)
      .filter((line) => line.trim())
      .map((line) => {
        const [, deviceId, volumeName, size, freeSpace] = line.split(",")
        if (!deviceId) return null
        const total = Number.parseInt(size) || 0
        const free = Number.parseInt(freeSpace) || 0
        return {
          drive: deviceId,
          label: volumeName?.trim() || "",
          total,
          used: total - free,
          usagePercent: total > 0 ? Math.round(((total - free) / total) * 100) : 0,
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null && d.total > 0)
  } catch {
    return null
  }
}

/** 使用 Node.js fs 模块读取目录内容 */
export function readDirectoryContents(dirPath: string): FolderInfo[] | null {
  const node = getNodeModules()
  if (!node) return null

  let items: FolderInfo[] = []
  try {
    const entries = node.fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = buildPath(dirPath, entry.name)

      if (entry.isDirectory()) {
        items.push({ name: entry.name, path: fullPath })
      } else if (entry.isFile()) {
        try {
          const stat = node.fs.statSync(fullPath)
          items.push({
            name: entry.name,
            path: fullPath,
            isFile: true,
            size: stat.size,
            modifiedTime: stat.mtime.toISOString(),
          })
        } catch {
          items.push({ name: entry.name, path: fullPath, isFile: true })
        }
      }
    }

    items.sort((a, b) => {
      if (a.isFile === b.isFile) return a.name.localeCompare(b.name, "zh-CN")
      return a.isFile ? 1 : -1
    })
  } catch {
    items = []
  }

  return items
}

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
  if (!cacheData) return { text: "", isExpired: false, tooltip: "" }

  const elapsed = Date.now() - cacheData.timestamp
  const remaining = cacheExpiryTime - elapsed

  if (remaining <= 0) {
    return {
      text: labelType === "full" ? i18n.cacheExpired || "缓存已过期" : i18n.expired || "已过期",
      isExpired: true,
      tooltip: i18n.cacheExpiredTooltip || "缓存已过期，点击刷新按钮获取最新数据",
    }
  }

  const minutes = Math.floor(remaining / 60000)
  return {
    text: labelType === "full"
      ? `${minutes}${i18n.minutesRemaining || "分钟"}`
      : `${minutes}${i18n.min || "分"}`,
    isExpired: false,
    tooltip: i18n.cacheValidTooltip || `缓存有效期剩余 ${minutes}分钟`,
  }
}

export const CACHE_EXPIRY_TIME = 60 * 60 * 1000

export function isCacheValid<T>(
  cacheData: CacheData<T> | null | undefined,
  cacheExpiryTime: number,
): cacheData is CacheData<T> {
  if (!cacheData) return false
  return Date.now() - cacheData.timestamp < cacheExpiryTime
}

export function buildPath(basePath: string, name: string): string {
  const separator = basePath.endsWith("\\") ? "" : "\\"
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

const DEFAULT_DISKS = ["C:", "D:", "E:", "F:", "G:", "H:"]

export function getDefaultDisks(): DiskInfo[] {
  return DEFAULT_DISKS.map((drive) => ({ drive }))
}
