// 资源管理业务逻辑 composable：资源加载与缓存、分类筛选、移动/删除/重建索引
import type { Plugin } from "siyuan"
import type {
  ImageAssetInfo,
  ResourceManagerI18n,
} from "../types"
import { getAllEditor, showMessage } from "siyuan"
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
  assetFileExists,
  BUILT_IN_CATEGORY_KEYS,
  buildAssetList,
  buildVariantPairs,
  escapeRegExp,
  escapeSqlLike,
  isValidAssetMovePath,
  safeDecodeURI,
  scanAssetDir,
  STORAGE_KEY,
} from "../utils"
import { useAssetLocator } from "./useAssetLocator"

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

  // 资源定位逻辑（含索引滞后兜底）抽离到独立 composable
  const { handleLocateAsset } = useAssetLocator(i18n)

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

  async function applyCategory(currentPath: string, category: string) {
    const fileName = currentPath.split("/").pop() || currentPath
    moveNewPath.value = `assets/${category}/${fileName}`
    // 点击分类即直接执行移动，避免"填入路径后未点确认"的静默无操作陷阱
    await handleMoveAsset(currentPath)
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
   * 更新全库中对资源的引用，两级匹配：
   * 1. 全路径（原文/仅空格编码/全量编码三形态）精确替换
   * 2. 文件名兜底——引用可能指向历史旧目录（此前移动时引用未同步），
   *    按文件名查块并用正则将 assets/任意目录/文件名 整体替换为新路径，实现引用自愈
   * @returns 成功更新的块数量
   */
  async function updateAssetReferences(oldPath: string, newPath: string): Promise<number> {
    const newBase = safeDecodeURI(newPath)
    const variants = buildVariantPairs(safeDecodeURI(oldPath), newBase)

    // 各形态分别查询，按块 id 去重
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

    // 文件名兜底：按文件名（含编码形态）补查引用了旧目录路径的块；
    // pair.to 为同编码形态的新完整路径，替换时保持形态一致
    const baseName = newBase.split("/").pop() ?? ""
    const namePairs = baseName ? buildVariantPairs(baseName, newBase) : []
    for (const pair of namePairs) {
      const rows = await sql(
        `SELECT id, markdown FROM blocks WHERE markdown LIKE '%/${escapeSqlLike(pair.from)}%' ESCAPE '\\' LIMIT 1000`,
      ) as { id: string, markdown: string }[] | null
      if (!rows) continue
      for (const row of rows) {
        if (!blockMap.has(row.id)) blockMap.set(row.id, row.markdown)
      }
    }

    const updates = [...blockMap.entries()]
      .map(([id, markdown]) => {
        let next = markdown
        for (const variant of variants) next = next.split(variant.from).join(variant.to)
        // 兜底替换：assets/ 下任意目录 + 该文件名 → 同形态新路径（跳过已是新路径的引用）
        for (const pair of namePairs) {
          const pattern = new RegExp(`assets/(?:[^)\\s"']*/)?${escapeRegExp(pair.from)}`, "g")
          next = next.replace(pattern, (match) => (match === pair.to ? match : pair.to))
        }
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

  /**
   * 解析资源在磁盘上的真实路径：assets 表中的路径可能是 URL 编码形态
   * （如 a%20b.png），而磁盘文件名是解码后的（a b.png），原样不存在时尝试解码形态
   */
  async function resolveDiskPath(path: string): Promise<string | null> {
    if (await assetFileExists(path)) return path
    const decoded = safeDecodeURI(path)
    if (decoded !== path && await assetFileExists(decoded)) return decoded
    return null
  }

  async function handleMoveAsset(oldPath: string) {
    const newPath = moveNewPath.value.trim()
    if (!newPath) {
      cancelMove()
      return
    }
    if (newPath === oldPath) {
      // 路径未变化时明确提示，避免静默关闭被误认为移动成功
      showMsg(i18n.samePathHint)
      return
    }
    if (!isValidAssetMovePath(newPath)) {
      showMsg(i18n.invalidPath)
      return
    }
    try {
      // 磁盘操作使用真实（解码）路径；markdown 引用更新仍按列表中的原形态
      const diskOldPath = await resolveDiskPath(oldPath)
      if (!diskOldPath) throw new Error(i18n.fileNotFound)
      const diskNewPath = safeDecodeURI(newPath)

      const dirPart = diskNewPath.substring(0, diskNewPath.lastIndexOf("/"))
      if (dirPart && dirPart !== "assets") {
        try { await putFile(`/data/${dirPart}`, true, new File([], "")) }
        catch { /* 目录可能已存在 */ }
      }

      await renameFile(`/data/${diskOldPath}`, `/data/${diskNewPath}`)
      const updatedCount = await updateAssetReferences(oldPath, newPath)

      try { await fullReindexAssetContent() }
      catch { /* 索引重建失败不影响移动结果 */ }

      // 引用已写入内核，但打开中的编辑器仍渲染旧路径缓存，需主动重载
      if (updatedCount > 0) {
        for (const editor of getAllEditor()) editor.reload(false)
      }

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
