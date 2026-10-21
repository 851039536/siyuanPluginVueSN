// 缓存清理执行器：白名单守卫下的删除（回收站优先，绝不降级为永久删除）
//
// 删除前的三道闸（缺一不可，见 `isAllowedCachePath`）：
//   1. `isProtectedPath()` → 系统关键区域一律拒绝
//   2. `isPathInside(白名单根)` → 只能删白名单根**内**的条目
//   3. 不得等于某个根本身 → 不能把整个缓存目录删掉
//
// 删除方式：`recycle` 只走 Electron 主进程回收站 API（零子进程、无脚本），
// 不可用时记 failed —— **不允许**降级为 `fs.rmSync` 不可逆删除。

import type {
  CacheCleanMode,
  CacheCleanResult,
  CacheEntry,
  CacheRootDef,
  ResolvedCacheRoot,
} from "../types"
import {
  getElectronModules,
  getElectronRemoteShell,
  getNodeFsPathOs,
} from "@/utils/nodeModules"
import { isPathInside, isProtectedPath, normalizeWinPath, readErrorMessage } from "../utils"
import { CACHE_ROOTS, resolveCacheRoots } from "./roots"
import { isAborted, yieldToEventLoop } from "./fsUtils"
import { logInfo, logWarn } from "./log"

/** 失败原因截取条数（全部展示会撑爆提示条） */
const MAX_ERRORS = 10

/**
 * 判定某路径是否允许删除。
 *
 * 三道闸（顺序即短路顺序，`reason` 用于 UI 提示与单测断言）：
 * 1. `isProtectedPath` → `protected`：系统区域一律拒绝
 * 2. 不在任何白名单根内 → `outside`
 * 3. 等于某个根自身 → `root`（只能删根**内**的条目，不能把整个缓存根删掉）
 */
export function isAllowedCachePath(
  candidate: string,
  roots: readonly ResolvedCacheRoot[],
): { allowed: boolean, reason: "outside" | "protected" | "root" | "" } {
  const normalized = normalizeWinPath(candidate)
  if (!normalized) return { allowed: false, reason: "outside" }

  // 闸 1：系统关键路径
  if (isProtectedPath(normalized)) return { allowed: false, reason: "protected" }

  // 闸 2 + 3：白名单包含性（`isPathInside` 对「等于自身」返回 true，故需单独判等）
  for (const root of roots) {
    if (!isPathInside(normalized, root.path)) continue
    if (normalizeWinPath(root.path).toLowerCase() === normalized.toLowerCase()) {
      return { allowed: false, reason: "root" }
    }
    return { allowed: true, reason: "" }
  }

  return { allowed: false, reason: "outside" }
}

/** 清理选项 */
export interface CleanCacheOptions {
  /** 要删除的条目（只允许落在白名单根内） */
  entries: readonly CacheEntry[]
  /** 清理方式：回收站（默认，可还原）/ 永久删除 */
  mode: CacheCleanMode
  /** 根定义（默认 `CACHE_ROOTS`；守卫用其解析结果） */
  roots?: readonly CacheRootDef[]
  /** 取消信号 */
  signal?: AbortSignal
  /** 进度回调（每处理一条一次） */
  onProgress?: (done: number, total: number) => void
}

/**
 * 清理缓存条目（**带三重守卫**，见 {@link isAllowedCachePath}）。
 *
 * ⚠️ 关键约束：`recycle` 模式**绝不降级为永久删除**。
 * 回收站 API 不可用时该条目记 `failed`，宁可提示失败，也不静默改为不可逆删除。
 */
export async function cleanCacheEntries(options: CleanCacheOptions): Promise<CacheCleanResult> {
  const startedAt = Date.now()
  const { entries, mode, signal } = options
  const resolvedRoots = resolveCacheRoots(options.roots ?? CACHE_ROOTS)
  const result: CacheCleanResult = {
    deleted: 0,
    failed: 0,
    freed: 0,
    errors: [],
    cancelled: false,
  }

  const pushError = (message: string) => {
    // 只记前 MAX_ERRORS 条：与面板提示条同口径，避免批量失败时刷爆控制台
    if (result.errors.length < MAX_ERRORS) {
      result.errors.push(message)
      logWarn("条目处理失败", message)
    }
  }

  const total = entries.length
  let done = 0
  /** 回收站通道名（首次成功时记录，用于排查「为什么删不掉」） */
  let recycleChannel = ""

  logInfo("清理开始", { entries: total, mode, resolvedRoots: resolvedRoots.length })

  for (const entry of entries) {
    if (isAborted(signal)) {
      result.cancelled = true
      break
    }

    const gate = isAllowedCachePath(entry.path, resolvedRoots)
    if (!gate.allowed) {
      result.failed++
      pushError(`${entry.path}: ${gate.reason}`)
      done++
      options.onProgress?.(done, total)
      continue
    }

    try {
      if (mode === "recycle") {
        const channel = await trashToRecycleBin(entry.path)
        if (!recycleChannel) {
          recycleChannel = channel
          logInfo(`回收站通道：${channel}`)
        }
      } else {
        deletePermanently(entry.path)
      }
      result.deleted++
      if (Number.isFinite(entry.size) && entry.size > 0) result.freed += entry.size
    } catch (error) {
      result.failed++
      pushError(`${entry.path}: ${readErrorMessage(error)}`)
    }

    done++
    options.onProgress?.(done, total)
    // 每 20 条让出一次事件循环，避免长任务卡住渲染进程
    if (done % 20 === 0) await yieldToEventLoop()
  }

  logInfo("清理结束", {
    deleted: result.deleted,
    failed: result.failed,
    freed: result.freed,
    cancelled: result.cancelled,
    elapsed: Date.now() - startedAt,
  })

  return result
}

/** 可用的回收站通道（按优先级排列；两者都取自 `@/utils/nodeModules` 的统一入口） */
interface RecycleChannel {
  name: string
  shell: {
    trashItem?: (path: string) => Promise<void>
    moveItemToTrash?: (path: string) => boolean
  }
}

/** 探测可用通道：remote（主进程桥接）优先，local（渲染进程 shell）兜底 */
function listRecycleChannels(): RecycleChannel[] {
  const channels: RecycleChannel[] = []
  const remote = getElectronRemoteShell()
  if (remote) channels.push({ name: "remote", shell: remote })
  const local = getElectronModules()?.shell
  if (local) channels.push({ name: "local", shell: local })
  return channels
}

/**
 * 移入系统回收站（Electron 主进程 API），返回实际使用的通道名。
 *
 * 刻意**不用** PowerShell/cmd 脚本 —— 那套行为特征会被企业安全软件判定为可疑删除并上报。
 * 通道存在但操作失败（返回 false / 抛错）时直接向上抛，**不**静默换下一条：
 * 那会把「权限被策略禁用」伪装成「已删除」。
 */
async function trashToRecycleBin(targetPath: string): Promise<string> {
  // 纯 Node 环境（单测）没有 window，shell 必然不可用 —— 直接抛错，由调用方记 failed
  if (typeof window === "undefined") {
    throw new Error("recycle-bin unavailable (non-Electron environment)")
  }

  for (const channel of listRecycleChannels()) {
    const { shell } = channel
    if (typeof shell.trashItem === "function") {
      await shell.trashItem(targetPath)
      return `${channel.name}.trashItem`
    }
    if (typeof shell.moveItemToTrash === "function") {
      if (!shell.moveItemToTrash(targetPath)) {
        throw new Error(`${channel.name}.moveItemToTrash returned false`)
      }
      return `${channel.name}.moveItemToTrash`
    }
  }

  throw new Error("recycle-bin unavailable")
}

/** 永久删除（仅在用户显式选择 permanent 模式时调用） */
function deletePermanently(targetPath: string): void {
  const fsPathOs = getNodeFsPathOs()
  if (!fsPathOs) throw new Error("no file system available")
  fsPathOs.fs.rmSync(targetPath, {
    recursive: true,
    force: true,
    maxRetries: 2,
    retryDelay: 100,
  })
}
