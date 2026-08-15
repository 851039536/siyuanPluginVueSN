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
  getBacklink,
  sql,
} from "@/api"
import { getErrorMessage } from "@/utils/stringUtils"

/** 反向链接文档条目（getBacklink2 返回） */
export interface BacklinkDoc {
  id: string
  name: string
  hPath: string
  box: string
}

/** 单条文档间关系记录 */
export interface GlobalRelationRow {
  /** 引用方文档 ID */
  sourceId: string
  /** 引用方文档标题 */
  sourceName: string
  /** 引用方文档路径 */
  sourceHPath: string
  /** 被引用方文档 ID */
  targetId: string
  /** 被引用方文档标题 */
  targetName: string
  /** 被引用方文档路径 */
  targetHPath: string
  /** 引用次数 */
  refCount: number
  /** 是否为双向引用（对方也引用了本方） */
  bidirectional: boolean
  /** 引用锚文本详情（按需加载） */
  contents?: string[]
  /** 反向链接文档列表（getBacklink2 按需加载） */
  backlinkDocs?: BacklinkDoc[]
  /** 详情加载中 */
  detailsLoading?: boolean
  /** 详情已展开 */
  detailsExpanded?: boolean
  /** 详情加载失败标记 */
  detailsFailed?: boolean
}

export type DirectionFilter = "all" | "bidirectional" | "unidirectional"

/** SQL 字符串字面量转义（防御性，防止 id 中的单引号破坏查询） */
function escapeSql(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * 解析 refs.content 字段：可能是锚文本明文，也可能是 JSON 字符串/数组/对象
 */
export function parseAnchorText(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  if (typeof raw !== "string") {
    return String(raw)
  }
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === "string") return parsed
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string").join(" ")
    }
    if (parsed && typeof parsed === "object") {
      const text = (parsed as any).text
        ?? (parsed as any).content
        ?? (parsed as any).name
        ?? (parsed as any).anchor
      if (typeof text === "string" && text) return text
      return JSON.stringify(parsed)
    }
    return trimmed
  } catch {
    // 非 JSON，按明文返回
    return trimmed
  }
}

/**
 * 查询全局文档间双向链接关系（SQL refs 表按文档对聚合）
 *
 * refs 表真实结构：
 *   block_id / root_id             → 引用方块 / 引用方文档
 *   def_block_id / def_block_root_id → 被引用块 / 被引用方文档
 * blocks 表中文档块（type='d'）的标题存于 content 字段，name 为空。
 */
async function queryGlobalRelations(): Promise<GlobalRelationRow[]> {
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
  `
  const data = await sql(stmt)
  if (!Array.isArray(data)) return []
  return (data as Array<Record<string, unknown>>).map((item) => ({
    sourceId: String(item.sourceId ?? ""),
    sourceName: String(item.sourceName ?? ""),
    sourceHPath: String(item.sourceHPath ?? ""),
    targetId: String(item.targetId ?? ""),
    targetName: String(item.targetName ?? ""),
    targetHPath: String(item.targetHPath ?? ""),
    refCount: Number(item.refCount ?? 0),
    bidirectional: item.bidirectional === 1 || item.bidirectional === "1" || item.bidirectional === true,
  }))
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

/**
 * 查询某个文档的反向链接文档列表（getBacklink2 官方 API）
 * 合并 backlinks + backmentions 并按 id 去重，与思源前端反链面板同源。
 */
async function queryBacklinkDocs(targetId: string): Promise<BacklinkDoc[]> {
  if (!targetId) return []
  const res = await getBacklink(targetId)
  const seen = new Set<string>()
  const docs: BacklinkDoc[] = []
  const files = [
    ...(res?.backlinks ?? []),
    ...(res?.backmentions ?? []),
  ]
  for (const file of files) {
    if (seen.has(file.id)) continue
    seen.add(file.id)
    docs.push({
      id: file.id,
      name: file.name,
      hPath: file.hPath || "",
      box: file.box || "",
    })
  }
  return docs
}

export function useGlobalRelations(
  i18n: Record<string, string>,
) {
  const loading = ref(false)
  const error = ref("")
  const rows = ref<GlobalRelationRow[]>([])
  const searchQuery = ref("")
  const directionFilter = ref<DirectionFilter>("all")

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
      rows.value = await queryGlobalRelations()
    } catch (e: unknown) {
      error.value = getErrorMessage(e) || i18n.loadFailed || "加载失败"
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
        queryBacklinkDocs(row.targetId),
      ])
      row.contents = contents
      row.backlinkDocs = backlinkDocs
      if (contents.length === 0 && backlinkDocs.length === 0) {
        row.detailsFailed = true
      }
    } catch (e: unknown) {
      console.error("[globalRelations] 加载关系详情失败:", e)
      row.detailsFailed = true
    } finally {
      row.detailsLoading = false
    }
  }

  /**
   * 跳转打开文档
   */
  function openDoc(docId: string): void {
    if (!docId) return
    window.open(`siyuan://blocks/${docId}`)
  }

  return {
    loading,
    error,
    rows,
    searchQuery,
    directionFilter,
    stats,
    filtered,
    refresh,
    toggleDetails,
    openDoc,
  }
}
