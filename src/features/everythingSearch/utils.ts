// everythingSearch 纯函数层：Everything 查询组装、Windows 路径安全判定、缓存结果聚合
// 本文件不依赖 Vue / siyuan / 任何 IO，可在纯 Node 环境单测（见 utils.spec.ts）。

import type {
  CacheEntry,
  CacheScanResult,
} from "./types"

/** 文件大小过滤单位 */
export type SizeUnit = "KB" | "MB" | "GB"

/** `buildSearchQuery` 入参：UI 搜索选项的一个切片（不含与查询表达式无关的字段） */
export interface SearchQueryInput {
  /** 用户输入的关键词（可为空，仅路径过滤时也会发起搜索） */
  query?: string
  /** 空文件夹模式：追加 `empty:` 并跳过大小过滤（空文件夹 size 恒为 0） */
  emptyFolders?: boolean
  /** 最小文件大小（0 = 不启用） */
  minSize?: number
  minSizeUnit?: SizeUnit
  maxSize?: number
  maxSizeUnit?: SizeUnit
  includePathsEnabled?: boolean
  includePaths?: string[]
  excludePathsEnabled?: boolean
  excludePaths?: string[]
}

/** 路径过滤是否生效（开关开启且至少一条非空路径） */
export function hasPathFilter(input: {
  includePathsEnabled?: boolean
  includePaths?: string[]
  excludePathsEnabled?: boolean
  excludePaths?: string[]
}): boolean {
  return (!!input.includePathsEnabled && (input.includePaths ?? []).some(p => p.trim() !== ""))
    || (!!input.excludePathsEnabled && (input.excludePaths ?? []).some(p => p.trim() !== ""))
}

/**
 * 把 Everything 路径包成 `path:"..."`（或否定式 `!path:"..."`）。
 *
 * Everything 的引号是语法定界符：路径里若含 `"` 会把表达式提前截断并让整条查询失效，
 * 故此处直接剔除内嵌引号（Windows 合法文件路径本就禁止 `"`，剔除不会误伤真实路径）。
 */
function quotePathSegment(prefix: string, path: string): string {
  return `${prefix}path:"${path.replace(/"/g, "")}"`
}

/**
 * 组装 Everything 搜索表达式。
 *
 * 整改前该职责被拆成两处（`index.vue` 拼 `size:`、`api.ts` 拼 `path:`），
 * 顺序与空格都靠调用方保证；现收敛为单一纯函数，便于断言与复用。
 *
 * 表达式顺序固定为：关键词 → 大小过滤 → 仅搜索路径 → 排除路径，保证输出可预测。
 */
export function buildSearchQuery(input: SearchQueryInput): string {
  const parts: string[] = []
  const keyword = (input.query ?? "").trim()
  if (keyword) parts.push(keyword)

  if (input.emptyFolders) {
    // 空文件夹 size 必为 0，大小过滤会把结果全部滤掉，故本模式一律跳过
    parts.push("empty:")
  } else {
    if (input.minSize && input.minSize > 0) {
      parts.push(`size:>${input.minSize}${(input.minSizeUnit ?? "KB").toLowerCase()}`)
    }
    if (input.maxSize && input.maxSize > 0) {
      parts.push(`size:<${input.maxSize}${(input.maxSizeUnit ?? "KB").toLowerCase()}`)
    }
  }

  if (input.includePathsEnabled) {
    for (const path of input.includePaths ?? []) {
      const trimmed = path.trim()
      if (trimmed) parts.push(quotePathSegment("", trimmed))
    }
  }
  if (input.excludePathsEnabled) {
    for (const path of input.excludePaths ?? []) {
      const trimmed = path.trim()
      if (trimmed) parts.push(quotePathSegment("!", trimmed))
    }
  }

  return parts.join(" ")
}

/** 把 Windows 路径归一化为 `C:\a\b` 形式（仅供比较，不改写原始展示路径） */
export function normalizeWinPath(input: string): string {
  let path = (input ?? "").trim()
  if (!path) return ""

  // 长路径前缀：\\?\C:\x → C:\x；\\?\UNC\srv\share → \\srv\share
  if (/^\\\\\?\\UNC\\/i.test(path)) {
    path = `\\\\${path.slice(8)}`
  } else if (path.startsWith("\\\\?\\")) {
    path = path.slice(4)
  }

  path = path.replace(/\//g, "\\")
  // 折叠重复分隔符（保留 UNC 开头的双反斜杠）
  const isUnc = path.startsWith("\\\\")
  path = path.replace(/\\{2,}/g, "\\")
  if (isUnc && !path.startsWith("\\\\")) path = `\\${path}`

  // 盘符统一大写
  path = path.replace(/^([a-z]):/i, (_, drive: string) => `${drive.toUpperCase()}:`)
  // 去掉末尾多余分隔符（保留根路径 `C:\`）
  if (path.length > 3 && path.endsWith("\\")) path = path.slice(0, -1)
  return path
}

/** 盘符根下受保护的一级目录（小写比较） */
const PROTECTED_ROOT_DIRS = [
  "windows",
  "windows.old",
  "program files",
  "program files (x86)",
  "programdata",
  "$recycle.bin",
  "system volume information",
  "recovery",
  "boot",
  "perflogs",
  "$windows.~bt",
  "$windows.~ws",
  "msocache",
]

/** 盘符根下的关键系统文件（小写比较；删掉会导致系统无法启动） */
const PROTECTED_ROOT_FILES = [
  "pagefile.sys",
  "hiberfil.sys",
  "swapfile.sys",
  "bootmgr",
  "bootnxt",
  "bootsect.bak",
  "dumpstack.log",
  "dumpstack.log.tmp",
]

/** 出现在路径任意位置都视为系统关键区域的片段（小写比较，含首尾分隔符） */
const PROTECTED_PATH_FRAGMENTS = [
  "\\appdata\\local\\microsoft\\windows\\",
  "\\appdata\\roaming\\microsoft\\windows\\",
  "\\appdata\\local\\packages\\",
  "\\system volume information\\",
  "$recycle.bin\\",
  "\\windows\\system32\\",
  "\\windows\\syswow64\\",
  "\\windows\\winsxs\\",
]

/** 提取盘符后的一级段（`C:\Windows\System32` → `windows`；UNC 或相对路径返回空串） */
function firstSegment(normalized: string): string {
  const matched = /^[A-Z]:\\([^\\]+)/.exec(normalized)
  return matched ? matched[1].toLowerCase() : ""
}

/**
 * 是否为「不可随意删除」的系统关键路径。
 *
 * 覆盖三级：
 * 1. 盘符根下的一级系统目录（`C:\Windows`、`C:\Program Files` …）
 * 2. 盘符根下的关键系统文件（`pagefile.sys`、`bootmgr` …）
 * 3. 任意层级的系统区域片段（`AppData\Local\Microsoft\Windows`、`System32` …）
 *
 * ⚠️ 仅做字符串判定，不做任何文件系统 IO —— 判定本身不会因访问系统文件而抛异常。
 * 这是删除操作的最后一道守卫：即使调用方被绕过，也不允许把系统文件移入回收站。
 */
export function isProtectedPath(rawPath: string): boolean {
  const path = normalizeWinPath(rawPath)
  if (!path) return false
  const lower = path.toLowerCase()

  // 纯盘符根（`C:`）不可删
  if (/^[A-Z]:$/.test(path)) return true

  const rootDir = firstSegment(path)
  if (rootDir && PROTECTED_ROOT_DIRS.includes(rootDir)) {
    // 一级目录本身或其任意子路径
    return true
  }

  // 仅当路径就是盘符根下那一层时才按文件名判定
  const rootFile = /^[A-Z]:(?:\\|$)([^\\]+)$/.exec(path)
  if (rootFile && PROTECTED_ROOT_FILES.includes(rootFile[1].toLowerCase())) return true

  const withTrailing = lower.endsWith("\\") ? lower : `${lower}\\`
  return PROTECTED_PATH_FRAGMENTS.some(fragment => withTrailing.includes(fragment))
}

/**
 * `child` 是否位于 `parent` 目录之内（含 parent 自身）。
 * 用于「只允许删除白名单缓存根目录内的条目」这类包含性校验。
 */
export function isPathInside(child: string, parent: string): boolean {
  const c = normalizeWinPath(child).toLowerCase()
  const p = normalizeWinPath(parent).toLowerCase()
  if (!c || !p) return false
  if (c === p) return true
  const prefix = p.endsWith("\\") ? p : `${p}\\`
  return c.startsWith(prefix)
}

/** 拼接搜索结果项的完整路径（Everything 的 `path` 与 `name` 分段返回） */
export function getFullPath(item: { name: string, path: string }): string {
  const dir = (item.path ?? "").trim()
  const name = item.name ?? ""
  if (!dir) return name
  // 盘符根路径形如 `C:\`，直接拼接会得到 `C:\\name`，故按是否已带分隔符归一
  return dir.endsWith("\\") ? `${dir}${name}` : `${dir}\\${name}`
}

/**
 * 解析 Everything 返回的 `date_modified` 为毫秒时间戳。
 *
 * Everything HTTP 在不同配置下可能给出：Windows FILETIME（100ns 起点 1601）、
 * 毫秒时间戳、秒时间戳或可被 Date 解析的字符串。无法解析返回 null（调用方显示空串）。
 */
export function parseEverythingDate(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null
    if (value > 1e15) {
      // Windows FILETIME：100 纳秒 → 毫秒，再减去 1601-1970 的偏移
      return Math.round(value / 10000 - 11644473600000)
    }
    if (value > 1e12) return Math.round(value)
    if (value > 1e9) return Math.round(value * 1000)
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/** 一条待统计条目（缓存扫描与搜索结果共用的最小形状） */
export interface SizedEntry {
  size?: number
}

/** 聚合条目集合的总体积与文件数（非法/负数尺寸按 0 计，避免 NaN 污染合计） */
export function summarizeSize(entries: readonly SizedEntry[]): { size: number, files: number } {
  let size = 0
  let files = 0
  for (const entry of entries) {
    const value = entry.size
    if (typeof value === "number" && Number.isFinite(value) && value > 0) size += value
    files++
  }
  return { size, files }
}

/** 按字节区间选择 `ProgressBar` 的颜色语义（用量越高越警示） */
export function sizeSeverity(ratio: number): "primary" | "warning" | "danger" {
  if (!Number.isFinite(ratio) || ratio < 0.5) return "primary"
  if (ratio < 0.8) return "warning"
  return "danger"
}

/** 从异常对象取可读文案（非 Error 原样转字符串，避免误吞未知抛错） */
export function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === "string" ? error : String(error ?? "")
}

/** 把扫描结果各根下的条目平铺为一维列表（体积降序；UI 勾选与统计共用同一顺序） */
export function flattenCacheEntries(result: CacheScanResult | null): CacheEntry[] {
  if (!result) return []
  const entries: CacheEntry[] = []
  for (const root of result.roots) entries.push(...root.entries)
  return entries.sort((a, b) => b.size - a.size)
}
