/**
 * 文档分析功能 - 平台发布状态工具
 */
import { sql } from "@/api"
import type { PlatformMeta } from "../types/index"
import { SIZE_WORDCOUNT_SUBQUERY } from "./sqlConstants"

/** 从 YAML 属性 key 中提取发布平台名（如 custom-csdn-yaml → "csdn"），格式不符或无匹配返回 null；全程小写比较，兼容大写 matcher */
export function getPlatformIdFromAttrKey(key: string, platformMeta: PlatformMeta[]): string | null {
  const lower = key.toLowerCase()
  if (!lower.startsWith("custom-") || !lower.endsWith("-yaml")) return null
  for (const meta of platformMeta) {
    if (meta.matchers.some((m) => lower.includes(m.toLowerCase()))) return meta.id
  }
  return null
}

/**
 * 查询并聚合各文档已发布平台集合（docId → Set<platformId>）。
 * 分析与平台过滤下钻共用同一套 SQL + 判定逻辑，消除两处实现的语义漂移。
 */
export async function fetchDocPlatformSets(
  notebookCondition: string,
  platformMeta: PlatformMeta[],
  limit = 10000,
): Promise<Map<string, Set<string>>> {
  const docMap = new Map<string, Set<string>>()
  const allDocs = await sql(`
    SELECT b.id FROM blocks b
    LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
    WHERE b.type = 'd' AND COALESCE(sw.total_size, 0) > 0 ${notebookCondition}
    LIMIT ${limit}
  `)
  if (!allDocs?.length) return docMap
  for (const doc of allDocs) docMap.set(String(doc.id), new Set())

  const yamlRows = await sql(`
    SELECT block_id, name FROM attributes
    WHERE name LIKE '%yaml%'
    AND block_id IN (
      SELECT b.id FROM blocks b
      LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
      WHERE b.type = 'd' AND COALESCE(sw.total_size, 0) > 0 ${notebookCondition}
    )
    LIMIT 50000
  `)
  if (yamlRows) {
    for (const row of yamlRows) {
      const id = String(row.block_id)
      const pid = getPlatformIdFromAttrKey(String(row.name), platformMeta)
      if (!pid) continue
      const set = docMap.get(id)
      if (set) set.add(pid)
    }
  }
  return docMap
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
