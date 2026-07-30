/**
 * 文档分析功能 - 平台发布状态工具
 */
import type { PlatformMeta } from "../types/index"

/** 从 YAML 属性 key 中提取发布平台名（如 custom-csdn-yaml → "csdn"），格式不符或无匹配返回 null；全程小写比较，兼容大写 matcher */
export function getPlatformIdFromAttrKey(key: string, platformMeta: PlatformMeta[]): string | null {
  const lower = key.toLowerCase()
  if (!lower.startsWith("custom-") || !lower.endsWith("-yaml")) return null
  for (const meta of platformMeta) {
    if (meta.matchers.some((m) => lower.includes(m.toLowerCase()))) return meta.id
  }
  return null
}

/** 从属性对象（getBlockAttrs 返回值）中提取已发布平台 ID 集合 */
export function getPublishedPlatformIdsFromAttrs(attrs: Record<string, string> | null, platformMeta: PlatformMeta[]): Set<string> {
  const ids = new Set<string>()
  if (!attrs) return ids
  for (const key of Object.keys(attrs)) {
    if (!attrs[key]?.trim()) continue
    const id = getPlatformIdFromAttrKey(key, platformMeta)
    if (id) ids.add(id)
  }
  return ids
}

/** 计算文档的未发布平台名称列表（全部已发布返回 undefined） */
export function computeUnpublishedPlatformNames(publishedIds: Set<string>, platformMeta: PlatformMeta[]): string[] | undefined {
  const names = platformMeta
    .filter((m) => !publishedIds.has(m.id))
    .map((m) => m.name)
  return names.length > 0 ? names : undefined
}
