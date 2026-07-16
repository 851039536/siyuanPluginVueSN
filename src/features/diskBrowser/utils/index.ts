// 磁盘浏览器纯工具函数 — 大小格式化、路径构建、缓存状态计算、日期格式化
import type {
  CacheData,
  CacheStatus,
  DiskBrowserI18n,
  DiskInfo,
  FolderInfo,
} from "../types"
import { getNodeProcessModules } from "@/utils/nodeModules"

const DEBOUNCE_DELAY = 500

let _execAsync: ((cmd: string, opts?: any) => Promise<{ stdout: string, stderr: string }>) | null = null

function getExecAsync() {
  if (_execAsync) return _execAsync
  const node = getNodeProcessModules()
  if (!node) return null
  _execAsync = node.util.promisify(node.child_process.exec)
  return _execAsync
}

/** 创建带防抖和重试机制的 exec 执行器 */
export function createExecRunner() {
  let execQueue = Promise.resolve()
  let lastExecutionTime = 0

  async function execWithTimeout(
    command: string,
    timeout = 3000,
  ): Promise<{ stdout: string, stderr: string }> {
    const exec = getExecAsync()
    if (!exec) throw new Error("当前环境不支持执行命令")
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("执行超时")), timeout)
    })
    return Promise.race([exec(command), timeoutPromise])
  }

  async function retryExec(
    command: string,
    retries = 2,
    timeout = 3000,
    operationType = "unknown",
  ): Promise<{ stdout: string, stderr: string }> {
    const currentTask = execQueue.then(async () => {
      const waitTime = DEBOUNCE_DELAY - (Date.now() - lastExecutionTime)
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
      lastExecutionTime = Date.now()

      let lastError: Error | null = null
      for (let i = 0; i <= retries; i++) {
        try {
          return await execWithTimeout(command, timeout)
        } catch (error) {
          lastError = error as Error
          if (i === retries) {
            throw new Error(
              `${operationType}失败，重试${retries}次后仍失败: ${lastError.message}`,
            )
          }
          const delay = Math.min(1000 * 2 ** i, 3000)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
      throw lastError || new Error("未知错误")
    })

    execQueue = currentTask.then(() => {}, () => {}) as Promise<void>
    return currentTask
  }

  return { retryExec }
}

/** 解析 PowerShell 目录列表输出（纯文件夹名） */
export function processFolderList(stdout: string, basePath: string): FolderInfo[] {
  return (
    stdout
      ?.trim()
      .split("\n")
      .map((line) => line.trim())
      .filter((name) => name && name !== "." && name !== "..")
      .map((name) => ({
        name,
        path: buildPath(basePath, name),
      })) || []
  )
}

/** 解析 PowerShell 文件/文件夹列表输出（含大小、修改时间） */
export function processItemList(stdout: string, path: string): FolderInfo[] {
  const itemList: FolderInfo[] = []
  try {
    const itemData = JSON.parse(stdout)
    const itemArray = Array.isArray(itemData) ? itemData : [itemData]

    for (const item of itemArray) {
      if (item?.Name) {
        const itemName = String(item.Name).trim()
        itemList.push({
          name: itemName,
          path: buildPath(path, itemName),
          isFile: item.IsFile || false,
          size: item.Length ? Number.parseInt(item.Length) : undefined,
          modifiedTime: item.LastWriteTime || undefined,
        })
      }
    }

    itemList.sort((a, b) => {
      if (a.isFile === b.isFile) {
        return a.name.localeCompare(b.name, "zh-CN")
      }
      return a.isFile ? 1 : -1
    })
  } catch {
    // 解析失败返回空列表
  }
  return itemList
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

export function getCacheExpiryTime(): number {
  return 60 * 60 * 1000
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

const DEFAULT_DISKS = ["C:", "D:", "E:", "F:", "G:", "H:"]

/** 获取默认磁盘驱动器列表 */
export function getDefaultDisks(): DiskInfo[] {
  return DEFAULT_DISKS.map((drive) => ({ drive }))
}
