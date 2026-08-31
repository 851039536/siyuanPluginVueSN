/**
 * Everything HTTP API 服务
 * Everything是一个Windows本地文件搜索工具，支持HTTP API接口
 */

export interface EverythingSearchResult {
  name: string
  path: string
  size: number
  dateModified: string
  type: "file" | "folder"
}

/** 排序字段（单一定义，SearchOptions 经派生复用，避免联合类型重复声明） */
export type EverythingSortField = "name" | "path" | "size" | "date_modified"

export interface EverythingSearchOptions {
  query: string
  maxResults?: number
  matchCase?: boolean
  matchWholeWord?: boolean
  matchPath?: boolean
  regex?: boolean
  sort?: EverythingSortField
  ascending?: boolean
  /** 是否启用仅搜索路径过滤（默认 false） */
  includePathsEnabled?: boolean
  /** 仅搜索路径列表（拼 path:"..."，多个 AND） */
  includePaths?: string[]
  /** 是否启用排除路径过滤（默认 false） */
  excludePathsEnabled?: boolean
  /** 排除路径列表（拼 !path:"..."） */
  excludePaths?: string[]
}

export interface EverythingConfig {
  host: string
  port: number
}

/**
 * 检查Everything HTTP服务是否可用
 */
export async function checkEverythingService(
  config: EverythingConfig,
): Promise<boolean> {
  try {
    const response = await fetch(
      `http://${config.host}:${config.port}/?search=test&json=1&count=1`,
      {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      },
    )
    return response.ok
  } catch (error) {
    console.error("Everything服务不可用:", error)
    return false
  }
}

/**
 * 搜索文件
 */
export async function searchFiles(
  options: EverythingSearchOptions,
  config: EverythingConfig,
): Promise<EverythingSearchResult[]> {
  const {
    query,
    maxResults = 100,
    matchCase = false,
    matchWholeWord = false,
    matchPath = false,
    regex = false,
    sort = "date_modified",
    ascending = false,
    includePathsEnabled = false,
    includePaths = [],
    excludePathsEnabled = false,
    excludePaths = [],
  } = options

  // 路径过滤（仅对应开关开启时生效）：仅搜索路径 path:"..."（多个 AND）+ 排除路径 !path:"..."（引号转义空格）
  const pathParts: string[] = []
  if (includePathsEnabled) {
    for (const p of includePaths) {
      const trimmed = p.trim()
      if (trimmed) pathParts.push(`path:"${trimmed}"`)
    }
  }
  if (excludePathsEnabled) {
    for (const p of excludePaths) {
      const trimmed = p.trim()
      if (trimmed) pathParts.push(`!path:"${trimmed}"`)
    }
  }
  const searchQuery = pathParts.length > 0
    ? `${query} ${pathParts.join(" ")}`.trim()
    : query

  // 构建URL参数
  const params = new URLSearchParams({
    search: searchQuery,
    json: "1",
    count: maxResults.toString(),
    path_column: "1",
    size_column: "1",
    date_modified_column: "1",
  })

  // 排序参数（TypeScript 确保 sort 仅可能为有效值）
  params.append("sort", sort)
  params.append("ascending", ascending ? "1" : "0")

  // 搜索选项
  if (matchCase) params.append("case", "1")
  if (matchWholeWord) params.append("wholeword", "1")
  if (matchPath) params.append("path", "1")
  if (regex) params.append("regex", "1")

  try {
    const response = await fetch(
      `http://${config.host}:${config.port}/?${params.toString()}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    const data = await response.json()

    // 解析结果
    const results: EverythingSearchResult[] = (data.results || []).map(
      (item: any) => ({
        name: item.name || "",
        path: item.path || "",
        size: item.size || 0,
        dateModified: formatDate(item.date_modified),
        type: item.type === "folder" ? "folder" : "file",
      }),
    )

    return results
  } catch (error) {
    console.error("Everything搜索失败:", error)
    throw error
  }
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number | string): string {
  if (!timestamp) return ""

  // Everything返回的是Windows FILETIME格式或Unix时间戳
  let date: Date
  if (typeof timestamp === "number") {
    // 如果是大数字，可能是Windows FILETIME (100-nanosecond intervals since January 1, 1601)
    if (timestamp > 1e15) {
      // Windows FILETIME转换
      date = new Date(timestamp / 10000 - 11644473600000)
    } else if (timestamp > 1e12) {
      // 毫秒时间戳
      date = new Date(timestamp)
    } else {
      // 秒时间戳
      date = new Date(timestamp * 1000)
    }
  } else {
    date = new Date(timestamp)
  }

  if (Number.isNaN(date.getTime())) return ""

  const locale = (typeof navigator !== "undefined" && navigator.language) || "zh-CN"
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * 拼接搜索结果项的完整路径（path\\name）
 */
export function getFullPath(item: EverythingSearchResult): string {
  return item.path ? `${item.path}\\${item.name}` : item.name
}

/** 系统关键目录名列表（小写，用于排除空文件夹搜索结果中的系统路径，防止误删导致系统异常） */
const SYSTEM_ROOT_DIRS = [
  "windows",
  "program files",
  "program files (x86)",
  "programdata",
  "$recycle.bin",
  "system volume information",
  "recovery",
  "boot",
  "perflogs",
]

/** 提取 Windows 路径盘符后的一级目录名（如 "C:\\Windows\\System32" → "Windows"） */
const ROOT_DIR_REGEX = /^[a-z]:\\([^\\]+)(?:\\|$)/i

/**
 * 判断完整路径是否位于系统关键目录下
 * 仅做纯字符串比对，无文件系统 I/O，不会因访问系统文件引发异常
 */
export function isSystemPath(fullPath: string): boolean {
  const match = ROOT_DIR_REGEX.exec(fullPath)
  if (!match) return false
  return SYSTEM_ROOT_DIRS.includes(match[1].toLowerCase())
}
