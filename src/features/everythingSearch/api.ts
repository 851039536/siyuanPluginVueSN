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
  sortEverythingItems,
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
 * 会话级标记：探测到当前 Everything 的 HTTP 服务对非 name 排序返回空结果时置位。
 * 置位后后续搜索直接跳过 sort/ascending 参数（单次请求完成），不再逐次探测；
 * sort=name 服务端始终可用，不受影响。页面刷新 / 插件重载即重置。
 * 实测 Everything 1.4.1.1032 存在此缺陷（官方文档宣称支持 sort=path/size/date_modified，实际仅 name 可用）。
 */
let sortServerUnsupported = false

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

  // 排序参数（TypeScript 确保 sort 仅可能为有效值）；探测到服务端排序缺陷后跳过非 name 排序
  const skipServerSort = sortServerUnsupported && sort !== "name"
  if (!skipServerSort) {
    params.append("sort", sort)
    params.append("ascending", ascending ? "1" : "0")
  }

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

    type RawResponse = { results?: RawEverythingItem[], totalResults?: number } | null
    const data: RawResponse = await response.json()
    let rawItems = data?.results ?? []

    /**
     * 返回的是完整结果集（totalResults ≤ 本次请求的 count）时，客户端按用户选择的
     * 排序重排，弥补服务端排序缺失；分页截断的局部切片无法还原全局顺序，保持原顺序。
     */
    const applyClientSort = (source: RawResponse, items: RawEverythingItem[]) => {
      const total = source?.totalResults
      if (typeof total !== "number" || !Number.isFinite(total) || total > maxResults) return items
      return sortEverythingItems(items, sort, ascending)
    }

    if (!skipServerSort && sort !== "name" && rawItems.length === 0) {
      // 首次探测：部分 Everything 版本（实测 1.4.1.1032）的 HTTP 服务对 sort=path/size/date_modified
      // 异常返回空结果（官方文档宣称支持，仅 sort=name 可用），导致搜索永远"无结果"。
      // 去掉排序参数按服务端默认排序重试一次；重试有结果则记录缺陷，后续搜索不再下发排序。
      console.warn(
        `[everythingSearch] sort=${sort} 返回空结果，疑似当前 Everything 版本 HTTP 服务不支持该排序，已降级为默认排序重试`,
      )
      params.delete("sort")
      params.delete("ascending")
      try {
        const fallback = await fetch(
          `http://${config.host}:${config.port}/?${params.toString()}`,
          {
            method: "GET",
            signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
          },
        )
        if (fallback.ok) {
          const fallbackData: RawResponse = await fallback.json()
          const fallbackItems = fallbackData?.results ?? []
          if (fallbackItems.length > 0) {
            sortServerUnsupported = true
            rawItems = applyClientSort(fallbackData, fallbackItems)
          }
        }
      } catch (fallbackError) {
        // 降级重试失败不影响首次请求的结果（保持空结果原样返回）
        console.warn("[everythingSearch] 降级重试失败:", fallbackError)
      }
    } else if (skipServerSort) {
      // 已探测到缺陷：本次请求未下发排序，完整结果集时客户端按用户选择重排
      rawItems = applyClientSort(data, rawItems)
    }

    return parseSearchResponse({ results: rawItems })
  } catch (error) {
    console.error("Everything搜索失败:", error)
    throw error
  }
}
