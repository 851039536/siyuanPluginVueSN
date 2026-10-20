// cacheClean 的扫描/清理任务执行器：只操作传入的状态引用，不持有状态（便于单独推理）

import type {
  Ref,
  ShallowRef,
} from "vue"
import type {
  CacheCleanResult,
  CacheCleanSettings,
  CacheEntry,
  CacheRootId,
  CacheScanProgress,
  CacheScanResult,
  ResolvedCacheRoot,
} from "../../types"
import {
  CACHE_ROOTS,
  resolveCacheRoots,
} from "../../cacheScan/roots"
import {
  cleanCacheEntries,
  scanCacheRoots,
} from "../../cacheScan/scanner"
import { clampInt, MIN_AGE_MINUTES_RANGE, readError } from "./preferences"
import {
  defaultSelection,
  flattenEntries,
  pruneDeletedEntries,
} from "./rows"

/** 清理完成提示的自动消失时长（毫秒）；失败信息不自动消失 */
const CLEAN_FEEDBACK_MS = 8000

/** 可中止任务持有的 AbortController 槽位（取消与卸载共用同一个槽） */
export interface AbortHolder {
  current: AbortController | null
}

export function createAbortHolder(): AbortHolder {
  return { current: null }
}

/** 中止进行中的任务（幂等；终止后立刻置空，避免重复 abort） */
export function abortActive(holder: AbortHolder): void {
  if (holder.current) {
    holder.current.abort()
    holder.current = null
  }
}

/** 任务执行器操作的状态引用集合 */
export interface CacheTaskState {
  roots: ShallowRef<ResolvedCacheRoot[]>
  scanResult: Ref<CacheScanResult | null>
  scanStatus: Ref<"idle" | "scanning">
  scanProgress: Ref<CacheScanProgress | null>
  scanError: Ref<string>
  scanCancelled: Ref<boolean>
  selected: Ref<Set<string>>
  cleaning: Ref<boolean>
  cleanProgress: Ref<{ done: number, total: number } | null>
  cleanResult: Ref<CacheCleanResult | null>
  cleanError: Ref<string>
  confirmVisible: Ref<boolean>
}

/** 执行器运行时依赖（全部以 getter/回调传入，执行器自身不持有任何 ref） */
export interface CacheTaskRuntime {
  state: CacheTaskState
  settings: () => CacheCleanSettings
  isRootEnabled: (id: CacheRootId) => boolean
  selectedEntries: () => CacheEntry[]
  abortHolder: AbortHolder
  /** 清空上一次的反馈自动消失定时器 */
  clearFeedbackTimer: () => void
  /** 注册「成功提示自动消失」定时器 */
  scheduleFeedbackClear: (callback: () => void, delayMs: number) => void
}

/**
 * 扫描：仅扫描已勾选的分类。
 * 取消时保留已完成部分（`cancelled` 由扫描侧给出），且不重置勾选集合。
 */
export async function runScan(rt: CacheTaskRuntime): Promise<void> {
  const state = rt.state
  if (state.scanStatus.value === "scanning" || state.cleaning.value) return

  const settings = rt.settings()
  const enabledDefs = CACHE_ROOTS.filter(def => rt.isRootEnabled(def.id))
  state.scanError.value = ""
  state.scanCancelled.value = false
  state.cleanResult.value = null
  state.cleanError.value = ""
  rt.clearFeedbackTimer()

  if (enabledDefs.length === 0) {
    // 一个分类都没勾：直接给空结果，避免把「没得扫」呈现成「扫描失败」
    state.scanResult.value = { roots: [], size: 0, files: 0, elapsed: 0, cancelled: false }
    state.selected.value = new Set()
    return
  }

  abortActive(rt.abortHolder)
  const controller = new AbortController()
  rt.abortHolder.current = controller
  state.scanStatus.value = "scanning"
  state.scanProgress.value = { done: 0, total: enabledDefs.length, current: null }
  try {
    const result = await scanCacheRoots({
      roots: enabledDefs,
      maxEntries: settings.maxEntries > 0 ? settings.maxEntries : undefined,
      minAgeMinutes: clampInt(settings.minAgeMinutes, ...MIN_AGE_MINUTES_RANGE),
      signal: controller.signal,
      onProgress: (progress) => {
        state.scanProgress.value = progress
      },
    })
    state.scanResult.value = result
    state.scanCancelled.value = result.cancelled
    if (!result.cancelled) {
      state.roots.value = resolveCacheRoots()
      state.selected.value = defaultSelection(result, CACHE_ROOTS)
    }
  } catch (error) {
    if (controller.signal.aborted) state.scanCancelled.value = true
    else state.scanError.value = readError(error)
  } finally {
    if (rt.abortHolder.current === controller) rt.abortHolder.current = null
    state.scanStatus.value = "idle"
    state.scanProgress.value = null
  }
}

/**
 * 执行清理（确认弹窗 accept 回调）。
 * 回收站模式失败不降级为永久删除 —— 该约束由扫描侧保证，此处只负责传递 mode。
 */
export async function runClean(rt: CacheTaskRuntime): Promise<void> {
  const state = rt.state
  state.confirmVisible.value = false
  const entries = rt.selectedEntries()
  if (state.cleaning.value || entries.length === 0) return

  rt.clearFeedbackTimer()
  state.cleanResult.value = null
  state.cleanError.value = ""
  const controller = new AbortController()
  rt.abortHolder.current = controller
  state.cleaning.value = true
  state.cleanProgress.value = { done: 0, total: entries.length }
  try {
    const result = await cleanCacheEntries({
      entries,
      mode: rt.settings().mode,
      roots: CACHE_ROOTS,
      signal: controller.signal,
      onProgress: (done, total) => {
        state.cleanProgress.value = { done, total }
      },
    })
    state.cleanResult.value = result
    // 只有全部成功才从列表移除：部分失败时条目仍在磁盘上，必须可见可重试
    if (!result.cancelled && result.failed === 0) {
      if (state.scanResult.value) {
        state.scanResult.value = pruneDeletedEntries(
          state.scanResult.value,
          new Set(entries.map(entry => entry.path)),
        )
      }
      state.selected.value = new Set()
    }
    rt.scheduleFeedbackClear(() => {
      // 成功提示自动消失；失败信息保留给用户排查
      if (!state.cleanError.value) state.cleanResult.value = null
    }, CLEAN_FEEDBACK_MS)
  } catch (error) {
    state.cleanError.value = readError(error)
  } finally {
    if (rt.abortHolder.current === controller) rt.abortHolder.current = null
    state.cleaning.value = false
    state.cleanProgress.value = null
  }
}

/** 扫描结果平铺（供容器直接渲染条目明细） */
export function listEntries(result: CacheScanResult | null): CacheEntry[] {
  return flattenEntries(result)
}
