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

/**
 * 子查询：统计每个文档的内容大小和字数（合并减少扫描次数）
 *  length = 字符数，对中日韩文本 ≈ 词数，对英文文本 ≈ 字符数（非精确词数）
 *  两者使用相同表达式，因为思源 blocks 表无独立字数列
 */
const SIZE_WORDCOUNT_SUBQUERY = `
  SELECT root_id,
    SUM(length) as total_size,
    SUM(length) as total_word_count
  FROM blocks
  WHERE type != 'd'
  GROUP BY root_id
`

/** 平台元数据（响应式，支持用户动态增删改） */
export const PLATFORM_META = ref<PlatformMeta[]>([...DEFAULT_PLATFORM_META])

/** 全平台位掩码，随 PLATFORM_META 动态计算 */
function getAllPlatformsMask() {
  return (1 << PLATFORM_META.value.length) - 1
}

/** 子查询：获取每个文档的书签名称（思源书签存储在 attributes 表中） */
const BOOKMARK_SUBQUERY = `
  SELECT block_id, value as bookmark
  FROM attributes
  WHERE name = 'bookmark'
`

/** 文档列表 SELECT 公共列（不含 ref_count/image_count/bookmark） */
const DOC_SELECT = `
b.id as doc_id,
b.content as doc_title,
b.hpath as doc_path,
b.box as notebook_id,
b.updated as doc_updated,
b.created as doc_created,
COALESCE(sw.total_size, 0) as content_size,
COALESCE(sw.total_word_count, 0) as word_count,
LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth`

/** 文档列表 SELECT（不含 size JOIN 时，size/wordCount 置 0） */
const DOC_SELECT_NO_SIZE = `
b.id as doc_id,
b.content as doc_title,
b.hpath as doc_path,
b.box as notebook_id,
b.updated as doc_updated,
b.created as doc_created,
0 as content_size,
0 as word_count,
LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth`

/** 子查询：统计每个文档的引用块数量（思源引用语法 ((id "标题")) 在 markdown 字段中） */
const REF_SUBQUERY = `
  SELECT root_id, COUNT(*) as ref_count
  FROM blocks
  WHERE type != 'd' AND markdown LIKE '%((%'
  GROUP BY root_id
`

/** 子查询：统计每个文档的图片/资源数量（markdown 语法中包含 ![ ） */
const IMAGE_SUBQUERY = `
  SELECT root_id, COUNT(*) as image_count
  FROM blocks
  WHERE type != 'd' AND markdown LIKE '%![%'
  GROUP BY root_id
`

/** 生成 N 天前的 yyyyMMddHHmmss 格式字符串（思源 updated 字段格式） */
function daysAgoStr(days: number): string {
  const d = new Date(Date.now() - days * 86400000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/**
 * 文档分析 composable
 */
export function useDocAnalysis(plugin: Plugin) {
  // 存储管理
  const storage = new DocAnalysisStorage(plugin)

  // 笔记本列表
  const notebooks = ref<NotebookInfo[]>([])

  // 查询状态
  const queryState = reactive<QueryState>({
    status: "idle",
    results: [] as DocInfo[],
    errorMessage: "",
    hasQueried: false,
  })

  /** 统一设置结果，确保触发响应式更新 */
  function setResults(docs: DocInfo[]) {
    queryState.results = docs
  }

  // 过滤选项
  const filterOptions = reactive<FilterOptions>({ ...DEFAULT_FILTER_OPTIONS })

  /**
   * 从存储加载平台元数据（用户自定义优先，无则用默认值）
   */
  async function loadPlatformMeta(): Promise<PlatformMeta[]> {
    try {
      const saved = await storage.platformMeta.loadOrDefault()
      if (saved && Array.isArray(saved) && saved.length > 0) {
        PLATFORM_META.value = saved
      }
    } catch {
      PLATFORM_META.value = [...DEFAULT_PLATFORM_META]
    }
    return PLATFORM_META.value
  }

  /**
   * 保存平台元数据到存储
   */
  async function savePlatformMeta(meta: PlatformMeta[]): Promise<boolean> {
    PLATFORM_META.value = meta
    return storage.platformMeta.save(meta)
  }

  // 文档统计信息
  const docStats = reactive<DocStats>({ ...DEFAULT_DOC_STATS })
  const statsLoading = ref(false)
  const hasAnalyzed = ref(false)

  // 重名文档详情（供列表展示）
  const duplicateGroups = ref<DuplicateNameGroup[]>([])

  // 引用拓扑缓存（用于分类查询避免重复计算）
  let orphanDocIds: Set<string> = new Set()
  let incomingRefDocIds: Set<string> = new Set()

  // 标签文档缓存
  let taggedDocIds: Set<string> = new Set()

  // 发布状态缓存
  let fullPublishDocIds: Set<string> = new Set()
  let noPublishDocIds: Set<string> = new Set()
  /** 各平台未发布文档数（有任一发布但缺该平台的文档数），响应式供模板消费 */
  const platformUnpublishedCounts = ref<Record<string, number>>({})

  // 深度分析详情
  const depthStats = ref<DepthStats>({
    depthDistribution: [],
    maxDepth: 0,
    avgDepth: 0,
  })

  // 当前选中的统计类别过滤
  const statsFilter = ref<string>("")

  // 书签详情
  const bookmarkDetails = ref<BookmarkDetail[]>([])
  const bookmarkDetailVisible = ref(false)
  const bookmarkDetailLoading = ref(false)

  // ============================================================
  // 公共辅助函数
  // ============================================================

  /** 构建笔记本过滤条件 */
  function buildNotebookCondition(): string {
    if (filterOptions.notebookId) {
      return `AND b.box = '${filterOptions.notebookId}'`
    }
    return ""
  }

  /** 构建笔记本名称映射 */
  function buildNotebookMap(): Map<string, string> {
    const map = new Map<string, string>()
    for (const nb of notebooks.value) {
      map.set(nb.id, nb.name)
    }
    return map
  }

  /** 将 SQL 行映射为 DocInfo（扩展版） */
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

  interface DocQueryConfig {
    /** Additional SELECT columns (appended after DOC_SELECT) */
    extraSelect?: string
    /** Additional JOIN clauses */
    extraJoin?: string
    /** Additional WHERE conditions (after notebook condition) */
    extraWhere?: string
    /** ORDER BY clause */
    orderBy?: string
    /** LIMIT value */
    limit?: number
    /** Use INNER JOIN for bookmark instead of LEFT JOIN */
    bookmarkInner?: boolean
    /** Skip SIZE_WORDCOUNT_SUBQUERY join */
    skipSizeJoin?: boolean
  }

  /** 统一文档查询执行器 */
  async function runDocQuery(config: DocQueryConfig) {
    queryState.status = "loading"
    queryState.errorMessage = ""
    queryState.hasQueried = true

    try {
      const notebookCondition = buildNotebookCondition()
      const sizeJoin = config.skipSizeJoin
        ? ""
        : `LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id`
      const bmJoinType = config.bookmarkInner ? "INNER JOIN" : "LEFT JOIN"
      const bmJoin = `${bmJoinType} (${BOOKMARK_SUBQUERY}) bm ON b.id = bm.block_id`

      const doctSelect = config.skipSizeJoin ? DOC_SELECT_NO_SIZE : DOC_SELECT
      const sqlStmt = `
        SELECT
          ${doctSelect},
          ${config.extraSelect || "0 as ref_count, 0 as image_count,"}
          COALESCE(bm.bookmark, '') as bookmark
        FROM blocks b
        ${sizeJoin}
        ${bmJoin}
        ${config.extraJoin || ""}
        WHERE b.type = 'd' ${notebookCondition}
        ${config.extraWhere || ""}
        ORDER BY ${config.orderBy || "b.updated DESC"}
        LIMIT ${config.limit || 2000}
      `

      const rows = await sql(sqlStmt)

      if (!rows || rows.length === 0) {
        setResults([])
        queryState.status = "empty"
        return
      }

      const docs = mapRowsToDocs(rows)
      const sortedDocs = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder)
      await enrichWithPublishedPlatforms(sortedDocs)
      setResults(sortedDocs)
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

  /**
   * 加载笔记本列表
   */
  async function loadNotebooks() {
    try {
      const data = await lsNotebooks()
      if (data && data.notebooks) {
        notebooks.value = data.notebooks
          .filter((nb: any) => !nb.closed)
          .map((nb: any) => ({
            id: nb.id,
            name: nb.name,
          }))
      }
    } catch (error) {
      console.error("加载笔记本列表失败:", error)
    }
  }

  /**
   * 加载保存的配置
   */
  async function loadSavedOptions() {
    try {
      const saved = await storage.options.loadOrDefault()
      Object.assign(filterOptions, saved)
    } catch (error) {
      console.error("加载文档分析配置失败:", error)
    }
  }

  /**
   * 保存配置
   */
  async function saveOptions() {
    try {
      await storage.options.save({ ...filterOptions })
    } catch (error) {
      console.error("保存文档分析配置失败:", error)
    }
  }

  /**
   * 执行分析 - 获取文档统计概览（含新增维度）
   * 阶段 1：并行执行所有独立查询
   * 阶段 2：串行执行依赖 totalDocs 的书签计算
   */
  async function analyzeDocStats() {
    statsLoading.value = true
    try {
      const notebookCondition = buildNotebookCondition()

      // ── 阶段 1：互不依赖的查询并行 ──
      // 并行执行所有查询，仅 sizeRows/dupRows 结果被直接使用，
      // 其余查询通过闭包更新 reactive state（side effect）
      const [sizeRows, dupRows] = await Promise.all([
        // 大小统计
        sql(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) = 0 THEN 1 ELSE 0 END) as zero_count,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) > 0 AND COALESCE(sw.total_size, 0) < 1024 THEN 1 ELSE 0 END) as small_count,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) >= 1024 AND COALESCE(sw.total_size, 0) < 10240 THEN 1 ELSE 0 END) as medium_count,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) >= 10240 AND COALESCE(sw.total_size, 0) < 102400 THEN 1 ELSE 0 END) as large_count,
            SUM(CASE WHEN COALESCE(sw.total_size, 0) >= 102400 THEN 1 ELSE 0 END) as xlarge_count
          FROM blocks b
          LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
          WHERE b.type = 'd' ${notebookCondition}
        `),
        // 重名统计
        sql(`
          SELECT b.content as doc_title, COUNT(*) as cnt
          FROM blocks b
          WHERE b.type = 'd' ${notebookCondition}
          GROUP BY b.content
          HAVING COUNT(*) > 1
          ORDER BY cnt DESC
          LIMIT 500
        `),
        // 更新时间
        analyzeUpdateTime(notebookCondition),
        // 深度
        analyzeDepth(notebookCondition),
        // 书签（不依赖 totalDocs 的部分先并行）
        analyzeBookmarks(notebookCondition),
        // 平台发布
        analyzePlatformPublish(notebookCondition),
        // 内容质量
        analyzeContentQuality(notebookCondition),
        // 内容扫描（引用+图片+拓扑）
        analyzeContentScan(notebookCondition),
        // 字数分布
        analyzeWordCount(notebookCondition),
      ])

      // ── 阶段 2：汇总 ──
      if (sizeRows && sizeRows.length > 0) {
        const row = sizeRows[0]
        docStats.totalDocs = row.total || 0
        docStats.zeroByteDocs = row.zero_count || 0
        docStats.smallDocs = row.small_count || 0
        docStats.mediumDocs = row.medium_count || 0
        docStats.largeDocs = row.large_count || 0
        docStats.xlargeDocs = row.xlarge_count || 0
      }

      if (dupRows && dupRows.length > 0) {
        docStats.duplicateNameGroups = dupRows.length
        docStats.duplicateNameDocs = dupRows.reduce((sum: number, r: any) => sum + (r.cnt || 0), 0)
        duplicateGroups.value = dupRows.map((r: any) => ({
          title: r.doc_title || "无标题",
          count: r.cnt || 0,
        }))
      }
      else {
        docStats.duplicateNameGroups = 0
        docStats.duplicateNameDocs = 0
        duplicateGroups.value = []
      }

      // 书签中 noBookmarkDocs 依赖 totalDocs，在此后处理
      const effectiveBookmarked = Math.max(0, docStats.bookmarkedDocs - docStats.noneBookmarkDocs)
      docStats.bookmarkedDocs = effectiveBookmarked
      docStats.noBookmarkDocs = Math.max(0, docStats.totalDocs - effectiveBookmarked - docStats.noneBookmarkDocs)

      hasAnalyzed.value = true
    }
    catch (error) {
      console.error("分析文档统计失败:", error)
    }
    finally {
      statsLoading.value = false
    }
  }

  /**
   * 更新时间分析
   * 思源 blocks.updated 格式为 yyyyMMddHHmmss（14位字符串，如 "20210604222535"）
   */
  async function analyzeUpdateTime(notebookCondition: string) {
    try {
      const ts7 = daysAgoStr(7)
      const ts30 = daysAgoStr(30)
      const ts60 = daysAgoStr(60)
      const ts90 = daysAgoStr(90)
      const ts180 = daysAgoStr(180)

      const timeSql = `
        SELECT
          SUM(CASE WHEN b.updated >= '${ts7}' THEN 1 ELSE 0 END) as in_7_days,
          SUM(CASE WHEN b.updated >= '${ts30}' AND b.updated < '${ts7}' THEN 1 ELSE 0 END) as in_30_days,
          SUM(CASE WHEN b.updated >= '${ts60}' AND b.updated < '${ts30}' THEN 1 ELSE 0 END) as in_1_to_2_months,
          SUM(CASE WHEN b.updated >= '${ts90}' AND b.updated < '${ts60}' THEN 1 ELSE 0 END) as in_2_to_3_months,
          SUM(CASE WHEN b.updated >= '${ts180}' AND b.updated < '${ts90}' THEN 1 ELSE 0 END) as in_half_year,
          SUM(CASE WHEN b.updated < '${ts180}' THEN 1 ELSE 0 END) as over_half_year
        FROM blocks b
        WHERE b.type = 'd' ${notebookCondition}
      `

      const timeRows = await sql(timeSql)
      if (timeRows && timeRows.length > 0) {
        const row = timeRows[0]
        docStats.updatedIn7Days = row.in_7_days || 0
        docStats.updatedIn30Days = row.in_30_days || 0
        docStats.updatedIn1To2Months = row.in_1_to_2_months || 0
        docStats.updatedIn2To3Months = row.in_2_to_3_months || 0
        docStats.updatedOverHalfYear = row.over_half_year || 0
      }
    } catch (error) {
      console.error("更新时间分析失败:", error)
    }
  }

  /**
   * 文档深度/层级分析
   */
  async function analyzeDepth(notebookCondition: string) {
    try {
      const depthSql = `
        SELECT
          COALESCE(LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1, 0) as depth,
          COUNT(*) as cnt
        FROM blocks b
        WHERE b.type = 'd' ${notebookCondition}
        GROUP BY depth
        ORDER BY depth ASC
      `

      const depthRows = await sql(depthSql)
      if (depthRows && depthRows.length > 0) {
        const distribution = depthRows.map((r: any) => ({
          depth: r.depth || 0,
          count: r.cnt || 0,
        }))

        const maxDepth = Math.max(...distribution.map((d) => d.depth))
        const totalDocs = distribution.reduce((sum: number, d) => sum + d.count, 0)
        const avgDepth = totalDocs > 0
          ? distribution.reduce((sum: number, d) => sum + d.depth * d.count, 0) / totalDocs
          : 0
        const deepDocs = distribution
          .filter((d) => d.depth >= 5)
          .reduce((sum: number, d) => sum + d.count, 0)

        depthStats.value = {
          depthDistribution: distribution,
          maxDepth,
          avgDepth: Math.round(avgDepth * 10) / 10,
        }
        docStats.deepDocs = deepDocs
      }
    } catch (error) {
      console.error("文档深度分析失败:", error)
    }
  }

  /**
   * 字数分布分析（复用 SIZE_WORDCOUNT_SUBQUERY）
   */
  async function analyzeWordCount(notebookCondition: string) {
    try {
      const wcSql = `
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
      `
      const rows = await sql(wcSql)
      if (rows && rows.length > 0) {
        const r = rows[0]
        docStats.wordCountDistribution = [
          {
            label: "0~500字",
            count: r.wc_0_500 || 0,
          },
          {
            label: "500~2000字",
            count: r.wc_500_2000 || 0,
          },
          {
            label: "2000~5000字",
            count: r.wc_2000_5000 || 0,
          },
          {
            label: "5000~1万字",
            count: r.wc_5000_10000 || 0,
          },
          {
            label: "1万~2万字",
            count: r.wc_10000_20000 || 0,
          },
          {
            label: ">2万字",
            count: r.wc_20000_plus || 0,
          },
        ]
      }
    } catch (error) {
      console.error("字数分布分析失败:", error)
    }
  }

  /**
   * 内容扫描（合并引用/图片/拓扑分析为一次全量扫描）
   * 单次 SQL 拉取所有含 (( 或 ![ 的 content 块 → JS 端一次性统计
   */
  async function analyzeContentScan(notebookCondition: string) {
    try {
      // ① 所有文档 ID
      const allDocs = await sql(`
        SELECT id FROM blocks WHERE type = 'd' ${notebookCondition} LIMIT 10000
      `)
      if (!allDocs || allDocs.length === 0) return

      const allDocIds = new Set(allDocs.map((r: any) => String(r.id)))

      // ② 所有含引用或图片的非文档块 — 一次 SQL
      const contentRows = await sql(`
        SELECT root_id, markdown
        FROM blocks
        WHERE type != 'd'
        AND (markdown LIKE '%((%' OR markdown LIKE '%![%')
        AND root_id IN (SELECT id FROM blocks WHERE type = 'd' ${notebookCondition})
        LIMIT 50000
      `)

      // ③ JS 端一次性统计所有维度
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

          const hasRef = md.includes("((")
          const hasImg = md.includes("!(")

          if (hasRef) {
            refDocSet.add(rootId)
            totalRefCount++
            outgoingSet.add(rootId)

            let match: RegExpExecArray | null
            while ((match = idPattern.exec(md)) !== null) {
              const targetId = match[1]
              if (allDocIds.has(targetId) && targetId !== rootId) {
                incomingSet.add(targetId)
              }
            }
          }

          if (hasImg) {
            imgDocSet.add(rootId)
            totalImgCount++
          }
        }
      }

      docStats.refDocs = refDocSet.size
      docStats.totalRefs = totalRefCount
      docStats.imageDocs = imgDocSet.size
      docStats.totalImages = totalImgCount
      docStats.incomingRefDocs = incomingSet.size
      incomingRefDocIds = incomingSet

      const hasOutOrIn = new Set([...outgoingSet, ...incomingSet])
      const orphans = new Set<string>()
      for (const id of allDocIds) {
        if (!hasOutOrIn.has(id)) orphans.add(id)
      }
      orphanDocIds = orphans
      docStats.orphanDocs = orphans.size
    }
    catch (error) {
      console.error("内容扫描分析失败:", error)
    }
  }

  /**
   * 书签使用分析
   * 思源中书签存储在 attributes 表，name='bookmark'
   */
  async function analyzeBookmarks(notebookCondition: string) {
    try {
      const bmSql = `
        SELECT
          COUNT(DISTINCT a.block_id) as bookmarked_docs,
          SUM(CASE WHEN a.value = '待发布' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN a.value = '已发布' THEN 1 ELSE 0 END) as published_count,
          SUM(CASE WHEN a.value = '不使用' THEN 1 ELSE 0 END) as unused_count,
          SUM(CASE WHEN a.value = '无' THEN 1 ELSE 0 END) as none_count
        FROM attributes a
        WHERE a.name = 'bookmark'
        AND a.block_id IN (
          SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition} LIMIT 50000
        )
      `

      const rows = await sql(bmSql)
      if (rows && rows.length > 0) {
        const row = rows[0]
        docStats.bookmarkedDocs = row.bookmarked_docs || 0
        docStats.pendingPublishDocs = row.pending_count || 0
        docStats.publishedDocs = row.published_count || 0
        docStats.unusedDocs = row.unused_count || 0
        docStats.noneBookmarkDocs = row.none_count || 0
      }

      // 自定义书签 Top-8（排除系统书签）
      const customSql = `
        SELECT a.value, COUNT(DISTINCT a.block_id) as cnt
        FROM attributes a
        WHERE a.name = 'bookmark'
        AND a.value NOT IN ('待发布', '已发布', '不使用', '无', '')
        AND a.block_id IN (
          SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition} LIMIT 50000
        )
        GROUP BY a.value
        ORDER BY cnt DESC
        LIMIT 8
      `
      const customRows = await sql(customSql)
      if (customRows) {
        docStats.customBookmarkTop = customRows.map((r: any) => ({
          value: r.value || "",
          count: r.cnt || 0,
        }))
      } else {
        docStats.customBookmarkTop = []
      }
    } catch (error) {
      console.error("书签分析失败:", error)
    }
  }

  /**
   * 平台发布状态分析
   * 两步查询：① 所有文档ID ② 所有 yaml 属性 → JS 聚合
   */
  async function analyzePlatformPublish(notebookCondition: string) {
    try {
      const allDocs = await sql(`
        SELECT b.id FROM blocks b
        LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
        WHERE b.type = 'd' AND COALESCE(sw.total_size, 0) > 0
        ${notebookCondition}
        LIMIT 10000
      `)
      if (!allDocs || allDocs.length === 0) return

      const yamlRows = await sql(`
        SELECT block_id, name
        FROM attributes
        WHERE name LIKE '%yaml%'
        AND block_id IN (
          SELECT b.id FROM blocks b
          LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
          WHERE b.type = 'd' AND COALESCE(sw.total_size, 0) > 0
          ${notebookCondition}
        )
        LIMIT 50000
      `)

      const docMap = new Map<string, number>()
      for (const doc of allDocs) {
        docMap.set(String(doc.id), 0)
      }

      // 从 PLATFORM_META 推导位掩码，消除硬编码重复
      const meta = PLATFORM_META.value
      const platformBits: [string, number][] = meta.flatMap((p, i) =>
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
          if (mask > 0) {
            docMap.set(id, docMap.get(id)! | mask)
          }
        }
      }

      let full = 0
      let partial = 0
      let no = 0
      const fullSet = new Set<string>()
      const noSet = new Set<string>()
      /** 各平台已发布文档计数（按 platform.id 索引） */
      const pCounts: Record<string, number> = {}
      for (const p of meta) pCounts[p.id] = 0

      const allMask = getAllPlatformsMask()
      let totalPlatformHits = 0 // ∑ 每个文档命中的平台数，用于计算人均

      for (const [id, mask] of docMap) {
        if (mask === 0) {
          no++
          noSet.add(id)
          continue
        }

        if (mask === allMask) {
          full++
          fullSet.add(id)
        }
        else {
          partial++
        }

        // 逐位统计各平台
        for (let i = 0; i < meta.length; i++) {
          if (mask & (1 << i)) {
            pCounts[meta[i].id]++
            totalPlatformHits++
          }
        }
      }

      const inSystem = docMap.size - no // 有任一平台发布属性的文档数

      // 各平台未发布数 = 在发布体系中但缺少该平台的文档数
      const unpubCounts: Record<string, number> = {}
      for (const p of meta) {
        unpubCounts[p.id] = inSystem - pCounts[p.id]
      }

      docStats.fullPublishDocs = full
      docStats.partialPublishDocs = partial
      docStats.noPublishDocs = no
      docStats.platformCounts = pCounts
      platformUnpublishedCounts.value = unpubCounts
      fullPublishDocIds = fullSet
      noPublishDocIds = noSet
    }
    catch (error) {
      console.error("平台发布状态分析失败:", error)
    }
  }

  /**
   * 内容质量分析：标签/别名/备注覆盖率
   *
   * 标签：blocks.tag 列直查（思源 native 列，逗号分隔）
   * 别名/备注：attributes 表聚合查询
   */
  async function analyzeContentQuality(notebookCondition: string) {
    const tagDocIds = new Set<string>()

    // ── 标签：blocks.tag 列 ──
    try {
      const tagSql = `
        SELECT id
        FROM blocks
        WHERE type = 'd' AND tag != ''
        ${notebookCondition}
        LIMIT 50000
      `
      const tagRows = await sql(tagSql)
      if (tagRows) {
        for (const row of tagRows) {
          tagDocIds.add(String(row.id))
        }
      }
    }
    catch (_e) {
      /* 保持 0 */
    }

    // ── 缓存 + 写入统计 ──
    taggedDocIds = tagDocIds
    docStats.taggedDocs = tagDocIds.size

    // ── 别名 / 备注 ──
    try {
      const [aliased, memoed] = await Promise.all([
        (async (): Promise<number> => {
          const rows = await sql(`
            SELECT COUNT(DISTINCT a.block_id) as cnt FROM attributes a
            WHERE a.name = 'alias' AND a.value != ''
            AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition})
          `)
          return rows?.[0]?.cnt ?? 0
        })(),
        (async (): Promise<number> => {
          const rows = await sql(`
            SELECT COUNT(DISTINCT a.block_id) as cnt FROM attributes a
            WHERE a.name = 'memo' AND a.value != ''
            AND a.block_id IN (SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition})
          `)
          return rows?.[0]?.cnt ?? 0
        })(),
      ])

      docStats.aliasedDocs = aliased
      docStats.memoedDocs = memoed
    }
    catch (error) {
      console.error("别名/备注统计失败:", error)
    }
  }

  /**
   * 查询所有书签详情（按值分组统计）
   */
  async function fetchBookmarkDetails() {
    if (bookmarkDetailVisible.value) {
      bookmarkDetailVisible.value = false
      return
    }
    bookmarkDetailLoading.value = true
    try {
      const notebookCondition = buildNotebookCondition()
      const sqlStmt = `
        SELECT a.value as bookmark_value, COUNT(DISTINCT a.block_id) as doc_count
        FROM attributes a
        WHERE a.name = 'bookmark'
        AND a.block_id IN (
          SELECT b.id FROM blocks b WHERE b.type = 'd' ${notebookCondition}
        )
        GROUP BY a.value
        ORDER BY doc_count DESC
      `
      const rows = await sql(sqlStmt)
      if (rows) {
        bookmarkDetails.value = rows.map((r: any) => ({
          value: r.bookmark_value || "",
          count: r.doc_count || 0,
        }))
      } else {
        bookmarkDetails.value = []
      }
      bookmarkDetailVisible.value = true
    } catch (error) {
      console.error("查询书签详情失败:", error)
      bookmarkDetails.value = []
    } finally {
      bookmarkDetailLoading.value = false
    }
  }

  /**
   * 按指定书签值查询文档列表
   */
  async function queryByBookmark(bookmarkValue: string) {
    bookmarkDetailVisible.value = false
    statsFilter.value = ""

    await runDocQuery({
      bookmarkInner: true,
      extraWhere: `AND bm.bookmark = ${quoteSql(bookmarkValue)}`,
      orderBy: "b.updated DESC",
    })
  }

  /**
   * 点击统计卡片 - 按类别查询文档列表
   */
  async function queryByStatsCategory(category: string) {
    if (statsFilter.value === category) {
      statsFilter.value = ""
      queryState.hasQueried = false
      setResults([])
      queryState.status = "idle"
      return
    }
    statsFilter.value = category

    // 重名类别走独立查询逻辑
    if (category === "duplicate") {
      await fetchDuplicateDocs()
      return
    }

    // 大小类别 - 使用通用查询（需要 size 子查询）
    const sizeConditions: Record<string, string> = {
      "0B": "AND COALESCE(sw.total_size, 0) = 0",
      "small": "AND COALESCE(sw.total_size, 0) > 0 AND COALESCE(sw.total_size, 0) < 1024",
      "medium": "AND COALESCE(sw.total_size, 0) >= 1024 AND COALESCE(sw.total_size, 0) < 10240",
      "large": "AND COALESCE(sw.total_size, 0) >= 10240 AND COALESCE(sw.total_size, 0) < 102400",
      "xlarge": "AND COALESCE(sw.total_size, 0) >= 102400",
    }

    if (sizeConditions[category]) {
      await runDocQuery({
        extraWhere: sizeConditions[category],
        orderBy: "word_count ASC",
      })
      return
    }

    // 类别 → DocQueryConfig
    let qConfig: DocQueryConfig

    // 按精确深度过滤（点击深度柱状图触发）
    if (category.startsWith("depth_")) {
      const d = Number.parseInt(category.slice(6), 10)
      if (!isNaN(d)) {
        qConfig = {
          extraWhere: `AND LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 = ${d}`,
          orderBy: "b.updated DESC",
        }
        await runDocQuery(qConfig)
        return
      }
    }

    switch (category) {
      case "7days":
        qConfig = { extraWhere: `AND b.updated >= '${daysAgoStr(7)}'` }
        break
      case "30days":
        qConfig = { extraWhere: `AND b.updated >= '${daysAgoStr(30)}' AND b.updated < '${daysAgoStr(7)}'` }
        break
      case "1to2month":
        qConfig = { extraWhere: `AND b.updated >= '${daysAgoStr(60)}' AND b.updated < '${daysAgoStr(30)}'` }
        break
      case "2to3month":
        qConfig = { extraWhere: `AND b.updated >= '${daysAgoStr(90)}' AND b.updated < '${daysAgoStr(60)}'` }
        break
      case "halfYear":
        qConfig = { extraWhere: `AND b.updated < '${daysAgoStr(180)}'` }
        break
      case "customTime": {
        let w = ""
        if (filterOptions.updatedAfter) w += `AND b.updated >= '${filterOptions.updatedAfter.replace(/-/g, "")}000000' `
        if (filterOptions.updatedBefore) w += `AND b.updated <= '${filterOptions.updatedBefore.replace(/-/g, "")}235959' `
        if (!w) { queryState.status = "empty"; return }
        qConfig = { extraWhere: w }
        break
      }
      case "deep":
        qConfig = {
          extraWhere: "AND LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 >= 5",
          orderBy: "doc_depth DESC",
        }
        break
      case "hasRef":
        qConfig = {
          extraSelect: "COALESCE(r.ref_count, 0) as ref_count, 0 as image_count,",
          extraJoin: `INNER JOIN (${REF_SUBQUERY}) r ON b.id = r.root_id`,
          orderBy: "r.ref_count DESC",
        }
        break
      case "hasImage":
        qConfig = {
          extraSelect: "0 as ref_count, COALESCE(img.image_count, 0) as image_count,",
          extraJoin: `INNER JOIN (${IMAGE_SUBQUERY}) img ON b.id = img.root_id`,
          orderBy: "img.image_count DESC",
        }
        break
      case "hasBookmark":
        qConfig = {
          bookmarkInner: true,
          extraWhere: "AND bm.bookmark != '无'",
          orderBy: "bm.bookmark ASC",
        }
        break
      case "noBookmark":
        qConfig = { extraWhere: "AND b.id NOT IN (SELECT block_id FROM attributes WHERE name = 'bookmark' LIMIT 10000)" }
        break
      case "noneBookmark":
        qConfig = { extraWhere: "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'bookmark' AND a.value = '无' AND a.block_id = b.id LIMIT 1)" }
        break
      case "pendingPublish":
        qConfig = { extraWhere: "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'bookmark' AND a.value = '待发布' AND a.block_id = b.id LIMIT 1)" }
        break
      case "published":
        qConfig = { extraWhere: "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'bookmark' AND a.value = '已发布' AND a.block_id = b.id LIMIT 1)" }
        break
      case "unused":
        qConfig = { extraWhere: "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'bookmark' AND a.value = '不使用' AND a.block_id = b.id LIMIT 1)" }
        break
      case "fullPublish":
        qConfig = { extraWhere: buildIdInClause(fullPublishDocIds) }
        break
      case "partialPublish":
        qConfig = { extraWhere: fullPublishDocIds.size === 0 && noPublishDocIds.size === 0 ? "AND 1 = 0" : buildIdNotInClause(new Set([...fullPublishDocIds, ...noPublishDocIds])) }
        break
      case "noPublish":
        qConfig = { extraWhere: buildIdInClause(noPublishDocIds) }
        break
      case "hasTag":
        qConfig = { extraWhere: buildIdInClause(taggedDocIds) }
        break
      case "noTag":
        qConfig = { extraWhere: buildIdNotInClause(taggedDocIds) }
        break
      case "hasAlias":
        qConfig = { extraWhere: "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'alias' AND a.value != '' AND a.block_id = b.id LIMIT 1)" }
        break
      case "hasMemo":
        qConfig = { extraWhere: "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'memo' AND a.value != '' AND a.block_id = b.id LIMIT 1)" }
        break
      case "incomingRef":
        qConfig = { extraWhere: buildIdInClause(incomingRefDocIds) }
        break
      case "orphanDoc":
        qConfig = { extraWhere: buildIdInClause(orphanDocIds) }
        break
      default:
        queryState.status = "empty"
        return
    }

    await runDocQuery(qConfig)
  }

  /**
   * 查询重名文档列表
   */
  async function fetchDuplicateDocs() {
    const dupTitles = duplicateGroups.value.map((g) => g.title)
    if (dupTitles.length === 0) {
      queryState.status = "empty"
      queryState.hasQueried = true
      setResults([])
      return
    }

    await runDocQuery({
      extraWhere: `AND b.content IN (${quoteSqlList(dupTitles)})`,
      orderBy: "b.content ASC, content_size ASC",
    })
  }

  /**
   * 执行查询 - 按字数和关键词过滤文档列表
   */
  async function queryDocs() {
    const needWordCountFilter = filterOptions.wordCountMin > 0 || filterOptions.wordCountMax > 0
    let conditions = ""

    if (filterOptions.titleKeyword.trim()) {
      conditions += `AND b.content LIKE '%${escapeSql(filterOptions.titleKeyword.trim())}%' `
    }

    if (filterOptions.contentKeyword.trim()) {
      const keyword = escapeSql(filterOptions.contentKeyword.trim())
      conditions += `AND b.id IN (SELECT DISTINCT root_id FROM blocks WHERE content LIKE '%${keyword}%' AND type != 'd') `
    }

    if (filterOptions.bookmarkName.trim()) {
      conditions += `AND b.id IN (SELECT block_id FROM attributes WHERE name='bookmark' AND value='${escapeSql(filterOptions.bookmarkName.trim())}') `
    }

    if (filterOptions.updatedAfter) {
      conditions += `AND b.updated >= '${filterOptions.updatedAfter.replace(/-/g, "")}000000' `
    }
    if (filterOptions.updatedBefore) {
      conditions += `AND b.updated <= '${filterOptions.updatedBefore.replace(/-/g, "")}235959' `
    }

    if (needWordCountFilter) {
      if (filterOptions.wordCountMin > 0) conditions += `AND COALESCE(sw.total_word_count, 0) >= ${filterOptions.wordCountMin} `
      if (filterOptions.wordCountMax > 0) conditions += `AND COALESCE(sw.total_word_count, 0) <= ${filterOptions.wordCountMax} `
    }

    await runDocQuery({
      extraWhere: conditions,
      orderBy: needWordCountFilter ? "word_count ASC" : "b.content ASC",
      skipSizeJoin: !needWordCountFilter,
    })

    await saveOptions()
  }

  /**
   * 排序文档列表
   */
  function sortDocs(docs: DocInfo[], field: string, order: string): DocInfo[] {
    return [...docs].sort((a, b) => {
      let compare = 0
      switch (field) {
        case "title":
          compare = a.title.localeCompare(b.title, "zh-CN")
          break
        case "notebook":
          compare = a.notebookName.localeCompare(b.notebookName, "zh-CN")
          break
        case "updated":
          compare = (a.updated || "").localeCompare(b.updated || "")
          break
        case "depth":
          compare = (a.depth || 0) - (b.depth || 0)
          break
        case "refCount":
          compare = (a.refCount || 0) - (b.refCount || 0)
          break
        case "imageCount":
          compare = (a.imageCount || 0) - (b.imageCount || 0)
          break
        case "bookmark":
          compare = (a.bookmark || "").localeCompare(b.bookmark || "", "zh-CN")
          break
        default:
          compare = a.wordCount - b.wordCount
      }
      return order === "desc" ? -compare : compare
    })
  }

  /**
   * 打开文档 - 在思源编辑器中打开
   */
  function openDoc(docId: string) {
    if (docId) {
      window.open(`siyuan://blocks/${docId}`)
    }
  }

  /**
   * 更新排序
   */
  function updateSort(field: string, order: string) {
    filterOptions.sortField = field as any
    filterOptions.sortOrder = order as any
    if (queryState.results.length > 0) {
      setResults(sortDocs(queryState.results, field, order))
    }
    saveOptions()
  }

  /** 清空查询结果 */
  function clearResults() {
    setResults([])
  }

  /**
   * 丰富文档列表：查询 yaml 属性，标记未发布平台
   */
  async function enrichWithPublishedPlatforms(docs: DocInfo[]) {
    if (docs.length === 0) return
    const idList = quoteSqlList(docs.map((d) => d.id))

    try {
      const yamlRows = await sql(`
        SELECT block_id, name FROM attributes
        WHERE name LIKE '%yaml%'
        AND block_id IN (${idList})
        LIMIT 10000
      `)

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
    } catch (error) {
      console.error("查询文档发布属性失败:", error)
    }
  }

  /**
   * 按缺失平台查询：查找在其他平台有发布标识、但指定平台未发布的文档
   * 没有任何发布标识的文档（不在发布范畴）不显示
   */
  async function queryByMissingPlatform(platformMatcher: string) {
    statsFilter.value = ""

    const platformEntry = PLATFORM_META.value.find((p) => p.id === platformMatcher || p.matchers.includes(platformMatcher))
    const matchers = platformEntry ? platformEntry.matchers : [platformMatcher]
    const nameConditions = matchers.map((m) => `name LIKE '%${escapeSql(m)}%'`).join(" OR ")

    await runDocQuery({
      extraWhere: `AND b.id IN (
          SELECT block_id FROM attributes
          WHERE name LIKE '%yaml%'
          AND block_id IN (
            SELECT b2.id FROM blocks b2
            LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw2 ON b2.id = sw2.root_id
            WHERE b2.type = 'd' AND COALESCE(sw2.total_size, 0) > 0
            ${buildNotebookCondition()}
          )
        )
        AND b.id NOT IN (
          SELECT block_id FROM attributes
          WHERE (${nameConditions}) AND name LIKE '%yaml%'
        )`,
    })
  }

  return {
    notebooks,
    queryState,
    filterOptions,
    docStats,
    depthStats,
    statsLoading,
    hasAnalyzed,
    statsFilter,
    bookmarkDetails,
    bookmarkDetailVisible,
    bookmarkDetailLoading,
    loadNotebooks,
    loadSavedOptions,
    queryDocs,
    analyzeDocStats,
    queryByStatsCategory,
    fetchBookmarkDetails,
    queryByBookmark,
    queryByMissingPlatform,
    openDoc,
    updateSort,
    clearResults,
    loadPlatformMeta,
    savePlatformMeta,
    platformUnpublishedCounts,
  }
}
