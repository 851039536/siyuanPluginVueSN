/**
 * Everything HTTP API 服务
 * Everything是一个Windows本地文件搜索工具，支持HTTP API接口
 *
 * 本文件只保留 IO（fetch）。表达式组装 / 路径拼接 / 时间解析等纯逻辑
 * 已收敛到 ../utils.ts（可单测，见 ../utils.spec.ts）。
 */
import type { SizeUnit } from "./utils"
import { log } from "./log"
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
    // 服务未启动是常态（用户没装 / 没开 HTTP 服务），只记 warn 不打扰
    log.warn("服务探活失败", error)
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

/** 原始响应体（`results` 缺失时按空列表处理） */
type RawResponse = { results?: RawEverythingItem[], totalResults?: number } | null

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
 * 独立成纯函数，便于对「字段缺失 / 时间格式差异 / 尺寸非法」逐条断言；
 * 调用方（`searchFiles`）只负责 IO 与降级重试。
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

/** 一次搜索的请求计划：URL 参数 + 后续排序判定所需的上下文 */
interface SearchPlan {
  params: URLSearchParams
  maxResults: number
  sort: EverythingSortField
  ascending: boolean
  /** 服务端排序已确认不可用：本次未下发 sort/ascending，完整结果集时需客户端重排 */
  skipServerSort: boolean
}

/**
 * 组装搜索参数（表达式 → 列 → 排序 → 匹配选项）。
 * 表达式组装走纯函数；排序参数在探测到服务端缺陷后不再下发。
 */
function buildSearchPlan(options: EverythingSearchOptions): SearchPlan {
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

  if (matchCase) params.append("case", "1")
  if (matchWholeWord) params.append("wholeword", "1")
  if (matchPath) params.append("path", "1")
  if (regex) params.append("regex", "1")

  return {
    params,
    maxResults,
    sort,
    ascending,
    skipServerSort,
  }
}

/** 单次 Everything HTTP 请求（URL 组装与超时集中在此，避免多处重复 fetch 参数） */
async function requestEverything(
  config: EverythingConfig,
  params: URLSearchParams,
  timeoutMs: number,
): Promise<Response> {
  return fetch(
    `http://${config.host}:${config.port}/?${params.toString()}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    },
  )
}

/**
 * 完整结果集（`totalResults` ≤ 本次请求的 count）时按用户选择的排序重排，弥补服务端排序缺失；
 * 分页截断的局部切片无法还原全局顺序，保持原顺序。
 */
function sortIfComplete(
  data: RawResponse,
  items: RawEverythingItem[],
  plan: SearchPlan,
): RawEverythingItem[] {
  const total = data?.totalResults
  if (typeof total !== "number" || !Number.isFinite(total) || total > plan.maxResults) return items
  return sortEverythingItems(items, plan.sort, plan.ascending)
}

/**
 * 降级重试：部分 Everything 版本（实测 1.4.1.1032）的 HTTP 服务对 sort=path/size/date_modified
 * 异常返回空结果（官方文档宣称支持，仅 sort=name 可用），导致搜索永远「无结果」。
 * 去掉排序参数按服务端默认排序重试一次；重试有结果则记录缺陷，后续搜索不再下发排序。
 *
 * @returns 重排后的条目；重试失败 / 仍为空时返回空数组（保持首次请求的空结果）
 */
async function retryWithoutServerSort(
  config: EverythingConfig,
  plan: SearchPlan,
): Promise<RawEverythingItem[]> {
  const params = new URLSearchParams(plan.params)
  params.delete("sort")
  params.delete("ascending")

  log.warn(
    `sort=${plan.sort} 返回空结果，疑似当前 Everything 版本 HTTP 服务不支持该排序，已降级为默认排序重试`,
  )

  try {
    const response = await requestEverything(config, params, SEARCH_TIMEOUT_MS)
    if (!response.ok) return []
    const data: RawResponse = await response.json()
    const items = data?.results ?? []
    if (items.length === 0) return []
    sortServerUnsupported = true
    return sortIfComplete(data, items, plan)
  } catch (error) {
    // 降级重试失败不影响首次请求的结果（保持空结果原样返回）
    log.warn("降级重试失败", error)
    return []
  }
}

/**
 * 搜索文件
 */
export async function searchFiles(
  options: EverythingSearchOptions,
  config: EverythingConfig,
): Promise<EverythingSearchResult[]> {
  const plan = buildSearchPlan(options)

  try {
    const response = await requestEverything(config, plan.params, SEARCH_TIMEOUT_MS)
    if (!response.ok) {
      // 只抛中性的状态码描述：用户可见文案由 UI 层统一加「搜索失败」前缀并 i18n
      throw new Error(`HTTP ${response.status}`)
    }

    const data: RawResponse = await response.json()
    let rawItems = data?.results ?? []

    if (!plan.skipServerSort && plan.sort !== "name" && rawItems.length === 0) {
      rawItems = await retryWithoutServerSort(config, plan)
    } else if (plan.skipServerSort) {
      // 已探测到缺陷：本次请求未下发排序，完整结果集时客户端按用户选择重排
      rawItems = sortIfComplete(data, rawItems, plan)
    }

    return parseSearchResponse({ results: rawItems })
  } catch (error) {
    log.error("搜索失败", error)
    throw error
  }
}
