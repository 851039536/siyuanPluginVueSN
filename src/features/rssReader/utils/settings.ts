/**
 * RSS 设置数值钳制工具
 */

/**
 * 数字设置项钳制：NaN 直接回退 fallback（Math.max/min 链对 NaN 无效，会原样穿透存盘）
 */
export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  const clamped = Math.max(min, Math.min(max, Math.round(value)))
  return Number.isNaN(clamped) ? fallback : clamped
}
