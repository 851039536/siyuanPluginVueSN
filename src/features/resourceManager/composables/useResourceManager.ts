// 资源管理业务逻辑 composable：资源加载与缓存、分类筛选、移动/删除/重建索引
import type { Plugin } from "siyuan"
import type { ResourceManagerI18n } from "../types"
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
import {
  buildAssetList,
  buildNameFallbackPairs,
  buildVariantPairs,
  categoryDirPrefix,
  escapeRegExp,
  isValidAssetMovePath,
  normalizeCategoryKey,
  queryBlocksByMarkdown,
  resolveDiskPath,
  safeDecodeURI,
  scanAssetDir,
} from "../utils"
import { useAssetActions } from "./useAssetActions"
import { useAssetLocator } from "./useAssetLocator"
import { useCategoryManager } from "./useCategoryManager"

/** 引用更新分批并发大小 */
const UPDATE_BATCH_SIZE = 10
/** 加载数量输入非法时的默认值 */
const DEFAULT_LOAD_LIMIT = 30
/** assets 表资源路径查询行数上限（超出部分不进入列表） */
const MAX_ASSET_QUERY_ROWS = 102400
/** 单次引用查询返回的块数上限 */
const REF_QUERY_LIMIT = 1000

export function useResourceManager(plugin: Plugin, i18n: ResourceManagerI18n) {
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

  const rebuildResult = ref("")

  // 请求代际令牌：快速切换页签时丢弃过期响应
  let requestToken = 0

  // 分类管理（可见性组装/空分类删除/内置隐藏恢复/持久化）；注入全量路径读取用于空分类判定
  const {
    quickCategories,
    hiddenBuiltInCategories,
    isCategoryEmpty,
    deleteCategory,
    restoreBuiltIn,
    addCustomCategory,
  } = useCategoryManager(plugin, i18n, () => allAssetPaths.value)

  const imageAssets = computed(() => buildAssetList(allAssetPaths.value, true))
  const fileAssets = computed(() => buildAssetList(allAssetPaths.value, false))

  // 加载数量兜底：空串/NaN/小于 1 时回退默认值
  const effectiveLimit = computed(() => {
    const n = Number(loadLimit.value)
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_LOAD_LIMIT
  })

  // 单次过滤同时产出总数与截断列表，避免重复遍历
  const filteredAssets = computed(() => {
    const list = activeTab.value === "fileAssets" ? fileAssets.value : imageAssets.value
    let matched: string[]
    if (!categoryFilter.value) {
      // 空筛选 = 待分类视图：排除所有已归入分类目录的资源
      const prefixes = quickCategories.value.map((c) => categoryDirPrefix(c.key))
      matched = list.filter((path) => {
        const lower = path.toLowerCase()
        return !prefixes.some((prefix) => lower.startsWith(prefix))
      })
    }
    else {
      const prefix = categoryDirPrefix(categoryFilter.value)
      matched = list.filter((path) => path.toLowerCase().startsWith(prefix))
    }
    return {
      total: matched.length,
      list: matched.slice(0, effectiveLimit.value),
    }
  })

  const totalAssetCount = computed(() => filteredAssets.value.total)
  const currentAssetList = computed(() => filteredAssets.value.list)

  // ── Helpers ──

  /**
   * i18n 文案取值兜底：Dock 面板在 i18n 缺失时会传入空对象，
   * 直接对 undefined 调用 replace() 会抛错，统一经此取值
   */
  function t(msg: string | undefined): string {
    return msg ?? ""
  }

  function showMsg(msg: string, timeout = 3000) {
    try { showMessage(msg, timeout, "info") }
    catch { /* ignore */ }
  }

  async function copyPathToClipboard(path: string) {
    const ok = await copyToClipboard(path)
    showMsg(ok ? i18n.pathCopied : i18n.copyFailed)
  }

  // 资源定位逻辑（含索引滞后兜底）抽离到独立 composable，复用本文件的 showMsg
  const { handleLocateAsset } = useAssetLocator(i18n, showMsg)

  // 行内快捷操作（复制 MD 引用 / 文件管理器打开）抽离到独立 composable
  const { copyMarkdownRef, openAssetInExplorer } = useAssetActions(i18n, showMsg)

  // ── Data Loading ──

  /** 全量资源加载的进行中 Promise：同代际重复请求复用同一次扫描，避免请求风暴 */
  let assetLoadPromise: Promise<void> | null = null

  async function loadAssets(token: number) {
    if (assetLoadPromise) return assetLoadPromise
    assetLoadPromise = (async () => {
      try {
        // 两个数据源相互独立，并行请求；磁盘扫描已覆盖未使用资源（其本质是磁盘上无引用的文件）
        const [referenced, fsPaths] = await Promise.all([
          sql(`SELECT DISTINCT path FROM assets WHERE path LIKE 'assets/%' LIMIT ${MAX_ASSET_QUERY_ROWS}`),
          scanAssetDir("/data/assets"),
        ])
        const refPaths = (referenced || [])
          .map((r: { path: string }) => r.path)
          .filter((p: unknown): p is string => typeof p === "string")

        if (!isMounted.value || token !== requestToken) return
        allAssetPaths.value = [...new Set([...refPaths, ...fsPaths])].sort()
      }
      catch (e: unknown) {
        console.error("加载资源列表失败:", e)
        showMsg(i18n.loadFailed)
      }
      finally {
        assetLoadPromise = null
      }
    })()
    return assetLoadPromise
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

  /** 删除成功后同步剔除已失效路径，避免图片/文件页签残留幽灵条目 */
  function forgetAssetPaths(paths: string[]) {
    const removed = new Set(paths)
    allAssetPaths.value = allAssetPaths.value.filter((p) => !removed.has(p))
    missingAssets.value = missingAssets.value.filter((p) => !removed.has(p))
  }

  async function handleDeleteUnused(path: string) {
    if (!window.confirm(`${i18n.deleteConfirm} ${path}?`)) return
    try {
      await removeUnusedAsset(path)
      if (!isMounted.value) return
      showMsg(i18n.deleteSuccess)
      forgetAssetPaths([path])
      await loadUnusedAssets(requestToken)
    }
    catch {
      if (isMounted.value) showMsg(i18n.deleteFailed)
    }
  }

  async function handleDeleteAllUnused() {
    if (!window.confirm(`${i18n.deleteConfirm} (${unusedAssets.value.length})?`)) return
    const pending = [...unusedAssets.value]
    try {
      await removeUnusedAssets()
      if (!isMounted.value) return
      showMsg(i18n.deleteSuccess)
      forgetAssetPaths(pending)
      await loadUnusedAssets(requestToken)
    }
    catch {
      if (isMounted.value) showMsg(i18n.deleteFailed)
    }
  }

  // ── Category ──

  /** 删除空分类（内置=隐藏）：先预检空分类拦截不可删，再确认后执行；筛选正指向该分类时复位 */
  async function handleDeleteCategory(key: string, label: string) {
    const empty = await isCategoryEmpty(key)
    if (!isMounted.value) return
    if (!empty) {
      showMsg(i18n.categoryNotEmpty)
      return
    }
    const tip = t(i18n.deleteCategoryConfirm).replace("{cat}", label)
    if (!window.confirm(tip || t(i18n.deleteCategory))) return
    const result = await deleteCategory(key)
    if (!isMounted.value) return
    if (result === "notEmpty") {
      showMsg(i18n.categoryNotEmpty)
      return
    }
    if (result === "failed") {
      showMsg(i18n.deleteFailed)
      return
    }
    if (categoryFilter.value === key) categoryFilter.value = ""
    showMsg(i18n.deleteCategorySuccess)
  }

  /** 恢复被隐藏的内置分类（快捷分类栏重新出现） */
  async function handleRestoreBuiltIn(key: string) {
    await restoreBuiltIn(key)
    if (isMounted.value) showMsg(i18n.restoreSuccess)
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

  async function applyCategory(currentPath: string, category: string): Promise<boolean> {
    const fileName = currentPath.split("/").pop() || currentPath
    // 分类名统一小写，保证磁盘目录名与筛选前缀（同样小写化）一致
    moveNewPath.value = `assets/${normalizeCategoryKey(category)}/${fileName}`
    // 点击分类即直接执行移动，避免"填入路径后未点确认"的静默无操作陷阱
    return await handleMoveAsset(currentPath)
  }

  async function applyCustomCategory(currentPath: string) {
    const cat = normalizeCategoryKey(customCategory.value)
    if (!cat) return
    const moved = await applyCategory(currentPath, cat)

    // 仅移动成功时才记录自定义分类，避免移动失败仍新增分类
    if (moved) await addCustomCategory(cat)
    customCategory.value = ""
  }

  function updateAssetPathAfterMove(oldPath: string, newPath: string) {
    allAssetPaths.value = allAssetPaths.value
      .map((p) => (p === oldPath ? newPath : p))
      .sort()
    // 丢失/未使用列表中的旧路径同步失效
    missingAssets.value = missingAssets.value.map((p) => (p === oldPath ? newPath : p))
    unusedAssets.value = unusedAssets.value.filter((p) => p !== oldPath)
  }

  /**
   * 更新全库中对资源的引用，两级匹配：
   * 1. 全路径（原文/仅空格编码/全量编码三形态）精确替换
   * 2. 文件名兜底——引用可能指向历史旧目录（此前移动时引用未同步），
   *    按文件名查块并用正则将 assets/任意目录/文件名 整体替换为新路径，实现引用自愈
   * @returns 成功更新的块数量
   */
  async function updateAssetReferences(oldPath: string, newPath: string): Promise<number> {
    const oldBase = safeDecodeURI(oldPath)
    const newBase = safeDecodeURI(newPath)
    const variants = buildVariantPairs(oldBase, newBase)

    // 各形态分别查询，按块 id 去重
    const blockMap = new Map<string, string>()
    for (const variant of variants) {
      const rows = await queryBlocksByMarkdown(variant.from, REF_QUERY_LIMIT)
      if (!rows) {
        // sql 静默失败返回 null：文件已移动但引用未更新，明确提示用户
        showMsg(i18n.refUpdateFailed)
        return 0
      }
      for (const row of rows) {
        if (!blockMap.has(row.id)) blockMap.set(row.id, row.markdown)
      }
    }

    // 文件名兜底：按【旧路径】文件名（含编码形态）补查引用了旧目录路径的块；
    // 每个 pair 的 to 为同编码形态的新完整路径，替换时保持形态一致
    const baseName = oldBase.split("/").pop() ?? ""
    const namePairs = baseName ? buildNameFallbackPairs(baseName, newBase) : []
    for (const pair of namePairs) {
      const rows = await queryBlocksByMarkdown(`/${pair.from}`, REF_QUERY_LIMIT)
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
          const res = await updateBlock("markdown", u.next, u.id)
          // 内核失败时可能返回空数组而非 null，须按"有操作结果"判定成功
          return Array.isArray(res) && res.length > 0
        }
        catch {
          return false
        }
      }))
      updatedCount += results.filter(Boolean).length
    }
    return updatedCount
  }

  async function handleMoveAsset(oldPath: string): Promise<boolean> {
    const newPath = moveNewPath.value.trim()
    if (!newPath) {
      cancelMove()
      return false
    }
    if (newPath === oldPath) {
      // 路径未变化时明确提示，避免静默关闭被误认为移动成功
      showMsg(i18n.samePathHint)
      return false
    }
    if (!isValidAssetMovePath(newPath)) {
      showMsg(i18n.invalidPath)
      return false
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

      // 面板已卸载时不再触碰编辑器与剪贴板（避免对已销毁的 Dock 做无意义副作用）
      if (!isMounted.value) return true

      // 引用已写入内核，但打开中的编辑器仍渲染旧路径缓存，需主动重载
      if (updatedCount > 0) {
        for (const editor of getAllEditor()) editor.reload(false)
      }

      // 移动成功后自动复制新路径，便于直接粘贴引用
      const copied = await copyToClipboard(newPath)

      const refMsg = updatedCount > 0 ? `（${t(i18n.updatedRefs).replace("{count}", String(updatedCount))}）` : ""
      const copyMsg = copied ? `（${t(i18n.pathCopied)}）` : ""
      showMsg(`${t(i18n.moveSuccess)}${refMsg}（${t(i18n.newPath)}: ${newPath}）${copyMsg}`)
      updateAssetPathAfterMove(oldPath, newPath)
      cancelMove()
      return true
    }
    catch (e: unknown) {
      if (isMounted.value) {
        const msg = e instanceof Error ? e.message : String(e)
        showMsg(`${t(i18n.moveFailed)}: ${msg}`)
      }
      return false
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

  onMounted(() => {
    isMounted.value = true
  })

  onUnmounted(() => {
    isMounted.value = false
  })

  watch(activeTab, (tab, prevTab) => {
    categoryFilter.value = ""
    // 图片/文件页签共享同一份资源缓存，互切时无需重新加载
    const assetTabs = ["imageAssets", "fileAssets"]
    if (
      prevTab !== undefined
      && assetTabs.includes(tab) && assetTabs.includes(prevTab)
      && allAssetPaths.value.length > 0
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
    missingAssets,
    unusedAssets,
    categoryFilter,
    loadLimit,
    movingAsset,
    moveNewPath,
    customCategory,
    rebuildResult,
    quickCategories,
    hiddenBuiltInCategories,
    totalAssetCount,
    currentAssetList,
    refresh,
    copyPathToClipboard,
    copyMarkdownRef,
    openAssetInExplorer,
    handleLocateAsset,
    handleDeleteUnused,
    handleDeleteAllUnused,
    handleDeleteCategory,
    handleRestoreBuiltIn,
    startMoveAsset,
    cancelMove,
    applyCategory,
    applyCustomCategory,
    handleMoveAsset,
    handleRebuildIndex,
  }
}
