// 资源管理业务逻辑 composable：资源加载与缓存、分类筛选、移动/删除/重建索引
import type { Plugin } from "siyuan"
import type {
  ImageAssetInfo,
  ResourceManagerI18n,
} from "../types"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from "vue"
import {
  fullReindexAssetContent,
  getMissingAssets,
  getUnusedAssets,
  putFile,
  removeUnusedAsset,
  removeUnusedAssets,
  renameFile,
  sql,
  updateBlock,
} from "@/api"
import { copyToClipboard } from "@/utils/domUtils"
import { PluginStorage } from "@/utils/pluginStorage"
import {
  BUILT_IN_CATEGORY_KEYS,
  buildAssetList,
  escapeSqlLike,
  escapeSqlString,
  isValidAssetMovePath,
  scanAssetDir,
  STORAGE_KEY,
} from "../utils"

/** 引用更新分批并发大小 */
const UPDATE_BATCH_SIZE = 10
/** 加载数量输入非法时的默认值 */
const DEFAULT_LOAD_LIMIT = 30

// 存储实例模块级单例，避免组件重建时重复实例化
let sharedStorage: PluginStorage | null = null

function getStorage(plugin: Plugin): PluginStorage {
  if (!sharedStorage) sharedStorage = new PluginStorage(plugin)
  return sharedStorage
}

export function useResourceManager(plugin: Plugin, i18n: ResourceManagerI18n) {
  const storage = getStorage(plugin)
  const isMounted = ref(false)
  const activeTab = ref("imageAssets")
  const loading = ref(false)
  const rebuildingIndex = ref(false)
  // 图片/文件页签共享的全量资源路径缓存（大数组无需深层响应式）
  const allAssetPaths = shallowRef<string[]>([])
  const missingAssets = ref<string[]>([])
  const unusedAssets = ref<string[]>([])

  const categoryFilter = ref("")
  const loadLimit = ref<number | string>(DEFAULT_LOAD_LIMIT)

  const movingAsset = ref<string | null>(null)
  const moveNewPath = ref("")
  const customCategory = ref("")
  const customCategories = ref<string[]>([])

  const rebuildResult = ref("")

  // 请求代际令牌：快速切换页签时丢弃过期响应
  let requestToken = 0

  const imageAssets = computed(() => buildAssetList(allAssetPaths.value, true))
  const fileAssets = computed(() => buildAssetList(allAssetPaths.value, false))

  const quickCategories = computed(() => {
    const builtIn = [
      { key: "images", label: i18n.categoryImages },
      { key: "net", label: i18n.categoryNet },
      { key: "tool", label: i18n.categoryTool },
      { key: "other", label: i18n.categoryOther },
    ]
    const custom = customCategories.value.map((cat) => ({
      key: cat,
      label: cat,
    }))
    return [...builtIn, ...custom]
  })

  // 加载数量兜底：空串/NaN/小于 1 时回退默认值
  const effectiveLimit = computed(() => {
    const n = Number(loadLimit.value)
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_LOAD_LIMIT
  })

  // 单次过滤同时产出总数与截断列表，避免重复遍历
  const filteredAssets = computed(() => {
    const list = activeTab.value === "fileAssets" ? fileAssets.value : imageAssets.value
    let matched: ImageAssetInfo[]
    if (!categoryFilter.value) {
      // 空筛选 = 待分类视图：排除所有已归入分类目录的资源
      const prefixes = quickCategories.value.map((c) => `assets/${c.key.toLowerCase()}/`)
      matched = list.filter((item) => {
        const lower = item.path.toLowerCase()
        return !prefixes.some((prefix) => lower.startsWith(prefix))
      })
    }
    else {
      const prefix = `assets/${categoryFilter.value.toLowerCase()}/`
      matched = list.filter((item) => item.path.toLowerCase().startsWith(prefix))
    }
    return {
      total: matched.length,
      list: matched.slice(0, effectiveLimit.value),
    }
  })

  const totalAssetCount = computed(() => filteredAssets.value.total)
  const currentAssetList = computed(() => filteredAssets.value.list)

  // ── Helpers ──

  function showMsg(msg: string, timeout = 3000) {
    try { showMessage(msg, timeout, "info") }
    catch { /* ignore */ }
  }

  async function copyPathToClipboard(path: string) {
    const ok = await copyToClipboard(path)
    showMsg(ok ? i18n.pathCopied : i18n.copyFailed)
  }

  /**
   * 定位资源引用：查 assets 表按 path 等值匹配（原始 + URL 编码双形态），
   * 无命中时兜底查 blocks 表 markdown LIKE，命中后以 siyuan:// 协议跳转
   */
  async function handleLocateAsset(path: string) {
    const variants = [path]
    const encoded = encodeURI(path)
    if (encoded !== path) variants.push(encoded)

    // assets 表等值查询，按引用块 id 去重
    const refIds = new Set<string>()
    for (const variant of variants) {
      const rows = await sql(
        `SELECT block_id, root_id FROM assets WHERE path = '${escapeSqlString(variant)}' LIMIT 32`,
      ) as { block_id: string, root_id: string }[] | null
      if (!rows) {
        // sql 静默失败返回 null：明确提示定位失败
        showMsg(i18n.locateFailed)
        return
      }
      for (const row of rows) {
        const id = row.block_id || row.root_id
        if (id) refIds.add(id)
      }
    }

    // 兜底：索引缺失时查 blocks 表 markdown 模糊匹配
    if (refIds.size === 0) {
      for (const variant of variants) {
        const rows = await sql(
          `SELECT DISTINCT id, root_id FROM blocks WHERE markdown LIKE '%${escapeSqlLike(variant)}%' ESCAPE '\\' ORDER BY updated DESC LIMIT 5`,
        ) as { id: string, root_id: string }[] | null
        for (const row of rows || []) {
          const id = row.id || row.root_id
          if (id) refIds.add(id)
        }
      }
    }

    if (refIds.size === 0) {
      showMsg(i18n.locateNotFound)
      return
    }
    if (refIds.size > 1) showMsg(i18n.locateRefs.replace("{count}", String(refIds.size)))
    window.open(`siyuan://blocks/${[...refIds][0]}`)
  }

  // ── Data Loading ──

  async function loadAssets(token: number) {
    try {
      // 三个数据源相互独立，并行请求
      const [referenced, unused, fsPaths] = await Promise.all([
        sql("SELECT DISTINCT path FROM assets WHERE path LIKE 'assets/%' LIMIT 102400"),
        getUnusedAssets(),
        scanAssetDir("/data/assets"),
      ])
      const refPaths = (referenced || [])
        .map((r: { path: string }) => r.path)
        .filter((p: unknown): p is string => typeof p === "string")
      const unusedPaths = (unused || [])
        .filter((p: unknown): p is string => typeof p === "string")

      if (!isMounted.value || token !== requestToken) return
      allAssetPaths.value = [...new Set([...refPaths, ...unusedPaths, ...fsPaths])].sort()
    }
    catch (e: unknown) {
      console.error("加载资源列表失败:", e)
      showMsg(i18n.loadFailed)
    }
  }

  async function loadMissingAssets(token: number) {
    try {
      const result = await getMissingAssets()
      if (isMounted.value && token === requestToken) missingAssets.value = result || []
    }
    catch (e: unknown) {
      console.error("加载丢失资源失败:", e)
      showMsg(i18n.loadFailed)
    }
  }

  async function loadUnusedAssets(token: number) {
    try {
      const result = await getUnusedAssets()
      if (isMounted.value && token === requestToken) unusedAssets.value = result || []
    }
    catch (e: unknown) {
      console.error("加载未使用资源失败:", e)
      showMsg(i18n.loadFailed)
    }
  }

  async function refresh() {
    const token = ++requestToken
    loading.value = true
    try {
      if (activeTab.value === "imageAssets" || activeTab.value === "fileAssets") {
        await loadAssets(token)
      }
      else if (activeTab.value === "missingAssets") {
        await loadMissingAssets(token)
      }
      else if (activeTab.value === "unusedAssets") {
        await loadUnusedAssets(token)
      }
    }
    finally {
      if (isMounted.value && token === requestToken) loading.value = false
    }
  }

  // ── Delete ──

  async function handleDeleteUnused(path: string) {
    if (!confirm(`${i18n.deleteConfirm} ${path}?`)) return
    try {
      await removeUnusedAsset(path)
      if (!isMounted.value) return
      showMsg(i18n.deleteSuccess)
      await loadUnusedAssets(requestToken)
    }
    catch {
      if (isMounted.value) showMsg(i18n.deleteFailed)
    }
  }

  async function handleDeleteAllUnused() {
    if (!confirm(`${i18n.deleteConfirm} (${unusedAssets.value.length})?`)) return
    try {
      await removeUnusedAssets()
      if (!isMounted.value) return
      showMsg(i18n.deleteSuccess)
      await loadUnusedAssets(requestToken)
    }
    catch {
      if (isMounted.value) showMsg(i18n.deleteFailed)
    }
  }

  // ── Move ──

  function startMoveAsset(path: string) {
    movingAsset.value = path
    moveNewPath.value = path
  }

  function cancelMove() {
    movingAsset.value = null
    moveNewPath.value = ""
    customCategory.value = ""
  }

  function applyCategory(currentPath: string, category: string) {
    const fileName = currentPath.split("/").pop() || currentPath
    moveNewPath.value = `assets/${category}/${fileName}`
  }

  async function applyCustomCategory(currentPath: string) {
    const cat = customCategory.value.trim()
    if (!cat) return
    applyCategory(currentPath, cat)

    if (!BUILT_IN_CATEGORY_KEYS.has(cat) && !customCategories.value.includes(cat)) {
      customCategories.value = [...customCategories.value, cat]
      await storage.save(STORAGE_KEY, customCategories.value)
    }
    customCategory.value = ""
  }

  function updateAssetPathAfterMove(oldPath: string, newPath: string) {
    allAssetPaths.value = allAssetPaths.value
      .map((p) => (p === oldPath ? newPath : p))
      .sort()
  }

  /**
   * 更新全库中对资源的引用，同时匹配原始与 URL 编码两种形态
   * （含空格/中文文件名的链接在 markdown 中以编码形式存储）
   * @returns 成功更新的块数量
   */
  async function updateAssetReferences(oldPath: string, newPath: string): Promise<number> {
    const variants = [{ from: oldPath, to: newPath }]
    const encodedOld = encodeURI(oldPath)
    if (encodedOld !== oldPath) variants.push({ from: encodedOld, to: encodeURI(newPath) })

    // 两种形态各查一次，按块 id 去重
    const blockMap = new Map<string, string>()
    for (const variant of variants) {
      const rows = await sql(
        `SELECT id, markdown FROM blocks WHERE markdown LIKE '%${escapeSqlLike(variant.from)}%' ESCAPE '\\' LIMIT 1000`,
      ) as { id: string, markdown: string }[] | null
      if (!rows) {
        // sql 静默失败返回 null：文件已移动但引用未更新，明确提示用户
        showMsg(i18n.refUpdateFailed)
        return 0
      }
      for (const row of rows) {
        if (!blockMap.has(row.id)) blockMap.set(row.id, row.markdown)
      }
    }

    const updates = [...blockMap.entries()]
      .map(([id, markdown]) => {
        let next = markdown
        for (const variant of variants) next = next.split(variant.from).join(variant.to)
        return { id, next, changed: next !== markdown }
      })
      .filter((u) => u.changed)

    // 分批并行更新，避免串行等待与瞬时请求风暴
    let updatedCount = 0
    for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
      const batch = updates.slice(i, i + UPDATE_BATCH_SIZE)
      const results = await Promise.all(batch.map(async (u) => {
        try {
          return (await updateBlock("markdown", u.next, u.id)) !== null
        }
        catch {
          return false
        }
      }))
      updatedCount += results.filter(Boolean).length
    }
    return updatedCount
  }

  async function handleMoveAsset(oldPath: string) {
    const newPath = moveNewPath.value.trim()
    if (!newPath || newPath === oldPath) {
      cancelMove()
      return
    }
    if (!isValidAssetMovePath(newPath)) {
      showMsg(i18n.invalidPath)
      return
    }
    try {
      const dirPart = newPath.substring(0, newPath.lastIndexOf("/"))
      if (dirPart && dirPart !== "assets") {
        try { await putFile(`/data/${dirPart}`, true, new File([], "")) }
        catch { /* 目录可能已存在 */ }
      }

      await renameFile(`/data/${oldPath}`, `/data/${newPath}`)
      const updatedCount = await updateAssetReferences(oldPath, newPath)

      try { await fullReindexAssetContent() }
      catch { /* 索引重建失败不影响移动结果 */ }

      if (!isMounted.value) return
      const refMsg = updatedCount > 0 ? `（${i18n.updatedRefs.replace("{count}", String(updatedCount))}）` : ""
      showMsg(`${i18n.moveSuccess}${refMsg}（${i18n.newPath}: ${newPath}）`)
      updateAssetPathAfterMove(oldPath, newPath)
      cancelMove()
    }
    catch (e: unknown) {
      if (isMounted.value) {
        const msg = e instanceof Error ? e.message : String(e)
        showMsg(`${i18n.moveFailed}: ${msg}`)
      }
    }
  }

  // ── Rebuild Index ──

  async function handleRebuildIndex() {
    if (rebuildingIndex.value) return
    rebuildingIndex.value = true
    rebuildResult.value = i18n.rebuildIndexStart
    try {
      await fullReindexAssetContent()
      if (isMounted.value) {
        rebuildResult.value = i18n.rebuildIndexSuccess
        showMsg(i18n.rebuildIndexSuccess)
      }
    }
    catch (e: unknown) {
      if (isMounted.value) {
        const msg = e instanceof Error ? e.message : String(e)
        rebuildResult.value = `${i18n.rebuildIndexFailed}: ${msg}`
        showMsg(i18n.rebuildIndexFailed)
      }
    }
    finally {
      if (isMounted.value) rebuildingIndex.value = false
    }
  }

  // ── Lifecycle ──

  onMounted(async () => {
    isMounted.value = true
    try {
      const saved = await storage.load<string[]>(STORAGE_KEY)
      if (saved) customCategories.value = saved
    }
    catch { /* ignore */ }
  })

  onUnmounted(() => {
    isMounted.value = false
  })

  watch(activeTab, (tab, prevTab) => {
    categoryFilter.value = ""
    // 图片/文件页签共享同一份资源缓存，互切时无需重新加载
    const assetTabs = ["imageAssets", "fileAssets"]
    if (
      assetTabs.includes(tab) && prevTab !== undefined
      && assetTabs.includes(prevTab) && allAssetPaths.value.length > 0
    ) {
      return
    }
    refresh()
  }, { immediate: true })

  // ── Public API ──

  return {
    activeTab,
    loading,
    rebuildingIndex,
    imageAssets,
    fileAssets,
    missingAssets,
    unusedAssets,
    categoryFilter,
    loadLimit,
    movingAsset,
    moveNewPath,
    customCategory,
    customCategories,
    rebuildResult,
    quickCategories,
    totalAssetCount,
    currentAssetList,
    refresh,
    copyPathToClipboard,
    handleLocateAsset,
    handleDeleteUnused,
    handleDeleteAllUnused,
    startMoveAsset,
    cancelMove,
    applyCategory,
    applyCustomCategory,
    handleMoveAsset,
    handleRebuildIndex,
  }
}
