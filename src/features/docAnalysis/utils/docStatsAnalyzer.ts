/**
 * 文档分析功能 - 统计维度分析器（纯 SQL 查询 + reactive 赋值）
 */
import { sql } from "@/api"
import type { DocStats, DepthStats, PlatformMeta } from "../types/index"
import { SIZE_WORDCOUNT_SUBQUERY } from "./sqlConstants"

/** 生成 N 天前的 yyyyMMddHHmmss 格式字符串 */
function daysAgoStr(days: number): string {
  const d = new Date(Date.now() - days * 86400000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

// ============================================================
// 各维度分析（通过闭包修改 docStats / depthStats reactive）
// ============================================================

export async function analyzeUpdateTime(notebookCondition: string, docStats: DocStats) {
  try {
    const ts7 = daysAgoStr(7)
    const ts30 = daysAgoStr(30)
    const ts60 = daysAgoStr(60)
    const ts90 = daysAgoStr(90)
    const ts180 = daysAgoStr(180)

    const rows = await sql(`
      SELECT
        SUM(CASE WHEN b.updated >= '${ts7}' THEN 1 ELSE 0 END) as in_7_days,
        SUM(CASE WHEN b.updated >= '${ts30}' AND b.updated < '${ts7}' THEN 1 ELSE 0 END) as in_30_days,
        SUM(CASE WHEN b.updated >= '${ts60}' AND b.updated < '${ts30}' THEN 1 ELSE 0 END) as in_1_to_2_months,
        SUM(CASE WHEN b.updated >= '${ts90}' AND b.updated < '${ts60}' THEN 1 ELSE 0 END) as in_2_to_3_months,
        SUM(CASE WHEN b.updated >= '${ts180}' AND b.updated < '${ts90}' THEN 1 ELSE 0 END) as in_half_year,
        SUM(CASE WHEN b.updated < '${ts180}' THEN 1 ELSE 0 END) as over_half_year
      FROM blocks b
      WHERE b.type = 'd' ${notebookCondition}
    `)
    if (rows?.length > 0) {
      const r = rows[0]
      docStats.updatedIn7Days = r.in_7_days || 0
      docStats.updatedIn30Days = r.in_30_days || 0
      docStats.updatedIn1To2Months = r.in_1_to_2_months || 0
      docStats.updatedIn2To3Months = r.in_2_to_3_months || 0
      docStats.updatedOverHalfYear = r.over_half_year || 0
    }
  } catch (e) { console.error("更新时间分析失败:", e) }
}

export async function analyzeDepth(notebookCondition: string, docStats: DocStats, depthStats: DepthStats) {
  try {
    const rows = await sql(`
      SELECT
        COALESCE(LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1, 0) as depth,
        COUNT(*) as cnt
      FROM blocks b
      WHERE b.type = 'd' ${notebookCondition}
      GROUP BY depth ORDER BY depth ASC
    `)
    if (rows?.length > 0) {
      const distribution = rows.map((r: any) => ({ depth: r.depth || 0, count: r.cnt || 0 }))
      const maxDepth = Math.max(...distribution.map((d) => d.depth))
      const totalDocs = distribution.reduce((s: number, d) => s + d.count, 0)
      const avgDepth = totalDocs > 0
        ? distribution.reduce((s: number, d) => s + d.depth * d.count, 0) / totalDocs
        : 0
      depthStats.depthDistribution = distribution
      depthStats.maxDepth = maxDepth
      depthStats.avgDepth = Math.round(avgDepth * 10) / 10
      docStats.deepDocs = distribution.filter((d) => d.depth >= 5).reduce((s: number, d) => s + d.count, 0)
    }
  } catch (e) { console.error("文档深度分析失败:", e) }
}

export async function analyzeWordCount(notebookCondition: string, docStats: DocStats) {
  try {
    const rows = await sql(`
      SELECT
        SUM(CASE WHEN COALESCE(sw.total_word_count, 0) BETWEEN 0 AND 500 THEN 1 ELSE 0 END) as wc_0_500,
        SUM(CASE WHEN COALESCE(sw.total_word_count, 0) BETWEEN 501 AND 2000 THEN 1 ELSE 0 END) as wc_500_2000,
        SUM(CASE WHEN COALESCE(sw.total_word_count, 0) BETWEEN 2001 AND 5000 THEN 1 ELSE 0 END) as wc_2000_5000,
        SUM(CASE WHEN COALESCE(sw.total_word_count, 0) BETWEEN 5001 AND 10000 THEN 1 ELSE 0 END) as wc_5000_10000,
        SUM(CASE WHEN COALESCE(sw.total_word_count, 0) BETWEEN 10001 AND 20000 THEN 1 ELSE 0 END) as wc_10000_20000,
        SUM(CASE WHEN COALESCE(sw.total_word_count, 0) > 20000 THEN 1 ELSE 0 END) as wc_20000_plus
      FROM blocks b
      LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
      WHERE b.type = 'd' ${notebookCondition}
    `)
    if (rows?.length > 0) {
      const r = rows[0]
      docStats.wordCountDistribution = [
        { label: "0~500字", count: r.wc_0_500 || 0 },
        { label: "500~2000字", count: r.wc_500_2000 || 0 },
        { label: "2000~5000字", count: r.wc_2000_5000 || 0 },
        { label: "5000~1万字", count: r.wc_5000_10000 || 0 },
        { label: "1万~2万字", count: r.wc_10000_20000 || 0 },
        { label: ">2万字", count: r.wc_20000_plus || 0 },
      ]
    }
  } catch (e) { console.error("字数分布分析失败:", e) }
}

export async function analyzeContentScan(
  notebookCondition: string,
  docStats: DocStats,
) {
  const result = { incomingRefDocIds: new Set<string>(), orphanDocIds: new Set<string>() }
  try {
    const allDocs = await sql(`SELECT id FROM blocks WHERE type = 'd' ${notebookCondition} LIMIT 10000`)
    if (!allDocs?.length) return result
    const allDocIds = new Set(allDocs.map((r: any) => String(r.id)))

    const contentRows = await sql(`
      SELECT root_id, markdown FROM blocks
      WHERE type != 'd' AND (markdown LIKE '%((%' OR markdown LIKE '%![%')
      AND root_id IN (SELECT id FROM blocks WHERE type = 'd' ${notebookCondition})
      LIMIT 50000
    `)

    const refDocSet = new Set<string>()
    const imgDocSet = new Set<string>()
    const outgoingSet = new Set<string>()
    const incomingSet = new Set<string>()
    const idPattern = /\(\((\d{14}-[a-z0-9]{7})\b/g
    let totalRefCount = 0
    let totalImgCount = 0

    if (contentRows) {
      for (const row of contentRows) {
        const rootId = String(row.root_id || "")
        const md = String(row.markdown || "")
        if (!rootId || rootId.length < 22) continue

        if (md.includes("((")) {
          refDocSet.add(rootId)
          totalRefCount++
          outgoingSet.add(rootId)
          let match: RegExpExecArray | null
          while ((match = idPattern.exec(md)) !== null) {
            const targetId = match[1]
            if (allDocIds.has(targetId) && targetId !== rootId) incomingSet.add(targetId)
          }
        }
        if (md.includes("!(")) { imgDocSet.add(rootId); totalImgCount++ }
      }
    }

    docStats.refDocs = refDocSet.size
    docStats.totalRefs = totalRefCount
    docStats.imageDocs = imgDocSet.size
    docStats.totalImages = totalImgCount
    docStats.incomingRefDocs = incomingSet.size
    result.incomingRefDocIds = incomingSet

    const hasOutOrIn = new Set([...outgoingSet, ...incomingSet])
    const orphans = new Set<string>()
    for (const id of allDocIds) { if (!hasOutOrIn.has(id)) orphans.add(id) }
    result.orphanDocIds = orphans
    docStats.orphanDocs = orphans.size
  } catch (e) { console.error("内容扫描分析失败:", e) }
  return result
}

export async function analyzeBookmarks(notebookCondition: string, docStats: DocStats) {
  try {
    const rows = await sql(`
      SELECT
        COUNT(DISTINCT a.block_id) as bookmarked_docs,
        SUM(CASE WHEN a.value = '待发布' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN a.value = '已发布' THEN 1 ELSE 0 END) as published_count,
        SUM(CASE WHEN a.value = '不使用' THEN 1 ELSE 0 END) as unused_count,
        SUM(CASE WHEN a.value = '无' THEN 1 ELSE 0 END) as none_count
      FROM attributes a
      WHERE a.name = 'bookmark'
      AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition} LIMIT 50000)
    `)
    if (rows?.length > 0) {
      const r = rows[0]
      docStats.bookmarkedDocs = r.bookmarked_docs || 0
      docStats.pendingPublishDocs = r.pending_count || 0
      docStats.publishedDocs = r.published_count || 0
      docStats.unusedDocs = r.unused_count || 0
      docStats.noneBookmarkDocs = r.none_count || 0
    }

    const customRows = await sql(`
      SELECT a.value, COUNT(DISTINCT a.block_id) as cnt FROM attributes a
      WHERE a.name = 'bookmark'
      AND a.value NOT IN ('待发布', '已发布', '不使用', '无', '')
      AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition} LIMIT 50000)
      GROUP BY a.value ORDER BY cnt DESC LIMIT 8
    `)
    docStats.customBookmarkTop = customRows
      ? customRows.map((r: any) => ({ value: r.value || "", count: r.cnt || 0 }))
      : []
  } catch (e) { console.error("书签分析失败:", e) }
}

export async function analyzePlatformPublish(
  notebookCondition: string,
  docStats: DocStats,
  platformMeta: PlatformMeta[],
  getAllPlatformsMask: () => number,
) {
  const result = {
    platformUnpublishedCounts: {} as Record<string, number>,
    fullPublishDocIds: new Set<string>(),
    noPublishDocIds: new Set<string>(),
  }
  try {
    const allDocs = await sql(`
      SELECT b.id FROM blocks b
      LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
      WHERE b.type = 'd' AND COALESCE(sw.total_size, 0) > 0 ${notebookCondition}
      LIMIT 10000
    `)
    if (!allDocs?.length) return result

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

    const docMap = new Map<string, number>()
    for (const doc of allDocs) docMap.set(String(doc.id), 0)

    const platformBits: [string, number][] = platformMeta.flatMap((p, i) =>
      p.matchers.map((m) => [m, 1 << i] as [string, number]),
    )

    if (yamlRows) {
      for (const row of yamlRows) {
        const id = String(row.block_id)
        if (!docMap.has(id)) continue
        const name = String(row.name).toLowerCase()
        let mask = 0
        for (const [m, bit] of platformBits) {
          if (name.includes(m)) { mask = bit; break }
        }
        if (mask > 0) docMap.set(id, docMap.get(id)! | mask)
      }
    }

    let full = 0; let partial = 0; let no = 0
    const fullSet = new Set<string>()
    const noSet = new Set<string>()
    const pCounts: Record<string, number> = {}
    for (const p of platformMeta) pCounts[p.id] = 0
    const allMask = getAllPlatformsMask()

    for (const [id, mask] of docMap) {
      if (mask === 0) { no++; noSet.add(id); continue }
      if (mask === allMask) { full++; fullSet.add(id) } else { partial++ }
      for (let i = 0; i < platformMeta.length; i++) {
        if (mask & (1 << i)) pCounts[platformMeta[i].id]++
      }
    }

    const inSystem = docMap.size - no
    const unpubCounts: Record<string, number> = {}
    for (const p of platformMeta) unpubCounts[p.id] = inSystem - pCounts[p.id]

    docStats.fullPublishDocs = full; docStats.partialPublishDocs = partial; docStats.noPublishDocs = no
    docStats.platformCounts = pCounts
    result.platformUnpublishedCounts = unpubCounts
    result.fullPublishDocIds = fullSet
    result.noPublishDocIds = noSet
  } catch (e) { console.error("平台发布状态分析失败:", e) }
  return result
}

export async function analyzeContentQuality(notebookCondition: string, docStats: DocStats) {
  const result = { taggedDocIds: new Set<string>() }
  try {
    const tagRows = await sql(`SELECT id FROM blocks WHERE type = 'd' AND tag != '' ${notebookCondition} LIMIT 50000`)
    if (tagRows) for (const row of tagRows) result.taggedDocIds.add(String(row.id))
  } catch (_e) { /* keep 0 */ }
  docStats.taggedDocs = result.taggedDocIds.size

  try {
    const [aliased, memoed] = await Promise.all([
      (async (): Promise<number> => {
        const rows = await sql(`SELECT COUNT(DISTINCT a.block_id) as cnt FROM attributes a WHERE a.name = 'alias' AND a.value != '' AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition})`)
        return rows?.[0]?.cnt ?? 0
      })(),
      (async (): Promise<number> => {
        const rows = await sql(`SELECT COUNT(DISTINCT a.block_id) as cnt FROM attributes a WHERE a.name = 'memo' AND a.value != '' AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition})`)
        return rows?.[0]?.cnt ?? 0
      })(),
    ])
    docStats.aliasedDocs = aliased
    docStats.memoedDocs = memoed
  } catch (e) { console.error("别名/备注统计失败:", e) }
  return result
}
