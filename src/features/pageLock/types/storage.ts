import type { PageLockInfo } from './index'

export interface PageLockStorageData {
  [docId: string]: PageLockInfo
}

export interface CacheEntry<T> {
  value: T
  timestamp: number
}

export interface MaskCacheEntry {
  element: HTMLElement
  timestamp: number
}

export interface LockStateCacheEntry {
  isLocked: boolean
  timestamp: number
}
