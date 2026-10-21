// 缓存扫描器（只读）：遍历白名单根下的条目并统计体积
//
// 安全模型（本文件负责前两层，删除守卫在 `cleaner.ts`）：
//   1. 扫描范围：只遍历 `CACHE_ROOTS` 解析出的固定目录，不接受任意输入路径
//   2. 扫描期排除：进入目录前 `isProtectedPath()` 复核；跳过符号链接/junction（防循环与跨盘）
//
// 本文件**不 import 任何会触达 siyuan / DOM 的模块**（才能在纯 Node 单测中加载）。

import type { Dirent, Stats } from "node:fs"
import type {
  CacheEntry,
  CacheRootDef,
  CacheRootId,
  CacheRootScanResult,
  CacheScanProgress,
  CacheScanResult,
} from "../types"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { isProtectedPath, normalizeWinPath, summarizeSize } from "../utils"
import { CACHE_ROOTS, resolveCacheRoots } from "./roots"
import { isAborted, measureDirectorySize, yieldToEventLoop } from "./fsUtils"
import { logInfo, logWarn } from "./log"

/** 默认单根条目上限（防止临时目录海量小文件拖垮面板与内存） */
export const DEFAULT_MAX_ENTRIES = 3000

/** 收集阶段的过量采样倍数：先收 `maxEntries × N` 条候选，排序后再裁到目标上限 */
const COLLECT_OVERSAMPLE = 8

/** 扫描选项 */
export interface ScanCacheOptions {
  /** 要扫描的根定义（默认 `CACHE_ROOTS`） */
  roots?: readonly CacheRootDef[]
  /** 单根条目上限（默认 {@link DEFAULT_MAX_ENTRIES}） */
  maxEntries?: number
  /** 只收集「最后修改早于 N 分钟」的条目（0/缺省 = 不过滤） */
  minAgeMinutes?: number
  /** 取消信号（触发后尽快返回，保留已完成部分） */
  signal?: AbortSignal
  /** 进度回调（每个根开始前与结束后各一次） */
  onProgress?: (progress: CacheScanProgress) => void
}

/**
 * 扫描缓存根目录：**只读**，不做任何修改。
 *
 * 返回结果按体积降序；单根条目数受 `maxEntries` 限制（`truncated` 标记）。
 * 目录不存在 / 无权限 / 无 Node 环境都会得到带 `message` 的空结果，而不是抛错。
 */
export async function scanCacheRoots(options: ScanCacheOptions = {}): Promise<CacheScanResult> {
  const startedAt = Date.now()
  const defs = options.roots ?? CACHE_ROOTS
  const maxEntries = options.maxEntries && options.maxEntries > 0
    ? options.maxEntries
    : DEFAULT_MAX_ENTRIES
  const minAgeMinutes = options.minAgeMinutes && options.minAgeMinutes > 0
    ? options.minAgeMinutes
    : 0
  const minAgeMs = minAgeMinutes * 60_000
  const signal = options.signal

  const resolvedRoots = resolveCacheRoots(defs)
  const total = defs.length
  let done = 0

  const results: CacheRootScanResult[] = []
  logInfo("扫描开始", {
    roots: defs.map(def => def.id),
    resolvedDirs: resolvedRoots.length,
    maxEntries,
    minAgeMinutes,
  })

  for (const def of defs) {
    if (isAborted(signal)) break
    options.onProgress?.({ done, total, current: def.id })

    const paths = resolvedRoots.filter(root => root.def.id === def.id).map(root => root.path)
    if (paths.length === 0) {
      logWarn(`根目录不存在，跳过：${def.id}`)
      results.push(emptyRootResult(def.id, "", "missing"))
      done++
      options.onProgress?.({ done, total, current: def.id })
      continue
    }

    // 同一 def 可能解析出多个目录（如浏览器多厂商）：逐个扫，再合并裁剪
    const merged: CacheRootScanResult = emptyRootResult(def.id, paths[0], "")

    for (const rootPath of paths) {
      if (isAborted(signal)) break
      const part = scanSingleRoot(rootPath, def.id, maxEntries, minAgeMs, signal)
      // 合计不在此累加：多候选合并后要按「裁剪后实际保留的条目」重算，见下方统一重算
      merged.entries.push(...part.entries)
      if (part.truncated) merged.truncated = true
      if (part.message) merged.message = part.message
      logInfo(`根目录扫描完成：${def.id}`, {
        path: rootPath,
        entries: part.entries.length,
        bytes: part.size,
        truncated: part.truncated,
        message: part.message || undefined,
      })
      // 让出事件循环：单根扫描可能包含上万次同步 IO
      await yieldToEventLoop()
      if (isAborted(signal)) break
    }

    merged.entries.sort((a, b) => b.size - a.size)
    if (merged.entries.length > maxEntries) {
      merged.entries.length = maxEntries
      merged.truncated = true
    }
    // 条目被截断后，合计按实际保留的条目重算，避免「面板合计」与「可清理项」不一致
    const mergedSummary = summarizeSize(merged.entries)
    merged.size = mergedSummary.size
    merged.files = mergedSummary.files

    results.push(merged)
    done++
    options.onProgress?.({ done, total, current: def.id })
  }

  // 未扫描的根补空结果（取消时保持结构完整，UI 无需判空）
  for (const def of defs.slice(results.length)) {
    results.push(emptyRootResult(def.id, "", "pending"))
  }

  const roots = results.sort((a, b) => b.size - a.size)
  // 合计按各根已汇总的值累加（`summarizeSize` 统计的是「数组元素个数」，不适用于根这一层）
  const size = roots.reduce((sum, root) => sum + root.size, 0)
  const files = roots.reduce((sum, root) => sum + root.files, 0)
  const cancelled = isAborted(signal)
  const elapsed = Date.now() - startedAt
  logInfo("扫描结束", { roots: roots.length, size, files, elapsed, cancelled })

  return {
    roots,
    size,
    files,
    elapsed,
    cancelled,
  }
}

/** 空的单根结果（`missing` / `pending` / `denied` 等场景共用，避免四处重复字面量） */
function emptyRootResult(
  rootId: CacheRootId,
  path: string,
  message: string,
): CacheRootScanResult {
  return {
    rootId,
    path,
    message,
    size: 0,
    files: 0,
    entries: [],
    truncated: false,
  }
}

/**
 * 扫描单个根目录。
 * @returns 单根结果；根不可读时返回带 `message` 的结果（不抛）
 */
function scanSingleRoot(
  rootPath: string,
  rootId: CacheRootId,
  maxEntries: number,
  minAgeMs: number,
  signal: AbortSignal | undefined,
): CacheRootScanResult {
  const fsPathOs = getNodeFsPathOs()
  if (!fsPathOs) return emptyRootResult(rootId, rootPath, "no-node")

  let entries: Dirent[]
  try {
    entries = fsPathOs.fs.readdirSync(rootPath, { withFileTypes: true })
  } catch {
    return emptyRootResult(rootId, rootPath, "denied")
  }

  const collected: CacheEntry[] = []
  let truncated = false
  const now = Date.now()
  // 收集上限 = 目标上限 × 采样倍数：先收够候选再按体积裁剪，
  // 否则「上限」会退化成「目录枚举顺序里的前 N 个」而不是「最大的 N 个」。
  const collectLimit = maxEntries * COLLECT_OVERSAMPLE

  for (const entry of entries) {
    if (isAborted(signal)) break
    if (collected.length >= collectLimit) {
      truncated = true
      break
    }
    // 根目录下的符号链接 / junction 跳过
    if (entry.isSymbolicLink()) continue

    const childPath = `${rootPath}\\${entry.name}`
    // 复核：命中系统区域的条目不收集（即使白名单被误配）
    if (isProtectedPath(childPath)) continue

    let stats: Stats
    try {
      stats = fsPathOs.fs.statSync(childPath)
    } catch {
      continue
    }

    // 目录类型以 dirent 为准，遇到 DT_UNKNOWN 的文件系统再用 stat 兜底
    const isDirectory = entry.isDirectory() || stats.isDirectory()
    if (!isDirectory && !entry.isFile()) continue

    const modifiedTime = Number.isFinite(stats.mtimeMs) ? stats.mtimeMs : 0
    // 年龄门槛：跳过「近期改动」的条目（可能正被程序使用）。
    // 目录同样按自身 mtime 判定 —— 目录 mtime 更新说明里面刚有增删。
    if (minAgeMs > 0 && modifiedTime > 0 && now - modifiedTime < minAgeMs) continue

    const size = isDirectory
      ? measureDirectorySize(childPath, 0, signal)
      : (Number.isFinite(stats.size) && stats.size > 0 ? stats.size : 0)

    collected.push({
      path: normalizeWinPath(childPath),
      name: entry.name,
      isDirectory,
      size,
      modifiedTime,
      rootId,
    })
  }

  collected.sort((a, b) => b.size - a.size)
  const { size, files } = summarizeSize(collected)

  return {
    rootId,
    path: rootPath,
    message: "",
    size,
    files,
    entries: collected,
    truncated,
  }
}
