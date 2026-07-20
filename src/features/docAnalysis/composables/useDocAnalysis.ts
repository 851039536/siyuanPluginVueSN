/**
 * 文档分析功能 - 核心业务逻辑
 */
import type { Plugin } from "siyuan"
import type {
  BookmarkDetail,
  DepthStats,
  DocInfo,
  DocStats,
  DuplicateNameGroup,
  FilterOptions,
  NotebookInfo,
  PlatformMeta,
  QueryState,
} from "../types/index"
import {
  reactive,
  ref,
} from "vue"
import {
  lsNotebooks,
  sql,
} from "@/api"
import {
  DocAnalysisStorage,
} from "../types/storage"
import { DEFAULT_DOC_STATS, DEFAULT_FILTER_OPTIONS, DEFAULT_PLATFORM_META } from "../types/index"
import {
  computeUnpublishedPlatformNames,
  getPlatformIdFromAttrKey,
} from "../utils/platformPublish"
import {
  buildIdInClause,
  buildIdNotInClause,
  escapeSql,
  quoteSql,
  quoteSqlList,
} from "../utils/sqlHelpers"
import {
  BOOKMARK_SUBQUERY,
  DOC_SELECT,
  DOC_SELECT_NO_SIZE,
  IMAGE_SUBQUERY,
  REF_SUBQUERY,
  SIZE_WORDCOUNT_SUBQUERY,
} from "../utils/sqlConstants"
import {
  analyzeBookmarks,
  analyzeContentQuality,
  analyzeContentScan,
  analyzeDepth,
  analyzePlatformPublish,
  analyzeUpdateTime,
  analyzeWordCount,
} from "../utils/docStatsAnalyzer"

/** 平台元数据（模块级响应式单例） */
export const PLATFORM_META = ref<PlatformMeta[]>([...DEFAULT_PLATFORM_META])

function getAllPlatformsMask() {
  return (1 << PLATFORM_META.value.length) - 1
}

/**
 * 文档分析 composable
 */
export function useDocAnalysis(plugin: Plugin) {
  const storage = new DocAnalysisStorage(plugin)
  const notebooks = ref<NotebookInfo[]>([])

  const queryState = reactive<QueryState>({
    status: "idle",
    results: [] as DocInfo[],
    errorMessage: "",
    hasQueried: false,
  })

  function setResults(docs: DocInfo[]) { queryState.results = docs }

  const filterOptions = reactive<FilterOptions>({ ...DEFAULT_FILTER_OPTIONS })

  async function loadPlatformMeta(): Promise<PlatformMeta[]> {
    try {
      const saved = await storage.platformMeta.loadOrDefault()
      if (saved && Array.isArray(saved) && saved.length > 0) PLATFORM_META.value = saved
    } catch { PLATFORM_META.value = [...DEFAULT_PLATFORM_META] }
    return PLATFORM_META.value
  }

  async function savePlatformMeta(meta: PlatformMeta[]): Promise<boolean> {
    PLATFORM_META.value = meta
    return storage.platformMeta.save(meta)
  }

  const docStats = reactive<DocStats>({ ...DEFAULT_DOC_STATS })
  const statsLoading = ref(false)
  const hasAnalyzed = ref(false)
  const duplicateGroups = ref<DuplicateNameGroup[]>([])

  let orphanDocIds: Set<string> = new Set()
  let incomingRefDocIds: Set<string> = new Set()
  let taggedDocIds: Set<string> = new Set()
  let fullPublishDocIds: Set<string> = new Set()
  let noPublishDocIds: Set<string> = new Set()

  const platformUnpublishedCounts = ref<Record<string, number>>({})
  const depthStats = ref<DepthStats>({ depthDistribution: [], maxDepth: 0, avgDepth: 0 })
  const statsFilter = ref<string>("")
  const bookmarkDetails = ref<BookmarkDetail[]>([])
  const bookmarkDetailVisible = ref(false)
  const bookmarkDetailLoading = ref(false)

  // ============================================================
  // 辅助函数
  // ============================================================

  function buildNotebookCondition(): string {
    return filterOptions.notebookId ? `AND b.box = '${filterOptions.notebookId}'` : ""
  }

  function buildNotebookMap(): Map<string, string> {
    const map = new Map<string, string>()
    for (const nb of notebooks.value) map.set(nb.id, nb.name)
    return map
  }

  function mapRowsToDocs(rows: any[]): DocInfo[] {
    const notebookMap = buildNotebookMap()
    return rows.map((row: any) => ({
      id: row.doc_id,
      title: row.doc_title || "无标题",
      hpath: row.doc_path || "",
      notebookId: row.notebook_id || "",
      notebookName: notebookMap.get(row.notebook_id) || "未知笔记本",
      contentSize: row.content_size || 0,
      wordCount: row.word_count || 0,
      updated: row.doc_updated || undefined,
      created: row.doc_created || undefined,
      depth: row.doc_depth ?? undefined,
      refCount: row.ref_count ?? undefined,
      imageCount: row.image_count ?? undefined,
      bookmark: row.bookmark || undefined,
    }))
  }

  // ============================================================
  // 排序比较器映射
  // ============================================================

  const SORT_CMP: Record<string, (a: DocInfo, b: DocInfo) => number> = {
    title: (a, b) => a.title.localeCompare(b.title, "zh-CN"),
    notebook: (a, b) => a.notebookName.localeCompare(b.notebookName, "zh-CN"),
    updated: (a, b) => (a.updated || "").localeCompare(b.updated || ""),
    depth: (a, b) => (a.depth || 0) - (b.depth || 0),
    refCount: (a, b) => (a.refCount || 0) - (b.refCount || 0),
    imageCount: (a, b) => (a.imageCount || 0) - (b.imageCount || 0),
    bookmark: (a, b) => (a.bookmark || "").localeCompare(b.bookmark || "", "zh-CN"),
    wordCount: (a, b) => a.wordCount - b.wordCount,
  }

  function sortDocs(docs: DocInfo[], field: string, order: string): DocInfo[] {
    const cmp = SORT_CMP[field] || SORT_CMP.wordCount
    return [...docs].sort((a, b) => order === "desc" ? -cmp(a, b) : cmp(a, b))
  }

  // ============================================================
  // DocQueryConfig + 统一查询执行器
  // ============================================================

  interface DocQueryConfig {
    extraSelect?: string
    extraJoin?: string
    extraWhere?: string
    orderBy?: string
    limit?: number
    bookmarkInner?: boolean
    skipSizeJoin?: boolean
  }

  async function runDocQuery(config: DocQueryConfig) {
    queryState.status = "loading"
    queryState.errorMessage = ""
    queryState.hasQueried = true

    try {
      const notebookCondition = buildNotebookCondition()
      const sizeJoin = config.skipSizeJoin ? "" : `LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id`
      const bmJoinType = config.bookmarkInner ? "INNER JOIN" : "LEFT JOIN"
      const bmJoin = `${bmJoinType} (${BOOKMARK_SUBQUERY}) bm ON b.id = bm.block_id`
      const doctSelect = config.skipSizeJoin ? DOC_SELECT_NO_SIZE : DOC_SELECT

      const rows = await sql(`
        SELECT ${doctSelect},
          ${config.extraSelect || "0 as ref_count, 0 as image_count,"}
          COALESCE(bm.bookmark, '') as bookmark
        FROM blocks b ${sizeJoin} ${bmJoin} ${config.extraJoin || ""}
        WHERE b.type = 'd' ${notebookCondition} ${config.extraWhere || ""}
        ORDER BY ${config.orderBy || "b.updated DESC"}
        LIMIT ${config.limit || 2000}
      `)

      if (!rows || rows.length === 0) { setResults([]); queryState.status = "empty"; return }

      const docs = mapRowsToDocs(rows)
      const sorted = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder)
      await enrichWithPublishedPlatforms(sorted)
      setResults(sorted)
      queryState.status = "success"
    } catch (error) {
      console.error("查询文档列表失败:", error)
      queryState.errorMessage = (error as Error).message || "查询失败"
      queryState.status = "error"
      setResults([])
    }
  }

  // ============================================================
  // 业务操作
  // ============================================================

  async function loadNotebooks() {
    try {
      const data = await lsNotebooks()
      if (data?.notebooks) {
        notebooks.value = data.notebooks
          .filter((nb: any) => !nb.closed)
          .map((nb: any) => ({ id: nb.id, name: nb.name }))
      }
    } catch (e) { console.error("加载笔记本列表失败:", e) }
  }

  async function loadSavedOptions() {
    try { Object.assign(filterOptions, await storage.options.loadOrDefault()) }
    catch (e) { console.error("加载文档分析配置失败:", e) }
  }

  async function saveOptions() {
    try { await storage.options.save({ ...filterOptions }) }
    catch (e) { console.error("保存文档分析配置失败:", e) }
  }

  /** 生成思源时间格式的 N 天前字符串 */
  function daysAgoStr(days: number): string {
    const d = new Date(Date.now() - days * 86400000)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  }

  // ============================================================
  // 统计维度分析（委托 analyze* 工具函数）
  // ============================================================

  async function analyzeDocStats() {
    statsLoading.value = true
    try {
      const nc = buildNotebookCondition()
      Object.assign(docStats, { ...DEFAULT_DOC_STATS })

      const [sizeRows, dupRows, _t, _d, _bm, platformResult, qualityResult, scanResult, _wc] = await Promise.all([
        sql(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) = 0 THEN 1 ELSE 0 END) as zero_count,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) > 0 AND COALESCE(sw.total_size, 0) < 1024 THEN 1 ELSE 0 END) as small_count,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) >= 1024 AND COALESCE(sw.total_size, 0) < 10240 THEN 1 ELSE 0 END) as medium_count,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) >= 10240 AND COALESCE(sw.total_size, 0) < 102400 THEN 1 ELSE 0 END) as large_count,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) >= 102400 THEN 1 ELSE 0 END) as xlarge_count
          FROM blocks b LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
          WHERE b.type = 'd' ${nc}
        `),
        sql(`SELECT b.content as doc_title, COUNT(*) as cnt FROM blocks b WHERE b.type = 'd' ${nc} GROUP BY b.content HAVING COUNT(*) > 1 ORDER BY cnt DESC LIMIT 500`),
        analyzeUpdateTime(nc, docStats),
        analyzeDepth(nc, docStats, depthStats.value),
        analyzeBookmarks(nc, docStats),
        analyzePlatformPublish(nc, docStats, PLATFORM_META.value, getAllPlatformsMask),
        analyzeContentQuality(nc, docStats),
        analyzeContentScan(nc, docStats),
        analyzeWordCount(nc, docStats),
      ])

      platformUnpublishedCounts.value = platformResult.platformUnpublishedCounts
      fullPublishDocIds = platformResult.fullPublishDocIds
      noPublishDocIds = platformResult.noPublishDocIds
      taggedDocIds = qualityResult.taggedDocIds
      incomingRefDocIds = scanResult.incomingRefDocIds
      orphanDocIds = scanResult.orphanDocIds

      // 汇总大小统计
      if (sizeRows?.[0]) {
        const r = sizeRows[0]
        docStats.totalDocs = r.total || 0
        docStats.zeroByteDocs = r.zero_count || 0
        docStats.smallDocs = r.small_count || 0
        docStats.mediumDocs = r.medium_count || 0
        docStats.largeDocs = r.large_count || 0
        docStats.xlargeDocs = r.xlarge_count || 0
      }

      // 汇总重名统计
      if (dupRows?.length) {
        docStats.duplicateNameGroups = dupRows.length
        docStats.duplicateNameDocs = dupRows.reduce((s: number, r: any) => s + (r.cnt || 0), 0)
        duplicateGroups.value = dupRows.map((r: any) => ({ title: r.doc_title || "无标题", count: r.cnt || 0 }))
      } else { docStats.duplicateNameGroups = 0; docStats.duplicateNameDocs = 0; duplicateGroups.value = [] }

      // 后处理：书签数修正 + 缓存写入
      const effectiveBm = Math.max(0, docStats.bookmarkedDocs - docStats.noneBookmarkDocs)
      docStats.bookmarkedDocs = effectiveBm
      docStats.noBookmarkDocs = Math.max(0, docStats.totalDocs - effectiveBm - docStats.noneBookmarkDocs)

      hasAnalyzed.value = true
    } catch (e) { console.error("分析文档统计失败:", e) }
    finally { statsLoading.value = false }
  }

  // ============================================================
  // 书签详情
  // ============================================================

  async function fetchBookmarkDetails() {
    if (bookmarkDetailVisible.value) { bookmarkDetailVisible.value = false; return }
    bookmarkDetailLoading.value = true
    try {
      const rows = await sql(`
        SELECT a.value as bookmark_value, COUNT(DISTINCT a.block_id) as doc_count
        FROM attributes a WHERE a.name = 'bookmark'
        AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${buildNotebookCondition()})
        GROUP BY a.value ORDER BY doc_count DESC
      `)
      bookmarkDetails.value = rows ? rows.map((r: any) => ({ value: r.bookmark_value || "", count: r.doc_count || 0 })) : []
      bookmarkDetailVisible.value = true
    } catch (e) { console.error("查询书签详情失败:", e); bookmarkDetails.value = [] }
    finally { bookmarkDetailLoading.value = false }
  }

  async function queryByBookmark(bookmarkValue: string) {
    bookmarkDetailVisible.value = false
    statsFilter.value = ""
    await runDocQuery({ bookmarkInner: true, extraWhere: `AND bm.bookmark = ${quoteSql(bookmarkValue)}`, orderBy: "b.updated DESC" })
  }

  // ============================================================
  // 分类查询 — 配置表驱动
  // ============================================================

  /** 大小分档条件 */
  const SIZE_CONDITIONS: Record<string, string> = {
    "0B": "AND COALESCE(sw.total_size, 0) = 0",
    "small": "AND COALESCE(sw.total_size, 0) > 0 AND COALESCE(sw.total_size, 0) < 1024",
    "medium": "AND COALESCE(sw.total_size, 0) >= 1024 AND COALESCE(sw.total_size, 0) < 10240",
    "large": "AND COALESCE(sw.total_size, 0) >= 10240 AND COALESCE(sw.total_size, 0) < 102400",
    "xlarge": "AND COALESCE(sw.total_size, 0) >= 102400",
  }

  /** EXISTS 模式书签/属性查询 */
  function existsCond(attr: string, value?: string): string {
    const valCond = value ? ` AND a.value = '${escapeSql(value)}'` : " AND a.value != ''"
    return `AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = '${attr}'${valCond} AND a.block_id = b.id LIMIT 1)`
  }

  /** 时间区间相邻策略：7days→(>=7d), 30days→(>=30d,<7d), 以此类推 */
  const TIME_INTERVALS: [string, number, number | null][] = [
    ["7days", 7, null],
    ["30days", 30, 7],
    ["1to2month", 60, 30],
    ["2to3month", 90, 60],
    ["halfYear", 180, null],
  ]
  const TIME_CONFIGS: Record<string, DocQueryConfig> = {}
  for (const [id, lower, upper] of TIME_INTERVALS) {
    let w = `AND b.updated >= '${daysAgoStr(lower)}'`
    if (upper !== null) w += ` AND b.updated < '${daysAgoStr(upper)}'`
    TIME_CONFIGS[id] = { extraWhere: w }
  }
  TIME_CONFIGS.halfYear = { extraWhere: `AND b.updated < '${daysAgoStr(180)}'` }

  async function queryByStatsCategory(category: string) {
    if (statsFilter.value === category) {
      statsFilter.value = ""
      queryState.hasQueried = false
      setResults([])
      queryState.status = "idle"
      return
    }
    statsFilter.value = category

    // 重名
    if (category === "duplicate") {
      const titles = duplicateGroups.value.map((g) => g.title)
      if (titles.length === 0) { queryState.status = "empty"; queryState.hasQueried = true; setResults([]); return }
      await runDocQuery({ extraWhere: `AND b.content IN (${quoteSqlList(titles)})`, orderBy: "b.content ASC, content_size ASC" })
      return
    }

    // 大小
    if (SIZE_CONDITIONS[category]) {
      await runDocQuery({ extraWhere: SIZE_CONDITIONS[category], orderBy: "word_count ASC" })
      return
    }

    // 时间
    if (TIME_CONFIGS[category]) { await runDocQuery(TIME_CONFIGS[category]); return }

    // 深度
    if (category === "deep") {
      await runDocQuery({ extraWhere: "AND LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 >= 5", orderBy: "doc_depth DESC" })
      return
    }
    if (category.startsWith("depth_")) {
      const d = Number.parseInt(category.slice(6), 10)
      if (!isNaN(d)) { await runDocQuery({ extraWhere: `AND LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 = ${d}`, orderBy: "b.updated DESC" }); return }
    }

    // 自定义时间
    if (category === "customTime") {
      let w = ""
      if (filterOptions.updatedAfter) w += `AND b.updated >= '${filterOptions.updatedAfter.replace(/-/g, "")}000000' `
      if (filterOptions.updatedBefore) w += `AND b.updated <= '${filterOptions.updatedBefore.replace(/-/g, "")}235959' `
      if (!w) { queryState.status = "empty"; return }
      await runDocQuery({ extraWhere: w })
      return
    }

    // 引用/图片（特殊 JOIN）
    if (category === "hasRef") {
      await runDocQuery({ extraSelect: "COALESCE(r.ref_count, 0) as ref_count, 0 as image_count,", extraJoin: `INNER JOIN (${REF_SUBQUERY}) r ON b.id = r.root_id`, orderBy: "r.ref_count DESC" })
      return
    }
    if (category === "hasImage") {
      await runDocQuery({ extraSelect: "0 as ref_count, COALESCE(img.image_count, 0) as image_count,", extraJoin: `INNER JOIN (${IMAGE_SUBQUERY}) img ON b.id = img.root_id`, orderBy: "img.image_count DESC" })
      return
    }

    // ID 集映射
    const ID_SET_MAP: Record<string, Set<string>> = {
      fullPublish: fullPublishDocIds,
      noPublish: noPublishDocIds,
      hasTag: taggedDocIds,
      incomingRef: incomingRefDocIds,
      orphanDoc: orphanDocIds,
    }
    if (ID_SET_MAP[category]) { await runDocQuery({ extraWhere: buildIdInClause(ID_SET_MAP[category]) }); return }
    if (category === "partialPublish") {
      const partialCond = fullPublishDocIds.size === 0 && noPublishDocIds.size === 0 ? "AND 1 = 0" : buildIdNotInClause(new Set([...fullPublishDocIds, ...noPublishDocIds]))
      await runDocQuery({ extraWhere: partialCond })
      return
    }
    if (category === "noTag") { await runDocQuery({ extraWhere: buildIdNotInClause(taggedDocIds) }); return }

    // EXISTS 模式
    const EXISTS_MAP: Record<string, string> = {
      hasBookmark: "AND bm.bookmark != '无'",
      noBookmark: "AND b.id NOT IN (SELECT block_id FROM attributes WHERE name = 'bookmark' LIMIT 10000)",
      noneBookmark: existsCond("bookmark", "无"),
      pendingPublish: existsCond("bookmark", "待发布"),
      published: existsCond("bookmark", "已发布"),
      unused: existsCond("bookmark", "不使用"),
      hasAlias: existsCond("alias"),
      hasMemo: existsCond("memo"),
    }
    if (EXISTS_MAP[category]) {
      const cfg: DocQueryConfig = { extraWhere: EXISTS_MAP[category] }
      if (category === "hasBookmark") cfg.bookmarkInner = true; cfg.orderBy = "bm.bookmark ASC"
      await runDocQuery(cfg)
      return
    }

    queryState.status = "empty"
  }

  async function queryDocs() {
    const needWcFilter = filterOptions.wordCountMin > 0 || filterOptions.wordCountMax > 0
    let conds = ""
    if (filterOptions.titleKeyword.trim()) conds += `AND b.content LIKE '%${escapeSql(filterOptions.titleKeyword.trim())}%' `
    if (filterOptions.contentKeyword.trim()) conds += `AND b.id IN (SELECT DISTINCT root_id FROM blocks WHERE content LIKE '%${escapeSql(filterOptions.contentKeyword.trim())}%' AND type != 'd') `
    if (filterOptions.bookmarkName.trim()) conds += `AND b.id IN (SELECT block_id FROM attributes WHERE name='bookmark' AND value='${escapeSql(filterOptions.bookmarkName.trim())}') `
    if (filterOptions.updatedAfter) conds += `AND b.updated >= '${filterOptions.updatedAfter.replace(/-/g, "")}000000' `
    if (filterOptions.updatedBefore) conds += `AND b.updated <= '${filterOptions.updatedBefore.replace(/-/g, "")}235959' `
    if (needWcFilter) {
      if (filterOptions.wordCountMin > 0) conds += `AND COALESCE(sw.total_word_count, 0) >= ${filterOptions.wordCountMin} `
      if (filterOptions.wordCountMax > 0) conds += `AND COALESCE(sw.total_word_count, 0) <= ${filterOptions.wordCountMax} `
    }
    await runDocQuery({ extraWhere: conds, orderBy: needWcFilter ? "word_count ASC" : "b.content ASC", skipSizeJoin: !needWcFilter })
    await saveOptions()
  }

  // ============================================================
  // 文档操作
  // ============================================================

  function openDoc(docId: string) { if (docId) window.open(`siyuan://blocks/${docId}`) }

  function updateSort(field: string, order: string) {
    filterOptions.sortField = field as any
    filterOptions.sortOrder = order as any
    if (queryState.results.length > 0) setResults(sortDocs(queryState.results, field, order))
    saveOptions()
  }

  function clearResults() { setResults([]) }

  async function enrichWithPublishedPlatforms(docs: DocInfo[]) {
    if (docs.length === 0) return
    try {
      const yamlRows = await sql(`SELECT block_id, name FROM attributes WHERE name LIKE '%yaml%' AND block_id IN (${quoteSqlList(docs.map((d) => d.id))}) LIMIT 10000`)
      const docPublishedMap = new Map<string, Set<string>>()
      if (yamlRows) {
        for (const row of yamlRows) {
          const id = String(row.block_id)
          if (!docPublishedMap.has(id)) docPublishedMap.set(id, new Set())
          const platformId = getPlatformIdFromAttrKey(String(row.name), PLATFORM_META.value)
          if (platformId) docPublishedMap.get(id)!.add(platformId)
        }
      }
      for (const doc of docs) {
        doc.unpublishedPlatforms = computeUnpublishedPlatformNames(docPublishedMap.get(doc.id) || new Set(), PLATFORM_META.value)
      }
    } catch (e) { console.error("查询文档发布属性失败:", e) }
  }

  async function queryByMissingPlatform(platformMatcher: string) {
    statsFilter.value = ""
    const platformEntry = PLATFORM_META.value.find((p) => p.id === platformMatcher || p.matchers.includes(platformMatcher))
    const matchers = platformEntry ? platformEntry.matchers : [platformMatcher]
    const nameConditions = matchers.map((m) => `name LIKE '%${escapeSql(m)}%'`).join(" OR ")
    await runDocQuery({
      extraWhere: `AND b.id IN (
        SELECT block_id FROM attributes WHERE name LIKE '%yaml%'
        AND block_id IN (SELECT b2.id FROM blocks b2 LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw2 ON b2.id = sw2.root_id WHERE b2.type = 'd' AND COALESCE(sw2.total_size, 0) > 0 ${buildNotebookCondition()})
      ) AND b.id NOT IN (SELECT block_id FROM attributes WHERE (${nameConditions}) AND name LIKE '%yaml%')`,
    })
  }

  return {
    notebooks, queryState, filterOptions, docStats, depthStats,
    statsLoading, hasAnalyzed, statsFilter,
    bookmarkDetails, bookmarkDetailVisible, bookmarkDetailLoading,
    loadNotebooks, loadSavedOptions, queryDocs, analyzeDocStats,
    queryByStatsCategory, fetchBookmarkDetails, queryByBookmark, queryByMissingPlatform,
    openDoc, updateSort, clearResults,
    loadPlatformMeta, savePlatformMeta, platformUnpublishedCounts,
  }
}
