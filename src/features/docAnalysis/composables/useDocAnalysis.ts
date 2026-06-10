import type { Plugin } from "siyuan"
import type {
  BookmarkDetail,
  DepthStats,
  DocInfo,
  DocStats,
  DuplicateNameGroup,
  FilterOptions,
  QueryState,
} from "../types/index"

/**
 * 文档分析功能 - 核心业务逻辑
 */
import {
  reactive,
  ref,
} from "vue"
import {
  lsNotebooks,
  sql,
} from "@/api"
import {
  DEFAULT_FILTER_OPTIONS,
  DocAnalysisStorage,
} from "../types/storage"

/** 笔记本信息 */
export interface NotebookInfo {
  id: string
  name: string
}

/** 子查询：统计每个文档的内容大小和字数（合并减少扫描次数）
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

/** 平台元数据：matcher → 显示名称 */
const PLATFORM_META: { matchers: string[], name: string }[] = [
  { matchers: ["csdn"], name: "CSDN" },
  { matchers: ["zhihu"], name: "知乎" },
  { matchers: ["juejin"], name: "掘金" },
  { matchers: ["cnblogs", "blog"], name: "博客园" },
  { matchers: ["bili", "bibi"], name: "B站" },
  { matchers: ["gzh"], name: "公众号" },
  { matchers: ["jianshu"], name: "简书" },
  { matchers: ["51cto"], name: "51CTO" },
  { matchers: ["segmentfault", "sifou"], name: "思否" },
  { matchers: ["oschina"], name: "开源中国" },
]

/** 子查询：获取每个文档的书签名称（思源书签存储在 attributes 表中） */
const BOOKMARK_SUBQUERY = `
  SELECT block_id, value as bookmark
  FROM attributes
  WHERE name = 'bookmark'
`

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

/** 构建 SQL IN 子句（空集时返回不匹配条件） */
function buildIdInClause(ids: Set<string>): string {
  if (ids.size === 0) return "AND 1 = 0"
  const escaped = [...ids].map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
  return `AND b.id IN (${escaped})`
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

  // 文档统计信息
  const docStats = reactive<DocStats>({
    totalDocs: 0,
    zeroByteDocs: 0,
    smallDocs: 0,
    mediumDocs: 0,
    duplicateNameGroups: 0,
    duplicateNameDocs: 0,
    updatedIn7Days: 0,
    updatedIn30Days: 0,
    updatedIn1To2Months: 0,
    updatedIn2To3Months: 0,
    updatedOverHalfYear: 0,
    deepDocs: 0,
    refDocs: 0,
    totalRefs: 0,
    imageDocs: 0,
    totalImages: 0,
    bookmarkedDocs: 0,
    noBookmarkDocs: 0,
    pendingPublishDocs: 0,
    publishedDocs: 0,
    unusedDocs: 0,
    noneBookmarkDocs: 0,
    fullPublishDocs: 0,
    partialPublishDocs: 0,
    noPublishDocs: 0,
    taggedDocs: 0,
    aliasedDocs: 0,
    memoedDocs: 0,
    incomingRefDocs: 0,
    orphanDocs: 0,
  })
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
      publishStatus: row.publish_status || undefined,
      publishedPlatformCount: row.published_platform_count ?? undefined,
    }))
  }

  /** 查询文档列表（带条件），公共核心逻辑 */
  async function fetchDocList(extraCondition: string) {
    queryState.status = "loading"
    queryState.errorMessage = ""
    queryState.hasQueried = true

    try {
      const notebookCondition = buildNotebookCondition()

      const sqlStmt = `
        SELECT
          b.id as doc_id,
          b.content as doc_title,
          b.hpath as doc_path,
          b.box as notebook_id,
          b.updated as doc_updated,
          b.created as doc_created,
          COALESCE(sw.total_size, 0) as content_size,
          COALESCE(sw.total_word_count, 0) as word_count,
          LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth,
          COALESCE(bm.bookmark, '') as bookmark
        FROM blocks b
        LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
        LEFT JOIN (${BOOKMARK_SUBQUERY}) bm ON b.id = bm.block_id
        WHERE b.type = 'd' ${notebookCondition}
        ${extraCondition}
        ORDER BY word_count ASC
        LIMIT 2000
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
            SUM(CASE WHEN COALESCE(sw.total_size, 0) >= 1024 AND COALESCE(sw.total_size, 0) < 10240 THEN 1 ELSE 0 END) as medium_count
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
      ])

      // ── 阶段 2：汇总 ──
      if (sizeRows && sizeRows.length > 0) {
        const row = sizeRows[0]
        docStats.totalDocs = row.total || 0
        docStats.zeroByteDocs = row.zero_count || 0
        docStats.smallDocs = row.small_count || 0
        docStats.mediumDocs = row.medium_count || 0
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
        SELECT id FROM blocks WHERE type = 'd' ${notebookCondition} LIMIT 10000
      `)
      if (!allDocs || allDocs.length === 0) return

      const yamlRows = await sql(`
        SELECT block_id, name
        FROM attributes
        WHERE name LIKE '%yaml%'
        AND block_id IN (SELECT id FROM blocks WHERE type = 'd' ${notebookCondition})
        LIMIT 50000
      `)

      const docMap = new Map<string, number>()
      for (const doc of allDocs) {
        docMap.set(String(doc.id), 0)
      }

      const MATCHERS: [string, number][] = [
        ["csdn", 1],
        ["zhihu", 2],
        ["juejin", 4],
        ["cnblogs", 8],
        ["blog", 8],
        ["bili", 16],
        ["bibi", 16],
        ["gzh", 32],
        ["jianshu", 64],
        ["51cto", 128],
        ["segmentfault", 256],
        ["sifou", 256],
        ["oschina", 512],
      ]

      if (yamlRows) {
        for (const row of yamlRows) {
          const id = String(row.block_id)
          if (!docMap.has(id)) continue
          const name = String(row.name).toLowerCase()
          let mask = 0
          for (const [m, bit] of MATCHERS) {
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
      const ALL_PLATFORMS = 1023 // 1+2+4+8+16+32+64+128+256+512 = 63

      for (const [id, mask] of docMap) {
        if (mask === 0) {
          no++
          noSet.add(id)
        }
        else if (mask === ALL_PLATFORMS) {
          full++
          fullSet.add(id)
        }
        else {
          partial++
        }
      }

      docStats.fullPublishDocs = full
      docStats.partialPublishDocs = partial
      docStats.noPublishDocs = no
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

    queryState.status = "loading"
    queryState.errorMessage = ""
    queryState.hasQueried = true

    try {
      const notebookCondition = buildNotebookCondition()
      const escaped = bookmarkValue.replace(/'/g, "''")

      const sqlStmt = `
        SELECT
          b.id as doc_id,
          b.content as doc_title,
          b.hpath as doc_path,
          b.box as notebook_id,
          b.updated as doc_updated,
          b.created as doc_created,
          COALESCE(sw.total_size, 0) as content_size,
          COALESCE(sw.total_word_count, 0) as word_count,
          LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth,
          COALESCE(bm.bookmark, '') as bookmark
        FROM blocks b
        LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
        INNER JOIN (${BOOKMARK_SUBQUERY}) bm ON b.id = bm.block_id
        WHERE b.type = 'd' ${notebookCondition}
        AND bm.bookmark = '${escaped}'
        ORDER BY b.updated DESC
        LIMIT 2000
      `

      const rows = await sql(sqlStmt)
      if (!rows || rows.length === 0) {
        setResults([])
        queryState.status = "empty"
      } else {
        const docs = mapRowsToDocs(rows)
        const sortedDocs = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder)
        await enrichWithPublishedPlatforms(sortedDocs)
        setResults(sortedDocs)
        queryState.status = "success"
      }
    } catch (error) {
      console.error("按书签查询文档失败:", error)
      queryState.errorMessage = (error as Error).message || "查询失败"
      queryState.status = "error"
      setResults([])
    }
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
    }

    if (sizeConditions[category]) {
      await fetchDocList(sizeConditions[category])
      return
    }

    // 新类别（时间/深度/引用/图片）使用轻量查询
    queryState.status = "loading"
    queryState.errorMessage = ""
    queryState.hasQueried = true

    try {
      const notebookCondition = buildNotebookCondition()

      // 根据类别确定额外条件、JOIN 和排序
      let extraWhere = ""
      let extraJoin = ""
      let refCol = "0 as ref_count"
      let imgCol = "0 as image_count"
      let orderBy = "b.updated DESC"

      switch (category) {
        case "7days":
          extraWhere = `AND b.updated >= '${daysAgoStr(7)}'`
          break
        case "30days":
          extraWhere = `AND b.updated >= '${daysAgoStr(30)}' AND b.updated < '${daysAgoStr(7)}'`
          break
        case "1to2month":
          extraWhere = `AND b.updated >= '${daysAgoStr(60)}' AND b.updated < '${daysAgoStr(30)}'`
          break
        case "2to3month":
          extraWhere = `AND b.updated >= '${daysAgoStr(90)}' AND b.updated < '${daysAgoStr(60)}'`
          break
        case "halfYear":
          extraWhere = `AND b.updated < '${daysAgoStr(180)}'`
          break
        case "customTime": {
          // 使用自定义时间范围
          if (filterOptions.updatedAfter) {
            const afterStr = `${filterOptions.updatedAfter.replace(/-/g, "")}000000`
            extraWhere += `AND b.updated >= '${afterStr}' `
          }
          if (filterOptions.updatedBefore) {
            const beforeStr = `${filterOptions.updatedBefore.replace(/-/g, "")}235959`
            extraWhere += `AND b.updated <= '${beforeStr}' `
          }
          if (!filterOptions.updatedAfter && !filterOptions.updatedBefore) {
            queryState.status = "empty"
            return
          }
          break
        }
        case "deep":
          extraWhere = "AND LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 >= 5"
          orderBy = "doc_depth DESC"
          break
        case "hasRef":
          extraJoin = `INNER JOIN (${REF_SUBQUERY}) r ON b.id = r.root_id`
          refCol = "COALESCE(r.ref_count, 0) as ref_count"
          orderBy = "r.ref_count DESC"
          break
        case "hasImage":
          extraJoin = `INNER JOIN (${IMAGE_SUBQUERY}) img ON b.id = img.root_id`
          imgCol = "COALESCE(img.image_count, 0) as image_count"
          orderBy = "img.image_count DESC"
          break
        case "hasBookmark":
          extraJoin = `INNER JOIN (${BOOKMARK_SUBQUERY}) bm ON b.id = bm.block_id`
          extraWhere = "AND bm.bookmark != '无'"
          orderBy = "bm.bookmark ASC"
          break
        case "noBookmark":
          extraWhere = "AND b.id NOT IN (SELECT block_id FROM attributes WHERE name = 'bookmark' LIMIT 10000)"
          orderBy = "b.updated DESC"
          break
        case "noneBookmark":
          extraWhere = "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'bookmark' AND a.value = '无' AND a.block_id = b.id LIMIT 1)"
          orderBy = "b.updated DESC"
          break
        case "pendingPublish":
          extraWhere = "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'bookmark' AND a.value = '待发布' AND a.block_id = b.id LIMIT 1)"
          orderBy = "b.updated DESC"
          break
        case "published":
          extraWhere = "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'bookmark' AND a.value = '已发布' AND a.block_id = b.id LIMIT 1)"
          orderBy = "b.updated DESC"
          break
        case "unused":
          extraWhere = "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'bookmark' AND a.value = '不使用' AND a.block_id = b.id LIMIT 1)"
          orderBy = "b.updated DESC"
          break
        case "fullPublish":
          extraWhere = buildIdInClause(fullPublishDocIds)
          orderBy = "b.updated DESC"
          break
        case "partialPublish":
          if (fullPublishDocIds.size === 0 && noPublishDocIds.size === 0) {
            extraWhere = "AND 1 = 0"
          } else {
            const exclude = new Set([...fullPublishDocIds, ...noPublishDocIds])
            const escaped = [...exclude].map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
            extraWhere = `AND b.id NOT IN (${escaped})`
          }
          orderBy = "b.updated DESC"
          break
        case "noPublish":
          extraWhere = buildIdInClause(noPublishDocIds)
          orderBy = "b.updated DESC"
          break
        case "hasTag":
          extraWhere = buildIdInClause(taggedDocIds)
          orderBy = "b.updated DESC"
          break
        case "noTag":
          if (taggedDocIds.size === 0) {
            extraWhere = ""
          }
          else {
            const escaped = [...taggedDocIds].map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
            extraWhere = `AND b.id NOT IN (${escaped})`
          }
          orderBy = "b.updated DESC"
          break
        case "hasAlias":
          extraWhere = "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'alias' AND a.value != '' AND a.block_id = b.id LIMIT 1)"
          orderBy = "b.updated DESC"
          break
        case "hasMemo":
          extraWhere = "AND EXISTS (SELECT 1 FROM attributes a WHERE a.name = 'memo' AND a.value != '' AND a.block_id = b.id LIMIT 1)"
          orderBy = "b.updated DESC"
          break
        case "incomingRef":
          extraWhere = buildIdInClause(incomingRefDocIds)
          orderBy = "b.updated DESC"
          break
        case "orphanDoc":
          extraWhere = buildIdInClause(orphanDocIds)
          orderBy = "b.updated DESC"
          break
        default:
          queryState.status = "empty"
          return
      }

      const sqlStmt = `
        SELECT
          b.id as doc_id,
          b.content as doc_title,
          b.hpath as doc_path,
          b.box as notebook_id,
          b.updated as doc_updated,
          b.created as doc_created,
          COALESCE(sw.total_size, 0) as content_size,
          COALESCE(sw.total_word_count, 0) as word_count,
          LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth,
          ${refCol},
          ${imgCol},
          COALESCE(bm_out.bookmark, '') as bookmark
        FROM blocks b
        LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
        LEFT JOIN (${BOOKMARK_SUBQUERY}) bm_out ON b.id = bm_out.block_id
        ${extraJoin}
        WHERE b.type = 'd' ${notebookCondition}
        ${extraWhere}
        ORDER BY ${orderBy}
        LIMIT 2000
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
      console.error("按类别查询文档失败:", error)
      queryState.errorMessage = (error as Error).message || "查询失败"
      queryState.status = "error"
      setResults([])
    }
  }

  /**
   * 查询重名文档列表
   */
  async function fetchDuplicateDocs() {
    queryState.status = "loading"
    queryState.errorMessage = ""
    queryState.hasQueried = true

    try {
      const notebookCondition = buildNotebookCondition()

      const dupTitles = duplicateGroups.value.map((g) => g.title)
      if (dupTitles.length === 0) {
        setResults([])
        queryState.status = "empty"
        return
      }

      const titleList = dupTitles.map((t) => `'${t.replace(/'/g, "''")}'`).join(",")

      const sqlStmt = `
        SELECT
          b.id as doc_id,
          b.content as doc_title,
          b.hpath as doc_path,
          b.box as notebook_id,
          b.updated as doc_updated,
          b.created as doc_created,
          COALESCE(sw.total_size, 0) as content_size,
          COALESCE(sw.total_word_count, 0) as word_count,
          LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth,
          COALESCE(bm.bookmark, '') as bookmark
        FROM blocks b
        LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
        LEFT JOIN (${BOOKMARK_SUBQUERY}) bm ON b.id = bm.block_id
        WHERE b.type = 'd' ${notebookCondition}
        AND b.content IN (${titleList})
        ORDER BY b.content ASC, content_size ASC
        LIMIT 2000
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
      console.error("查询重名文档失败:", error)
      queryState.errorMessage = (error as Error).message || "查询失败"
      queryState.status = "error"
      setResults([])
    }
  }

  /**
   * 执行查询 - 按字数和关键词过滤文档列表
   */
  async function queryDocs() {
    queryState.status = "loading"
    queryState.errorMessage = ""
    queryState.hasQueried = true

    try {
      const notebookCondition = buildNotebookCondition()
      const needWordCountFilter = filterOptions.wordCountMin > 0 || filterOptions.wordCountMax > 0
      let conditions = ""

      if (filterOptions.titleKeyword.trim()) {
        const keyword = filterOptions.titleKeyword.trim().replace(/'/g, "''")
        conditions += `AND b.content LIKE '%${keyword}%' `
      }

      // 全文内容搜索：查找内容块中包含关键词的文档
      if (filterOptions.contentKeyword.trim()) {
        const keyword = filterOptions.contentKeyword.trim().replace(/'/g, "''")
        conditions += `AND b.id IN (
          SELECT DISTINCT root_id FROM blocks
          WHERE content LIKE '%${keyword}%' AND type != 'd'
        ) `
      }

      if (filterOptions.bookmarkName.trim()) {
        const bmName = filterOptions.bookmarkName.trim().replace(/'/g, "''")
        conditions += `AND b.id IN (SELECT block_id FROM attributes WHERE name='bookmark' AND value='${bmName}') `
      }

      // 自定义时间范围过滤
      if (filterOptions.updatedAfter) {
        const afterStr = `${filterOptions.updatedAfter.replace(/-/g, "")}000000`
        conditions += `AND b.updated >= '${afterStr}' `
      }
      if (filterOptions.updatedBefore) {
        const beforeStr = `${filterOptions.updatedBefore.replace(/-/g, "")}235959`
        conditions += `AND b.updated <= '${beforeStr}' `
      }

      if (needWordCountFilter) {
        // 需要字数过滤时才 JOIN 子查询
        if (filterOptions.wordCountMin > 0) {
          conditions += `AND COALESCE(sw.total_word_count, 0) >= ${filterOptions.wordCountMin} `
        }
        if (filterOptions.wordCountMax > 0) {
          conditions += `AND COALESCE(sw.total_word_count, 0) <= ${filterOptions.wordCountMax} `
        }

        const sqlStmt = `
          SELECT
            b.id as doc_id,
            b.content as doc_title,
            b.hpath as doc_path,
            b.box as notebook_id,
            b.updated as doc_updated,
            b.created as doc_created,
            COALESCE(sw.total_size, 0) as content_size,
            COALESCE(sw.total_word_count, 0) as word_count,
            LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth,
            COALESCE(bm.bookmark, '') as bookmark
          FROM blocks b
          LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
          LEFT JOIN (${BOOKMARK_SUBQUERY}) bm ON b.id = bm.block_id
          WHERE b.type = 'd' ${notebookCondition}
          ${conditions}
          ORDER BY word_count ASC
          LIMIT 2000
        `

        const rows = await sql(sqlStmt)
        if (!rows || rows.length === 0) {
          setResults([])
          queryState.status = "empty"
        } else {
          const docs = mapRowsToDocs(rows)
          const sortedDocs = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder)
          await enrichWithPublishedPlatforms(sortedDocs)
          setResults(sortedDocs)
          queryState.status = "success"
        }
      } else {
        // 不需要字数过滤时，轻量查询（不 JOIN 子查询）
        const sqlStmt = `
          SELECT
            b.id as doc_id,
            b.content as doc_title,
            b.hpath as doc_path,
            b.box as notebook_id,
            b.updated as doc_updated,
            b.created as doc_created,
            0 as content_size,
            0 as word_count,
            LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth,
            COALESCE(bm.bookmark, '') as bookmark
          FROM blocks b
          LEFT JOIN (${BOOKMARK_SUBQUERY}) bm ON b.id = bm.block_id
          WHERE b.type = 'd' ${notebookCondition}
          ${conditions}
          ORDER BY b.content ASC
          LIMIT 2000
        `

        const rows = await sql(sqlStmt)
        if (!rows || rows.length === 0) {
          setResults([])
          queryState.status = "empty"
        } else {
          const docs = mapRowsToDocs(rows)
          const sortedDocs = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder)
          await enrichWithPublishedPlatforms(sortedDocs)
          setResults(sortedDocs)
          queryState.status = "success"
        }
      }
    } catch (error) {
      console.error("查询文档列表失败:", error)
      queryState.errorMessage = (error as Error).message || "查询失败"
      queryState.status = "error"
      setResults([])
    }

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
    const idList = docs.map((d) => `'${d.id.replace(/'/g, "''")}'`).join(",")

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
          const name = String(row.name).toLowerCase()
          for (const meta of PLATFORM_META) {
            for (const matcher of meta.matchers) {
              if (name.includes(matcher)) {
                docPublishedMap.get(id)!.add(matcher)
                break
              }
            }
          }
        }
      }

      for (const doc of docs) {
        const published = docPublishedMap.get(doc.id) || new Set()
        const unpublished = PLATFORM_META
          .filter((m) => !m.matchers.some((mt) => published.has(mt)))
          .map((m) => m.name)
        doc.unpublishedPlatforms = unpublished.length > 0 ? unpublished : undefined
      }
    } catch (error) {
      console.error("查询文档发布属性失败:", error)
    }
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
    openDoc,
    updateSort,
    clearResults,
  }
}
