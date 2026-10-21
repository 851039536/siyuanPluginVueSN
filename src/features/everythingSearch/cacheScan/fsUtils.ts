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

/**
 * 递归统计目录的字节体积（只返回体积：条目数与最新 mtime 无人消费，见下）。
 *
 * - 符号链接 / junction 一律跳过（`isSymbolicLink()`），否则可能顺着链接读到别处、
 *   甚至形成环 —— 这既会算错体积，也会让「删除」越出白名单语义。
 * - 权限拒绝 / 文件被占用等异常只跳过该条目，不中断整体统计。
 * - 取消时提前返回已累计部分（调用方本就会丢弃未完成的根结果）。
 */
export function measureDirectorySize(
  dirPath: string,
  depth: number,
  signal?: AbortSignal,
): number {
  const fsPathOs = getNodeFsPathOs()
  if (!fsPathOs) return 0

  let entries: Dirent[]
  try {
    entries = fsPathOs.fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    // 无权限 / 已被删除 / 不是目录
    return 0
  }

  let size = 0
  for (const entry of entries) {
    if (isAborted(signal)) return size
    // 符号链接与 junction 一律跳过（防循环与跨盘）
    if (entry.isSymbolicLink()) continue

    const childPath = `${dirPath}\\${entry.name}`
    // 进入前复核：系统区域即使被误配进白名单也不统计
    if (isProtectedPath(childPath)) continue

    if (entry.isDirectory()) {
      if (depth >= MAX_DEPTH) continue
      size += measureDirectorySize(childPath, depth + 1, signal)
      continue
    }

    let stats: Stats
    try {
      stats = fsPathOs.fs.statSync(childPath)
    } catch {
      // 文件在 readdir 与 stat 之间消失 / 被占用：跳过但不影响其他条目
      continue
    }
    if (Number.isFinite(stats.size) && stats.size > 0) size += stats.size
  }

  return size
}
