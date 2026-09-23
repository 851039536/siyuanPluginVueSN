/**
 * 全局关系列表数据层 composable
 *
 * 通过思源 API 聚合全库文档间的双向链接关系（两者结合）：
 * 1. 主列表：SQL API 查询 refs 表，按文档对聚合跨文档引用，识别双向引用
 * 2. 详情：SQL 查询 refs.content 锚文本 + getBacklink2 官方 API 补充反链文档列表
 */
import {
  computed,
  ref,
} from "vue"
import {
  getBacklinkDocs,
  sql,
} from "@/api"
import { openBlock } from "@/utils/domUtils"
import { escapeSql } from "@/utils/sqlHelpers"
import { getErrorMessage } from "@/utils/stringUtils"
import { parseAnchorText } from "../utils"
import type {
  DirectionFilter,
  GlobalRelationsI18n,
  GlobalRelationRow,
} from "../types"

/** 主列表最大行数（超出后截断并提示） */
const MAX_RELATION_ROWS = 500

/** 主列表查询结果：关系行 + 是否因超限被截断 */
interface GlobalRelationsQueryResult {
  rows: GlobalRelationRow[]
  truncated: boolean
}

/**
 * 查询全局文档间双向链接关系（SQL refs 表按文档对聚合）
 *
 * refs 表真实结构：
 *   block_id / root_id             → 引用方块 / 引用方文档
 *   def_block_id / def_block_root_id → 被引用块 / 被引用方文档
 * blocks 表中文档块（type='d'）的标题存于 content 字段，name 为空。
 *
 * 多取一条（LIMIT + 1）用于判断是否超过 MAX_RELATION_ROWS，超限则截断并标记 truncated。
 */
async function queryGlobalRelations(): Promise<GlobalRelationsQueryResult> {
  // 按文档对聚合跨文档引用，EXISTS 判断是否双向引用。
  const stmt = `
    SELECT
      r.root_id           AS sourceId,
      sb.content          AS sourceName,
      sb.hpath            AS sourceHPath,
      r.def_block_root_id AS targetId,
      tb.content          AS targetName,
      tb.hpath            AS targetHPath,
      COUNT(*)            AS refCount,
      EXISTS (
        SELECT 1 FROM refs r2
        WHERE r2.root_id = r.def_block_root_id
          AND r2.def_block_root_id = r.root_id
      )                   AS bidirectional
    FROM refs r
    JOIN blocks sb ON sb.id = r.root_id
    JOIN blocks tb ON tb.id = r.def_block_root_id
    WHERE r.root_id != r.def_block_root_id
    GROUP BY r.root_id, r.def_block_root_id
    ORDER BY refCount DESC, sourceName ASC
    LIMIT ${MAX_RELATION_ROWS + 1}
  `
  const data = await sql(stmt)
  if (!Array.isArray(data)) return { rows: [], truncated: false }
  const mapped = (data as Array<Record<string, unknown>>).map((item) => ({
    sourceId: String(item.sourceId ?? ""),
    sourceName: String(item.sourceName ?? ""),
    sourceHPath: String(item.sourceHPath ?? ""),
    targetId: String(item.targetId ?? ""),
    targetName: String(item.targetName ?? ""),
    targetHPath: String(item.targetHPath ?? ""),
    refCount: Number(item.refCount ?? 0),
    bidirectional: item.bidirectional === 1 || item.bidirectional === "1" || item.bidirectional === true,
  }))
  const truncated = mapped.length > MAX_RELATION_ROWS
  return {
    rows: truncated ? mapped.slice(0, MAX_RELATION_ROWS) : mapped,
    truncated,
  }
}

/**
 * 查询某个文档对的引用锚文本详情（SQL refs.content）
 */
async function queryRelationContents(
  sourceId: string,
  targetId: string,
  limit: number = 50,
): Promise<string[]> {
  const stmt = `
    SELECT content
    FROM refs
    WHERE root_id = '${escapeSql(sourceId)}'
      AND def_block_root_id = '${escapeSql(targetId)}'
    LIMIT ${Math.max(1, Math.min(limit, 200))}
  `
  const data = await sql(stmt)
  if (!Array.isArray(data)) return []
  return (data as Array<{ content?: unknown }>)
    .map((item) => parseAnchorText(item.content))
    .filter((text) => text.length > 0)
}

export function useGlobalRelations(
  i18n: GlobalRelationsI18n,
) {
  const loading = ref(false)
  const error = ref("")
  const rows = ref<GlobalRelationRow[]>([])
  const searchQuery = ref("")
  const directionFilter = ref<DirectionFilter>("all")
  const truncated = ref(false)

  // 关系数量统计
  const stats = computed(() => {
    const list = rows.value
    const bidirectionalCount = list.filter((r) => r.bidirectional).length
    const docIds = new Set<string>()
    for (const row of list) {
      docIds.add(row.sourceId)
      docIds.add(row.targetId)
    }
    return {
      total: list.length,
      docs: docIds.size,
      bidirectional: bidirectionalCount,
      unidirectional: list.length - bidirectionalCount,
    }
  })

  // 搜索 + 方向过滤后的关系列表
  const filtered = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    let list = rows.value
    if (directionFilter.value === "bidirectional") {
      list = list.filter((r) => r.bidirectional)
    } else if (directionFilter.value === "unidirectional") {
      list = list.filter((r) => !r.bidirectional)
    }
    if (q) {
      list = list.filter(
        (r) =>
          r.sourceName.toLowerCase().includes(q)
          || r.targetName.toLowerCase().includes(q)
          || r.sourceHPath.toLowerCase().includes(q)
          || r.targetHPath.toLowerCase().includes(q),
      )
    }
    return list
  })

  /**
   * 刷新全局关系列表
   */
  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ""
    try {
      const result = await queryGlobalRelations()
      rows.value = result.rows
      truncated.value = result.truncated
    } catch (e: unknown) {
      error.value = getErrorMessage(e) || i18n.loadFailed
      console.error("[globalRelations] 查询全局关系失败:", e)
    } finally {
      loading.value = false
    }
  }

  /**
   * 按需加载并展开某条关系的详情：
   * SQL 锚文本（refs.content）+ getBacklink2 反链文档列表，两者结合相互印证。
   */
  async function toggleDetails(row: GlobalRelationRow): Promise<void> {
    if (row.detailsExpanded) {
      row.detailsExpanded = false
      return
    }
    row.detailsExpanded = true
    if (row.detailsLoading) return
    row.detailsLoading = true
    row.detailsFailed = false
    try {
      const [contents, backlinkDocs] = await Promise.all([
        queryRelationContents(row.sourceId, row.targetId),
        getBacklinkDocs(row.targetId),
      ])
      row.contents = contents
      row.backlinkDocs = backlinkDocs
      // 注意：空结果不是失败 —— 「无锚文本」「无反链」由模板的专门空态文案承载，
      // 只有请求真的抛错才置 detailsFailed。
    } catch (e: unknown) {
      console.error("[globalRelations] 加载关系详情失败:", e)
      row.detailsFailed = true
    } finally {
      row.detailsLoading = false
    }
  }

  /**
   * 跳转打开文档（复用统一入口 @/utils/domUtils 的 openBlock）
   */
  function openDoc(docId: string): void {
    openBlock(docId)
  }

  return {
    loading,
    error,
    searchQuery,
    directionFilter,
    stats,
    filtered,
    truncated,
    refresh,
    toggleDetails,
    openDoc,
  }
}
