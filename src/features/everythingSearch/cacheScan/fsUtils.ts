// 缓存扫描/清理的共享底层：目录体积递归统计、取消与让出事件循环的小工具
//
// 供 `scanner.ts`（扫描）与 `cleaner.ts`（清理）共用，避免两个文件各写一份递归。
// 本文件**不 import 任何会触达 siyuan / DOM 的模块**（才能在纯 Node 单测中加载）。

import type { Dirent, Stats } from "node:fs"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { isProtectedPath } from "../utils"

/** 单次递归的最大深度（防病态深目录；正常缓存不会超过 20 层） */
const MAX_DEPTH = 24

/** 扫描/清理是否已取消 */
export function isAborted(signal?: AbortSignal): boolean {
  return !!signal?.aborted
}

/** 让出事件循环：递归 IO 密集时避免长时间阻塞渲染进程 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/** 目录体积累加器 */
export interface SizeAccumulator {
  size: number
  files: number
  /** 目录内最后修改时间的最大值（供年龄门槛判定） */
  latestModified: number
  /** 是否因深度/异常而未能完整统计 */
  partial: boolean
}

/**
 * 递归统计目录体积。
 *
 * - 符号链接 / junction 一律跳过（`isSymbolicLink()`），否则可能顺着链接读到别处、
 *   甚至形成环 —— 这既会算错体积，也会让「删除」越出白名单语义。
 * - 权限拒绝 / 文件被占用等异常只影响该条目，不中断整体统计（`partial` 标记）。
 */
export function measureDirectory(
  dirPath: string,
  depth: number,
  signal?: AbortSignal,
): SizeAccumulator {
  const result: SizeAccumulator = { size: 0, files: 0, latestModified: 0, partial: false }
  const fsPathOs = getNodeFsPathOs()
  if (!fsPathOs) {
    result.partial = true
    return result
  }

  let entries: Dirent[]
  try {
    entries = fsPathOs.fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    // 无权限 / 已被删除 / 不是目录
    result.partial = true
    return result
  }

  for (const entry of entries) {
    if (isAborted(signal)) {
      result.partial = true
      return result
    }
    // 符号链接与 junction 一律跳过（防循环与跨盘）
    if (entry.isSymbolicLink()) continue

    const childPath = `${dirPath}\\${entry.name}`
    // 进入前复核：系统区域即使被误配进白名单也不统计
    if (isProtectedPath(childPath)) continue

    if (entry.isDirectory()) {
      result.files++
      if (depth >= MAX_DEPTH) {
        result.partial = true
        continue
      }
      const nested = measureDirectory(childPath, depth + 1, signal)
      result.size += nested.size
      result.files += nested.files
      result.latestModified = Math.max(result.latestModified, nested.latestModified)
      if (nested.partial) result.partial = true
      continue
    }

    let stats: Stats
    try {
      stats = fsPathOs.fs.statSync(childPath)
    } catch {
      // 文件在 readdir 与 stat 之间消失 / 被占用：跳过但不影响其他条目
      result.partial = true
      continue
    }
    result.files++
    if (Number.isFinite(stats.size) && stats.size > 0) result.size += stats.size
    const modified = stats.mtimeMs
    if (Number.isFinite(modified) && modified > result.latestModified) {
      result.latestModified = modified
    }
  }

  return result
}

/** 从异常对象取可读文案（非 Error 原样转字符串，避免误吞未知抛错） */
export function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === "string" ? error : String(error ?? "")
}
