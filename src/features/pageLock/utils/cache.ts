import { DEFAULT_OPTIONS } from '../types'

export const CACHE_EXPIRE_TIME = DEFAULT_OPTIONS.cacheExpireTime
export const MAX_CACHE_SIZE = DEFAULT_OPTIONS.maxCacheSize

const maskCache = new Map<string, { element: HTMLElement; timestamp: number }>()
const lockStateCache = new Map<string, { isLocked: boolean; timestamp: number }>()

export function cleanupCacheEntry<K, V>(cache: Map<K, { value: V; timestamp: number }>) {
  const now = Date.now()

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRE_TIME) {
      cache.delete(key)
    }
  }

  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries())
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
    cache.clear()
    entries.slice(0, MAX_CACHE_SIZE).forEach(([key, entry]) => {
      cache.set(key, entry)
    })
  }
}

export function cleanupCache() {
  const now = Date.now()

  for (const [key, entry] of maskCache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRE_TIME) {
      maskCache.delete(key)
    }
  }

  for (const [key, entry] of lockStateCache.entries()) {
    if (now - entry.timestamp > CACHE_EXPIRE_TIME) {
      lockStateCache.delete(key)
    }
  }

  if (maskCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(maskCache.entries())
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
    maskCache.clear()
    entries.slice(0, MAX_CACHE_SIZE).forEach(([key, entry]) => {
      maskCache.set(key, entry)
    })
  }

  if (lockStateCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(lockStateCache.entries())
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
    lockStateCache.clear()
    entries.slice(0, MAX_CACHE_SIZE).forEach(([key, entry]) => {
      lockStateCache.set(key, entry)
    })
  }
}

export async function getCachedLockState(docId: string): Promise<boolean | null> {
  const cacheKey = docId
  const cached = lockStateCache.get(cacheKey)
  const now = Date.now()

  if (cached && (now - cached.timestamp) < CACHE_EXPIRE_TIME) {
    return cached.isLocked
  }

  return null
}

export function setCachedLockState(docId: string, isLocked: boolean) {
  const cacheKey = docId
  lockStateCache.set(cacheKey, { isLocked, timestamp: Date.now() })
  cleanupCache()
}

export function getCachedMask(docId: string): HTMLElement | null {
  const cacheKey = docId
  const cached = maskCache.get(cacheKey)
  const now = Date.now()

  if (cached && (now - cached.timestamp) < CACHE_EXPIRE_TIME) {
    cached.timestamp = now
    return cached.element
  }

  return null
}

export function setCachedMask(docId: string, element: HTMLElement) {
  const cacheKey = docId
  maskCache.set(cacheKey, { element, timestamp: Date.now() })
  cleanupCache()
}
