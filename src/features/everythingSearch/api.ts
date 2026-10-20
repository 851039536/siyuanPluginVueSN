/**
 * Everything HTTP API 服务
 * Everything是一个Windows本地文件搜索工具，支持HTTP API接口
 *
 * 本文件只保留 IO（fetch）。表达式组装 / 路径拼接 / 时间解析等纯逻辑
 * 已收敛到 ../utils.ts（可单测，见 ../utils.spec.ts）。
 */
import type { SizeUnit } from "./utils"
import {
  buildSearchQuery,
  parseEverythingDate,
} from "./utils"

/** 排序字段（单一定义，SearchOptions 经派生复用，避免联合类型重复声明） */
export type EverythingSortField = "name" | "path" | "size" | "date_modified"

export interface EverythingSearchResult {
  name: string
  path: string
  size: number
  dateModified: string
  type: "file" | "folder"
}

export interface EverythingSearchOptions {
  query: string
  maxResults?: number
  matchCase?: boolean
  matchWholeWord?: boolean
  matchPath?: boolean
  regex?: boolean
  sort?: EverythingSortField
  ascending?: boolean
  /** 空文件夹模式（追加 `empty:` 并跳过大小过滤） */
  emptyFolders?: boolean
  /** 是否启用仅搜索路径过滤（默认 false） */
  includePathsEnabled?: boolean
  /** 仅搜索路径列表（拼 path:"..."，多个 AND） */
  includePaths?: string[]
  /** 是否启用排除路径过滤（默认 false） */
  excludePathsEnabled?: boolean
  /** 排除路径列表（拼 !path:"..."） */
  excludePaths?: string[]
  /** 最小文件大小（0 = 不启用） */
  minSize?: number
  minSizeUnit?: SizeUnit
  /** 最大文件大小（0 = 不启用） */
  maxSize?: number
  maxSizeUnit?: SizeUnit
}

export interface EverythingConfig {
  host: string
  port: number
}

/** 请求超时：探活短、搜索长（Everything 对大结果集做全量排序时耗时明显） */
const SERVICE_PROBE_TIMEOUT_MS = 3000
const SEARCH_TIMEOUT_MS = 10000

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
        signal: AbortSignal.timeout(SERVICE_PROBE_TIMEOUT_MS),
      },
    )
    return response.ok
  } catch (error) {
    console.error("Everything服务不可用:", error)
    return false
  }
}

/** Everything 原始响应条目（字段全部可选：服务端在不同版本下会缺列） */
export interface RawEverythingItem {
  name?: string
  path?: string
  size?: number
  date_modified?: number | string
  type?: string
}

/** 毫秒时间戳 → 本地化展示字符串（年-月-日 时:分） */
function formatDateValue(timestamp: number): string {
  const date = new Date(timestamp)
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
 * 解析 Everything 响应体为结果列表。
 * 整改前的映射内联在 `searchFiles` 里、时间格式化另有一份递归推测逻辑，
 * 现拆成纯函数以便对「字段缺失 / 时间格式差异 / 尺寸非法」逐条断言。
 */
export function parseSearchResponse(
  data: { results?: RawEverythingItem[] } | null | undefined,
): EverythingSearchResult[] {
  return (data?.results ?? []).map((item) => {
    const timestamp = parseEverythingDate(item.date_modified)
    return {
      name: item.name ?? "",
      path: item.path ?? "",
      size: typeof item.size === "number" && Number.isFinite(item.size) && item.size > 0
        ? item.size
        : 0,
      dateModified: timestamp === null ? "" : formatDateValue(timestamp),
      type: item.type === "folder" ? "folder" : "file",
    }
  })
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
    emptyFolders = false,
    includePathsEnabled = false,
    includePaths = [],
    excludePathsEnabled = false,
    excludePaths = [],
    minSize = 0,
    minSizeUnit = "KB",
    maxSize = 0,
    maxSizeUnit = "KB",
  } = options

  // 表达式组装统一走纯函数（关键词 → 大小过滤 → 路径过滤；empty: 模式自动跳过大小过滤）
  const searchQuery = buildSearchQuery({
    query,
    emptyFolders,
    minSize,
    minSizeUnit,
    maxSize,
    maxSizeUnit,
    includePathsEnabled,
    includePaths,
    excludePathsEnabled,
    excludePaths,
  })

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
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`)
    }

    return parseSearchResponse(await response.json())
  } catch (error) {
    console.error("Everything搜索失败:", error)
    throw error
  }
}
