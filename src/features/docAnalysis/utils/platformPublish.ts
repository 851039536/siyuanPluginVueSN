/**
 * 文档分析功能 - 平台发布状态工具
 */
import type { PlatformMeta } from "../types/index"

/** 从 YAML 属性 key 中提取发布平台名（如 custom-csdn-yaml → "csdn"），格式不符或无匹配返回 null */
export function getPlatformIdFromAttrKey(key: string, platformMeta: PlatformMeta[]): string | null {
  if (!key.startsWith("custom-") || !key.endsWith("-yaml")) return null
  const lower = key.toLowerCase()
  for (const meta of platformMeta) {
    if (meta.matchers.some((m) => lower.includes(m))) return meta.id
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

/** 计算文档的未发布平台名称列表 */
export function computeUnpublishedPlatformNames(publishedIds: Set<string>, platformMeta: PlatformMeta[]): string[] | undefined {
  if (publishedIds.size >= platformMeta.length) return undefined
  const names = platformMeta
    .filter((m) => !publishedIds.has(m.id))
    .map((m) => m.name)
  return names.length > 0 ? names : undefined
}
