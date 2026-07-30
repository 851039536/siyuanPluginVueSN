// 页面锁定状态缓存：内存缓存文档锁定状态，带过期时间与容量上限，定期清理

import { DEFAULT_OPTIONS } from "../types"

export const CACHE_EXPIRE_TIME = DEFAULT_OPTIONS.cacheExpireTime
export const MAX_CACHE_SIZE = DEFAULT_OPTIONS.maxCacheSize
export const CACHE_CLEANUP_INTERVAL = DEFAULT_OPTIONS.cacheCleanupInterval

interface CacheEntry<T> {
  value: T
  timestamp: number
}

const lockStateCache = new Map<string, CacheEntry<boolean>>()

function cleanupSingleCache<T>(cache: Map<string, CacheEntry<T>>) {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRE_TIME) {
      cache.delete(key)
    }
  }

  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries()).sort(
      (a, b) => b[1].timestamp - a[1].timestamp,
    )
    cache.clear()
    entries
      .slice(0, MAX_CACHE_SIZE)
      .forEach(([key, entry]) => cache.set(key, entry))
  }
}

export function cleanupCache() {
  cleanupSingleCache(lockStateCache)
}

/** 清空全部缓存（功能卸载时调用） */
export function clearAllCache() {
  lockStateCache.clear()
}

export function getCachedLockState(docId: string): boolean | null {
  const cached = lockStateCache.get(docId)
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRE_TIME) {
    return cached.value
  }
  return null
}

export function setCachedLockState(docId: string, isLocked: boolean) {
  lockStateCache.set(docId, {
    value: isLocked,
    timestamp: Date.now(),
  })
}
