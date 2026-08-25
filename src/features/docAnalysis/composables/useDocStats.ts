/**
 * 文档分析功能 - 统计维度逻辑（状态 + 分析 + 分类下钻）
 */
import type { Plugin } from "siyuan"
import { computed, nextTick, onScopeDispose, reactive, ref, watch } from "vue"
import { sql } from "@/api"
import type {
  BookmarkDetail,
  DepthStats,
  DocStats,
  DuplicateNameGroup,
  FilterOptions,
  QueryState,
} from "../types/index"
import { makeDefaultDocStats } from "../types/index"
import type { DocAnalysisStorage } from "../types/storage"
import { PLATFORM_META } from "./platformMeta"
import {
  analyzeBookmarks,
  analyzeContentQuality,
  analyzeContentScan,
  analyzeDepth,
  analyzePlatformPublish,
  analyzeUpdateTime,
  analyzeWordCount,
} from "../utils/docStatsAnalyzer"
import { filterDuplicateGroups } from "../utils"
import type { DocQueryConfig } from "../utils/categoryQueryConfig"
import { EXISTS_MAP, SIZE_CONDITIONS, buildTimeConfig } from "../utils/categoryQueryConfig"
import { buildIdInClause, buildIdNotInClause, quoteSql, quoteSqlList } from "../utils/sqlHelpers"
import { DOC_DEPTH_EXPR, IMAGE_SUBQUERY, REF_SUBQUERY, SIZE_WORDCOUNT_SUBQUERY } from "../utils/sqlConstants"

/** useDocStats 依赖注入接口（由 useDocAnalysis 提供共享状态与查询执行器） */
export interface UseDocStatsDeps {
  filterOptions: FilterOptions
  queryState: QueryState
  buildNotebookCondition: () => string
  runDocQuery: (config: DocQueryConfig) => Promise<void>
  setEmptyState: () => void
  resetQueryState: () => void
}

/**
 * 统计逻辑 composable（须在 useDocAnalysis 内部调用，effect scope 由 index.vue setup 提供）
 */
export function useDocStats(plugin: Plugin, storage: DocAnalysisStorage, deps: UseDocStatsDeps) {
  const docStats = reactive<DocStats>(makeDefaultDocStats())
  const depthStats = ref<DepthStats>({ depthDistribution: [], maxDepth: 0, avgDepth: 0 })
  const statsLoading = ref(false)
  const hasAnalyzed = ref(false)
  const statsFilter = ref<string>("")
  const bookmarkDetails = ref<BookmarkDetail[]>([])
  const bookmarkDetailVisible = ref(false)
  const bookmarkDetailLoading = ref(false)
  const duplicateGroups = ref<DuplicateNameGroup[]>([])
  const duplicateNameFilter = ref<string[]>([])
  const platformUnpublishedCounts = ref<Record<string, number>>({})

  // 分析产物 ID 集（供分类下钻查询；由 analyzeDocStats 填充）
  let orphanDocIds: Set<string> = new Set()
  let incomingRefDocIds: Set<string> = new Set()
  let taggedDocIds: Set<string> = new Set()
  let fullPublishDocIds: Set<string> = new Set()
  let noPublishDocIds: Set<string> = new Set()
  /** 上次成功分析时的笔记本过滤 ID（null 表示尚未分析），用于检测 ID 集是否过期 */
  let analyzedNotebookId: string | null = null

  /** 分析世代 token：新分析自增，使在途旧分析结果失效，避免竞态覆盖 */
  let analyzeToken = 0
  // 组件卸载后使在途分析失效，避免写入已废弃的响应式状态
  onScopeDispose(() => { analyzeToken++ })

  // ============================================================
  // 统计维度分析（委托 analyze* 工具函数）
  // ============================================================

  async function analyzeDocStats() {
    const token = ++analyzeToken
    statsLoading.value = true
    try {
      const nc = deps.buildNotebookCondition()
      Object.assign(docStats, makeDefaultDocStats())

      // 索引 2/3/4/8 为 analyzeUpdateTime/analyzeDepth/analyzeBookmarks/analyzeWordCount（仅副作用写 docStats，返回值忽略）
      const [sizeRows, dupRows, , , , platformResult, qualityResult, scanResult] = await Promise.all([
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
        analyzePlatformPublish(nc, docStats, PLATFORM_META.value),
        analyzeContentQuality(nc, docStats),
        analyzeContentScan(nc, docStats),
        analyzeWordCount(nc, docStats),
      ])

      // 已有更新的分析发起，丢弃过期结果
      if (token !== analyzeToken) return

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

      // 汇总重名统计（组数/总数由 duplicateGroups 派生，见 effectiveDuplicateGroups）
      duplicateGroups.value = dupRows?.length
        ? dupRows.map((r: any) => ({ title: r.doc_title || "无标题", count: r.cnt || 0 }))
        : []

      // 后处理：无书签 = 总文档 - 有书签（bookmarkedDocs 已在 analyzeBookmarks 动态统计）
      docStats.noBookmarkDocs = Math.max(0, docStats.totalDocs - docStats.bookmarkedDocs)

      hasAnalyzed.value = true
      analyzedNotebookId = deps.filterOptions.notebookId
    } catch (e) { console.error("分析文档统计失败:", e) }
    finally { if (token === analyzeToken) statsLoading.value = false }
  }

  // ============================================================
  // 书签详情
  // ============================================================

  async function fetchBookmarkDetails() {
    if (bookmarkDetailVisible.value) {
      bookmarkDetailVisible.value = false
      return
    }
    bookmarkDetailLoading.value = true
    try {
      const rows = await sql(`
        SELECT a.value as bookmark_value, COUNT(DISTINCT a.block_id) as doc_count
        FROM attributes a WHERE a.name = 'bookmark'
        AND a.value != ''
        AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${deps.buildNotebookCondition()})
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
    await deps.runDocQuery({ bookmarkInner: true, extraWhere: `AND bm.bookmark = ${quoteSql(bookmarkValue)}`, orderBy: "b.updated DESC" })
  }

  // ============================================================
  // 分类查询 — 配置表驱动
  // ============================================================

  /** ID 集来自上次分析；笔记本过滤已变化时阻断查询并提示重新分析 */
  function requireReAnalyze(): boolean {
    if (analyzedNotebookId === deps.filterOptions.notebookId) return false
    deps.queryState.results = []
    deps.queryState.hasQueried = true
    // 提示文案："筛选条件已变化，请重新分析"
    deps.queryState.errorMessage = (plugin.i18n as any)?.docAnalysis?.reAnalyzeRequired || ""
    deps.queryState.status = "error"
    return true
  }

  async function queryByStatsCategory(category: string) {
    if (statsFilter.value === category) {
      statsFilter.value = ""
      deps.resetQueryState()
      return
    }
    statsFilter.value = category

    // 重名（使用 effectiveDuplicateGroups 单一过滤入口）
    if (category === "duplicate") {
      const titles = effectiveDuplicateGroups.value.map((g) => g.title)
      if (titles.length === 0) { deps.setEmptyState(); return }
      await deps.runDocQuery({ extraWhere: `AND b.content IN (${quoteSqlList(titles)})`, orderBy: "b.content ASC, content_size ASC" })
      return
    }

    // 大小
    if (SIZE_CONDITIONS[category]) {
      await deps.runDocQuery({ extraWhere: SIZE_CONDITIONS[category], orderBy: "word_count ASC" })
      return
    }

    // 时间（实时生成条件，避免时间戳冻结）
    const timeConfig = buildTimeConfig(category)
    if (timeConfig) { await deps.runDocQuery(timeConfig); return }

    // 深度
    if (category === "deep") {
      await deps.runDocQuery({ extraWhere: `AND ${DOC_DEPTH_EXPR} >= 5`, orderBy: "doc_depth DESC" })
      return
    }
    if (category.startsWith("depth_")) {
      const d = Number.parseInt(category.slice(6), 10)
      if (!isNaN(d)) { await deps.runDocQuery({ extraWhere: `AND ${DOC_DEPTH_EXPR} = ${d}`, orderBy: "b.updated DESC" }); return }
    }

    // 引用/图片（特殊 JOIN）
    if (category === "hasRef") {
      await deps.runDocQuery({ extraSelect: "COALESCE(r.ref_count, 0) as ref_count, 0 as image_count,", extraJoin: `INNER JOIN (${REF_SUBQUERY}) r ON b.id = r.root_id`, orderBy: "r.ref_count DESC" })
      return
    }
    if (category === "hasImage") {
      await deps.runDocQuery({ extraSelect: "0 as ref_count, COALESCE(img.image_count, 0) as image_count,", extraJoin: `INNER JOIN (${IMAGE_SUBQUERY}) img ON b.id = img.root_id`, orderBy: "img.image_count DESC" })
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
    if (ID_SET_MAP[category]) {
      if (requireReAnalyze()) return
      await deps.runDocQuery({ extraWhere: buildIdInClause(ID_SET_MAP[category]) })
      return
    }
    if (category === "partialPublish") {
      if (requireReAnalyze()) return
      const partialCond = fullPublishDocIds.size === 0 && noPublishDocIds.size === 0 ? "AND 1 = 0" : buildIdNotInClause(new Set([...fullPublishDocIds, ...noPublishDocIds]))
      await deps.runDocQuery({ extraWhere: partialCond })
      return
    }
    if (category === "noTag") {
      if (requireReAnalyze()) return
      await deps.runDocQuery({ extraWhere: buildIdNotInClause(taggedDocIds) })
      return
    }

    // EXISTS 模式
    if (EXISTS_MAP[category]) {
      const cfg: DocQueryConfig = { extraWhere: EXISTS_MAP[category] }
      if (category === "hasBookmark") {
        cfg.bookmarkInner = true
        cfg.orderBy = "bm.bookmark ASC"
      }
      await deps.runDocQuery(cfg)
      return
    }

    deps.setEmptyState()
  }

  // ============================================================
  // 重名过滤（统一入口 + 排除名称持久化）
  // ============================================================

  /** 重名过滤统一入口（视图展示与下钻查询共用，过滤逻辑唯一出处） */
  const effectiveDuplicateGroups = computed(() =>
    filterDuplicateGroups(duplicateGroups.value, duplicateNameFilter.value),
  )

  /** 首次加载完成前跳过持久化 */
  let dupFilterLoaded = false

  async function loadDuplicateNameFilter() {
    try { duplicateNameFilter.value = await storage.duplicateNameFilter.load() || [] }
    catch { duplicateNameFilter.value = [] }
    // 等 watch 刷新完成后再放行持久化，避免加载回填（或加载失败置空）触发回写覆盖存储
    await nextTick()
    dupFilterLoaded = true
  }

  watch(duplicateNameFilter, async (val) => {
    if (!dupFilterLoaded) return
    await storage.duplicateNameFilter.save(val)
  })

  return {
    docStats, depthStats, statsLoading, hasAnalyzed, statsFilter,
    bookmarkDetails, bookmarkDetailVisible, bookmarkDetailLoading,
    duplicateGroups, effectiveDuplicateGroups, duplicateNameFilter, platformUnpublishedCounts,
    analyzeDocStats, fetchBookmarkDetails, queryByBookmark, queryByStatsCategory,
    loadDuplicateNameFilter,
  }
}
