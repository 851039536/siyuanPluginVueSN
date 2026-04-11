import { DEFAULT_OPTIONS } from "../types";

export const CACHE_EXPIRE_TIME = DEFAULT_OPTIONS.cacheExpireTime;
export const MAX_CACHE_SIZE = DEFAULT_OPTIONS.maxCacheSize;

interface CacheEntry<T> {
	value: T;
	timestamp: number;
}

const maskCache = new Map<string, CacheEntry<HTMLElement>>();
const lockStateCache = new Map<string, CacheEntry<boolean>>();

function cleanupSingleCache<T>(cache: Map<string, CacheEntry<T>>) {
	const now = Date.now();
	for (const [key, entry] of cache.entries()) {
		if (now - entry.timestamp > CACHE_EXPIRE_TIME) {
			cache.delete(key);
		}
	}

	if (cache.size > MAX_CACHE_SIZE) {
		const entries = Array.from(cache.entries()).sort(
			(a, b) => b[1].timestamp - a[1].timestamp,
		);
		cache.clear();
		entries
			.slice(0, MAX_CACHE_SIZE)
			.forEach(([key, entry]) => cache.set(key, entry));
	}
}

export function cleanupCache() {
	cleanupSingleCache(maskCache);
	cleanupSingleCache(lockStateCache);
}

export async function getCachedLockState(
	docId: string,
): Promise<boolean | null> {
	const cached = lockStateCache.get(docId);
	if (cached && Date.now() - cached.timestamp < CACHE_EXPIRE_TIME) {
		return cached.value;
	}
	return null;
}

export function setCachedLockState(docId: string, isLocked: boolean) {
	lockStateCache.set(docId, { value: isLocked, timestamp: Date.now() });
	cleanupCache();
}

export function getCachedMask(docId: string): HTMLElement | null {
	const cached = maskCache.get(docId);
	if (cached && Date.now() - cached.timestamp < CACHE_EXPIRE_TIME) {
		cached.timestamp = Date.now();
		return cached.value;
	}
	return null;
}

export function setCachedMask(docId: string, element: HTMLElement) {
	maskCache.set(docId, { value: element, timestamp: Date.now() });
	cleanupCache();
}
