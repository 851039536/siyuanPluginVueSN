/**
 * 文档分析功能 - 核心业务聚合入口（查询执行器 + 平台操作 + 统计逻辑组装）
 */
import type { Plugin } from "siyuan"
import { nextTick, onScopeDispose, reactive, ref, watch } from "vue"
import {
  lsNotebooks,
  sql,
} from "@/api"
import type {
  DocInfo,
  FilterOptions,
  HealthSettings,
  NotebookInfo,
  PlatformMeta,
  QueryState,
} from "../types/index"
import {
  DEFAULT_FILTER_OPTIONS,
  DEFAULT_HEALTH_SETTINGS,
  DEFAULT_PLATFORM_META,
} from "../types/index"
import {
  DocAnalysisStorage,
} from "../types/storage"
import {
  computeUnpublishedPlatformNames,
  getPlatformIdFromAttrKey,
} from "../utils/platformPublish"
import {
  buildIdInClause,
  escapeSql,
  quoteSql,
  quoteSqlList,
} from "../utils/sqlHelpers"
import {
  BOOKMARK_SUBQUERY,
  DOC_SELECT,
  DOC_SELECT_NO_SIZE,
  SIZE_WORDCOUNT_SUBQUERY,
} from "../utils/sqlConstants"
import type { DocQueryConfig } from "../utils/categoryQueryConfig"
import { sortDocs } from "../utils/sortDocs"
import { useDocStats } from "./useDocStats"
import { PLATFORM_META } from "./platformMeta"

/**
 * 文档分析 composable（须在组件 setup 中调用，watch/onScopeDispose 依赖当前 effect 作用域自动回收）
 */
export function useDocAnalysis(plugin: Plugin) {
  const storage = new DocAnalysisStorage(plugin)
  const notebooks = ref<NotebookInfo[]>([])

  // ============================================================
  // 健康度扣分项设置（加载 + watch 持久化，防回写覆盖）
  // ============================================================

  /** 首次加载完成前跳过持久化（避免加载回填触发回写覆盖存储） */
  let healthSettingsLoaded = false

  /** 深拷贝默认健康度设置（避免与 DEFAULT_HEALTH_SETTINGS 共享数组引用） */
  function makeDefaultHealthSettings(): HealthSettings {
    return { enabledDeductions: [...DEFAULT_HEALTH_SETTINGS.enabledDeductions] }
  }

  const healthSettings = ref<HealthSettings>(makeDefaultHealthSettings())

  async function loadHealthSettings() {
    try {
      const saved = await storage.healthSettings.loadOrDefault()
      healthSettings.value = {
        enabledDeductions: saved.enabledDeductions.length > 0
          ? [...saved.enabledDeductions]
          : [...DEFAULT_HEALTH_SETTINGS.enabledDeductions],
      }
    } catch {
      healthSettings.value = makeDefaultHealthSettings()
    }
    // 等 watch 刷新完成后再放行持久化，避免加载回填（或加载失败置空）触发回写覆盖存储
    await nextTick()
    healthSettingsLoaded = true
  }

  watch(healthSettings, async (val) => {
    if (!healthSettingsLoaded) return
    await storage.healthSettings.save(val)
  })

  const queryState = reactive<QueryState>({
    status: "idle",
    results: [] as DocInfo[],
    errorMessage: "",
    hasQueried: false,
  })

  function setResults(docs: DocInfo[]) { queryState.results = docs }

  /** 统一空结果状态：清空旧结果并标记已查询，避免 status 与 results 不一致 */
  function setEmptyState() {
    setResults([])
    queryState.hasQueried = true
    queryState.status = "empty"
  }

  /** 统一重置查询视图：清空结果、清除错误并回到 idle 状态，供各过滤/重置入口复用 */
  function resetQueryState() {
    setResults([])
    queryState.hasQueried = false
    queryState.status = "idle"
    queryState.errorMessage = ""
  }

  const filterOptions = reactive<FilterOptions>({ ...DEFAULT_FILTER_OPTIONS })

  // ============================================================
  // 辅助函数
  // ============================================================

  function buildNotebookCondition(): string {
    return filterOptions.notebookId ? `AND b.box = ${quoteSql(filterOptions.notebookId)}` : ""
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
  // 统一查询执行器
  // ============================================================

  /** 查询世代 token：新查询自增，使在途旧查询结果失效，避免竞态覆盖 */
  let queryToken = 0
  // 组件卸载后使在途查询失效，避免写入已废弃的响应式状态
  onScopeDispose(() => { queryToken++ })

  async function runDocQuery(config: DocQueryConfig) {
    const token = ++queryToken
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

      // 已有更新的查询发起，丢弃过期结果
      if (token !== queryToken) return

      if (!rows || rows.length === 0) { setResults([]); queryState.status = "empty"; return }

      const docs = mapRowsToDocs(rows)
      const sorted = sortDocs(docs, filterOptions.sortField, filterOptions.sortOrder)
      await enrichWithPublishedPlatforms(sorted)
      if (token !== queryToken) return
      setResults(sorted)
      queryState.status = "success"
    } catch (error) {
      if (token !== queryToken) return
      console.error("查询文档列表失败:", error)
      queryState.errorMessage = (error as Error).message || "查询失败"
      queryState.status = "error"
      setResults([])
    }
  }

  // ============================================================
  // 统计逻辑（独立 composable，保持状态与接口由 useDocStats 提供）
  // ============================================================

  const stats = useDocStats(plugin, storage, {
    filterOptions,
    queryState,
    buildNotebookCondition,
    runDocQuery,
    setEmptyState,
    resetQueryState,
  })
  const { statsFilter } = stats

  // ============================================================
  // 笔记本与查询配置
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

  async function queryDocs() {
    const needWcFilter = filterOptions.wordCountMin > 0 || filterOptions.wordCountMax > 0
    let conds = ""
    if (filterOptions.titleKeyword.trim()) conds += `AND b.content LIKE '%${escapeSql(filterOptions.titleKeyword.trim())}%' `
    if (filterOptions.contentKeyword.trim()) conds += `AND b.id IN (SELECT DISTINCT root_id FROM blocks WHERE content LIKE '%${escapeSql(filterOptions.contentKeyword.trim())}%' AND type != 'd') `
    if (filterOptions.bookmarkName.trim()) conds += `AND b.id IN (SELECT block_id FROM attributes WHERE name='bookmark' AND value='${escapeSql(filterOptions.bookmarkName.trim())}') `
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

  // ============================================================
  // 平台操作
  // ============================================================

  async function loadPlatformMeta(): Promise<PlatformMeta[]> {
    try {
      const saved = await storage.platformMeta.loadOrDefault()
      if (Array.isArray(saved) && saved.length > 0) PLATFORM_META.value = saved
    } catch { PLATFORM_META.value = [...DEFAULT_PLATFORM_META] }
    return PLATFORM_META.value
  }

  async function savePlatformMeta(meta: PlatformMeta[]): Promise<boolean> {
    PLATFORM_META.value = meta
    return storage.platformMeta.save(meta)
  }

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
    const targetIds = new Set(platformEntry ? [platformEntry.id] : [platformMatcher])
    const nc = buildNotebookCondition()

    // 与分析阶段(analyzePlatformPublish)使用完全相同的 JS 判定逻辑，消除 SQL LIKE 与 JS 的语义差异
    const yamlRows = await sql(`
      SELECT block_id, name FROM attributes
      WHERE name LIKE '%yaml%'
      AND block_id IN (
        SELECT b.id FROM blocks b
        LEFT JOIN (${SIZE_WORDCOUNT_SUBQUERY}) sw ON b.id = sw.root_id
        WHERE b.type = 'd' AND COALESCE(sw.total_size, 0) > 0 ${nc}
      )
      LIMIT 50000
    `)

    // 逐文档聚合已发布平台（与 analyzePlatformPublish 同逻辑）
    const docPlatforms = new Map<string, Set<string>>()
    if (yamlRows) {
      for (const row of yamlRows) {
        const id = String(row.block_id)
        const pid = getPlatformIdFromAttrKey(String(row.name), PLATFORM_META.value)
        if (!pid) continue
        if (!docPlatforms.has(id)) docPlatforms.set(id, new Set())
        docPlatforms.get(id)!.add(pid)
      }
    }

    // 筛选：已发布到至少一个平台、但未发布到目标平台的文档
    const matchingIds: string[] = []
    for (const [id, platforms] of docPlatforms) {
      if (platforms.size > 0 && ![...targetIds].some((t) => platforms.has(t))) {
        matchingIds.push(id)
      }
    }

    if (matchingIds.length === 0) { setEmptyState(); return }
    await runDocQuery({ extraWhere: buildIdInClause(new Set(matchingIds)) })
  }

  return {
    notebooks, queryState, filterOptions,
    healthSettings, loadHealthSettings,
    ...stats,
    loadNotebooks, loadSavedOptions, queryDocs,
    openDoc, updateSort, clearResults, resetQueryState,
    loadPlatformMeta, savePlatformMeta, queryByMissingPlatform,
  }
}
