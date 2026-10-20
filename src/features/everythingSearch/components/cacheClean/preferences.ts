// cacheClean 偏好写入与数值归一（扫描侧另有钳制，此处保证写入存储的值本身合法）

import type {
  CacheCleanMode,
  CacheCleanSettings,
} from "../../types"

/** 偏好数值的合法区间 */
export const MAX_ENTRIES_RANGE: readonly [number, number] = [0, 50000]
export const MIN_AGE_MINUTES_RANGE: readonly [number, number] = [0, 1440]

/** 整数钳制（NaN / 负数 / 小数归一到合法区间） */
export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** 从错误对象取可读文案（非 Error 的原样转字符串，避免误吞未知抛错） */
export function readError(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === "string" ? error : String(error ?? "")
}

/** 偏好写入器集合（模板层直接绑定，无需重复校验数值） */
export interface CacheCleanSetters {
  setMode: (mode: CacheCleanMode) => void
  setMinAgeMinutes: (value: number) => void
  setMaxEntries: (value: number) => void
}

/** 构建三个偏好写入器（只做钳制与转发，落盘交给父层 updateSettings） */
export function buildCacheCleanSetters(
  updateSettings: <K extends keyof CacheCleanSettings>(key: K, value: CacheCleanSettings[K]) => void,
): CacheCleanSetters {
  return {
    setMode: (mode) => updateSettings("mode", mode),
    setMinAgeMinutes: (value) => updateSettings(
      "minAgeMinutes",
      clampInt(value, ...MIN_AGE_MINUTES_RANGE),
    ),
    setMaxEntries: (value) => updateSettings(
      "maxEntries",
      clampInt(value, ...MAX_ENTRIES_RANGE),
    ),
  }
}
