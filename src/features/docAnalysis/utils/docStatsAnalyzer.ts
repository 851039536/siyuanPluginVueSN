/**
 * 文档分析功能 - 统计维度分析器（纯 SQL 查询 + reactive 赋值）
 */
import { sql } from "@/api"
import type { DocStats, DepthStats, PlatformMeta } from "../types/index"
import { TIME_BIN_DAYS } from "./categoryQueryConfig"
import { daysAgoStr } from "./sqlHelpers"
import { fetchDocPlatformSets } from "./platformPublish"
import { SIZE_WORDCOUNT_SUBQUERY, DOC_DEPTH_EXPR } from "./sqlConstants"

/** 字数分布最高档标签（健康度扣分项引用此常量，避免字符串耦合） */
export const WC_TOP_BIN_LABEL = ">2万字"

// ============================================================
// 各维度分析（通过闭包修改 docStats / depthStats reactive）
// ============================================================

export async function analyzeUpdateTime(notebookCondition: string, docStats: DocStats) {
  try {
    const ts7 = daysAgoStr(TIME_BIN_DAYS["7days"])
    const ts30 = daysAgoStr(TIME_BIN_DAYS["30days"])
    const ts60 = daysAgoStr(TIME_BIN_DAYS["1to2month"])
    const ts90 = daysAgoStr(TIME_BIN_DAYS["2to3month"])
    const ts180 = daysAgoStr(TIME_BIN_DAYS.halfYear)

    // 注：90~180 天区间无对应统计桶（UI 无 3~6 月卡片），各桶之和不等于文档总数，属现状设计
    const rows = await sql(`
      SELECT
        SUM(CASE WHEN b.updated >= '${ts7}' THEN 1 ELSE 0 END) as in_7_days,
        SUM(CASE WHEN b.updated >= '${ts30}' AND b.updated < '${ts7}' THEN 1 ELSE 0 END) as in_30_days,
        SUM(CASE WHEN b.updated >= '${ts60}' AND b.updated < '${ts30}' THEN 1 ELSE 0 END) as in_1_to_2_months,
        SUM(CASE WHEN b.updated >= '${ts90}' AND b.updated < '${ts60}' THEN 1 ELSE 0 END) as in_2_to_3_months,
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
  // 先重置，避免空笔记本重新分析时残留上次的深度分布
  depthStats.depthDistribution = []
  depthStats.maxDepth = 0
  depthStats.avgDepth = 0
  try {
    const rows = await sql(`
      SELECT
        COALESCE(${DOC_DEPTH_EXPR}, 0) as depth,
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
        { label: WC_TOP_BIN_LABEL, count: r.wc_20000_plus || 0 },
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
    // 性能护栏：超过 10000 篇文档时截断，引用/孤立统计会存在偏差
    const allDocs = await sql(`SELECT id FROM blocks WHERE type = 'd' ${notebookCondition} LIMIT 10000`)
    if (!allDocs?.length) return result
    const allDocIds = new Set(allDocs.map((r: any) => String(r.id)))

    // 性能护栏：含引用/图片的内容块超过 50000 时截断，统计会存在偏差
    const contentRows = await sql(`
      SELECT root_id, markdown FROM blocks
      WHERE type != 'd' AND (markdown LIKE '%((%' OR markdown LIKE '%![%')
      AND root_id IN (SELECT id FROM blocks WHERE type = 'd' ${notebookCondition})
      LIMIT 50000
    `)

    const refDocSet = new Set<string>()
    const imgDocSet = new Set<string>()
    const incomingSet = new Set<string>()
    const idPattern = /\(\((\d{14}-[a-z0-9]{7})\b/g
    let totalRefCount = 0
    let totalImgCount = 0

    if (contentRows) {
      for (const row of contentRows) {
        const rootId = String(row.root_id || "")
        const md = String(row.markdown || "")
        if (!rootId || rootId.length < 22) continue

        // 以合法块 ID 正则命中为判据，避免正文普通括号文本 "((" 误报为引用
        let hasRef = false
        let match: RegExpExecArray | null
        while ((match = idPattern.exec(md)) !== null) {
          hasRef = true
          const targetId = match[1]
          if (allDocIds.has(targetId) && targetId !== rootId) incomingSet.add(targetId)
        }
        if (hasRef) { refDocSet.add(rootId); totalRefCount++ }
        if (md.includes("![")) { imgDocSet.add(rootId); totalImgCount++ }
      }
    }

    docStats.refDocs = refDocSet.size
    docStats.totalRefs = totalRefCount
    docStats.imageDocs = imgDocSet.size
    docStats.totalImages = totalImgCount
    docStats.incomingRefDocs = incomingSet.size
    result.incomingRefDocIds = incomingSet

    const hasOutOrIn = new Set([...refDocSet, ...incomingSet])
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
        SUM(CASE WHEN a.value = '无' THEN 1 ELSE 0 END) as none_count
      FROM attributes a
      WHERE a.name = 'bookmark'
      AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition})
    `)
    if (rows?.length > 0) {
      const r = rows[0]
      docStats.bookmarkedDocs = r.bookmarked_docs || 0
      docStats.pendingPublishDocs = r.pending_count || 0
      docStats.publishedDocs = r.published_count || 0
      docStats.noneBookmarkDocs = r.none_count || 0
    }

    const customRows = await sql(`
      SELECT a.value, COUNT(DISTINCT a.block_id) as cnt FROM attributes a
      WHERE a.name = 'bookmark'
      AND a.value NOT IN ('待发布', '已发布', '无', '')
      AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition})
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
) {
  const result = {
    platformUnpublishedCounts: {} as Record<string, number>,
    fullPublishDocIds: new Set<string>(),
    noPublishDocIds: new Set<string>(),
  }
  try {
    const docMap = await fetchDocPlatformSets(notebookCondition, platformMeta)
    if (docMap.size === 0) return result

    // 平台 id → 位掩码；归属判据统一走 fetchDocPlatformSets 内的 getPlatformIdFromAttrKey，与列表徽章/属性面板保持一致
    const idToBit = new Map(platformMeta.map((p, i) => [p.id, 1 << i]))

    let full = 0; let partial = 0; let no = 0
    const fullSet = new Set<string>()
    const noSet = new Set<string>()
    const pCounts: Record<string, number> = {}
    for (const p of platformMeta) pCounts[p.id] = 0
    const allMask = (1 << platformMeta.length) - 1

    for (const [id, set] of docMap) {
      let mask = 0
      for (const pid of set) mask |= idToBit.get(pid) ?? 0
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
  } catch (e) { console.error("标签统计失败:", e) }
  docStats.taggedDocs = result.taggedDocIds.size

  try {
    const [aliasRows, memoRows] = await Promise.all([
      sql(`SELECT COUNT(DISTINCT a.block_id) as cnt FROM attributes a WHERE a.name = 'alias' AND a.value != '' AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition})`),
      sql(`SELECT COUNT(DISTINCT a.block_id) as cnt FROM attributes a WHERE a.name = 'memo' AND a.value != '' AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition})`),
    ])
    docStats.aliasedDocs = aliasRows?.[0]?.cnt ?? 0
    docStats.memoedDocs = memoRows?.[0]?.cnt ?? 0
  } catch (e) { console.error("别名/备注统计失败:", e) }
  return result
}
