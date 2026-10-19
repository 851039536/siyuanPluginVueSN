// 资源管理业务逻辑 composable：资源加载与缓存、分类筛选、移动/删除/重建索引
import type { Plugin } from "siyuan"
import type { Ref } from "vue"
import type { ResourceManagerI18n } from "../types"
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
  removeUnusedAsset,
  removeUnusedAssets,
  sql,
} from "@/api"
import { copyToClipboard } from "@/utils/domUtils"
import {
  buildAssetList,
  categoryDirPrefix,
  fillTemplate,
  scanAssetDir,
} from "../utils"
import { useAssetActions } from "./useAssetActions"
import { useAssetLocator } from "./useAssetLocator"
import { useAssetMover } from "./useAssetMover"
import { useCategoryManager } from "./useCategoryManager"
import { useImageCompress } from "./useImageCompress"

/** 轻提示展示时长（毫秒） */
const MESSAGE_TIMEOUT_MS = 3000
/** 加载数量输入非法时的默认值 */
const DEFAULT_LOAD_LIMIT = 30
/** assets 表资源路径查询行数上限（超出部分不进入列表） */
const MAX_ASSET_QUERY_ROWS = 102400

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
  } = useCategoryManager({
    plugin,
    i18n,
    getAssetPaths: () => allAssetPaths.value,
  })

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

  function showMsg(msg: string) {
    try {
      showMessage(msg, MESSAGE_TIMEOUT_MS, "info")
    }
    catch { /* ignore */ }
  }

  async function copyPathToClipboard(path: string) {
    const ok = await copyToClipboard(path)
    showMsg(ok ? fillTemplate(i18n.pathCopied) : fillTemplate(i18n.copyFailed))
  }

  // 资源定位逻辑（含索引滞后兜底）抽离到独立 composable，复用本文件的 showMsg
  const {
    handleLocateAsset,
  } = useAssetLocator({
    i18n,
    showMsg,
  })

  // 行内快捷操作（复制 MD 引用 / 文件管理器打开）抽离到独立 composable
  const {
    copyMarkdownRef,
    openAssetInExplorer,
  } = useAssetActions({
    i18n,
    showMsg,
  })

  // ── 资源移动（移动表单状态 + 磁盘重命名 + 全库引用更新）──

  const {
    movingAsset,
    moveNewPath,
    customCategory,
    startMoveAsset,
    cancelMove,
    applyCategory,
    applyCustomCategory,
    handleMoveAsset,
  } = useAssetMover({
    i18n,
    showMsg,
    isMounted,
    allAssetPaths,
    missingAssets,
    unusedAssets,
    addCustomCategory,
  })

  // ── 图片压缩（自 imageCompressor 功能块迁入「图片资源」页签）──

  // 压缩目标为「当前页签已加载的图片资源」，故依赖 imageAssets 计算属性（而非全量路径）
  const {
    selectedPaths: selectedCompressPaths,
    selectedCount: selectedCompressCount,
    compressing,
    replacing,
    compressDialogOpen,
    compressProgressText,
    hasResult: hasCompressResult,
    stats: compressStats,
    srcVersions: compressSrcVersions,
    toggleSelect: toggleCompressSelect,
    selectAll: selectAllForCompress,
    deselectAll: deselectAllForCompress,
    runCompress,
    replaceOriginals,
    clearResults: clearCompressResults,
  } = useImageCompress({
    imagePaths: imageAssets,
    i18n,
    showMsg,
  })

  /**
   * 全选当前**可见**图片（已按分类筛选并受加载数量截断）。
   * 不能直接用全量 `imageAssets`：那会选中屏幕上不存在的项并连带覆盖写回。
   */
  function selectAllVisibleForCompress() {
    selectAllForCompress(currentAssetList.value)
  }

  /** 打开压缩参数弹窗（未选中时直接提示，不弹空弹窗） */
  function openCompressDialog() {
    if (selectedCompressCount.value === 0) {
      showMsg(fillTemplate(i18n.selectHint))
      return
    }
    compressDialogOpen.value = true
  }

  /** 写回原图（覆盖前二次确认，操作不可撤销）；选中态由 useImageCompress 内部释放 */
  async function handleReplaceOriginals() {
    if (!window.confirm(fillTemplate(i18n.replaceConfirmMessage))) return
    await replaceOriginals()
  }

  // ── Data Loading ──

  /** 全量资源加载的进行中 Promise：同代际重复请求复用同一次扫描，避免请求风暴 */
  let assetLoadPromise: Promise<void> | null = null

  async function loadAssets() {
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

        if (!isMounted.value) return
        allAssetPaths.value = [...new Set([...refPaths, ...fsPaths])].sort()
      }
      catch (e: unknown) {
        console.error("加载资源列表失败:", e)
        showMsg(fillTemplate(i18n.loadFailed))
      }
      finally {
        assetLoadPromise = null
      }
    })()
    return assetLoadPromise
  }

  /**
   * 加载一类资源列表（丢失/未使用）：isMounted 与代际 token 双校验后写入目标 ref，
   * 失败时统一提示并留痕。
   */
  async function loadAssetList(
    token: number,
    fetcher: () => Promise<string[]>,
    target: Ref<string[]>,
    logLabel: string,
  ) {
    try {
      const result = await fetcher()
      if (isMounted.value && token === requestToken) target.value = result || []
    }
    catch (e: unknown) {
      console.error(logLabel, e)
      showMsg(fillTemplate(i18n.loadFailed))
    }
  }

  async function refresh() {
    const token = ++requestToken
    loading.value = true
    try {
      if (activeTab.value === "imageAssets" || activeTab.value === "fileAssets") {
        await loadAssets()
      }
      else if (activeTab.value === "missingAssets") {
        await loadAssetList(token, getMissingAssets, missingAssets, "加载丢失资源失败:")
      }
      else if (activeTab.value === "unusedAssets") {
        await loadAssetList(token, getUnusedAssets, unusedAssets, "加载未使用资源失败:")
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
    if (!window.confirm(`${fillTemplate(i18n.deleteConfirm)} ${path}?`)) return
    try {
      await removeUnusedAsset(path)
      if (!isMounted.value) return
      showMsg(fillTemplate(i18n.deleteSuccess))
      forgetAssetPaths([path])
      await loadAssetList(requestToken, getUnusedAssets, unusedAssets, "加载未使用资源失败:")
    }
    catch {
      if (isMounted.value) showMsg(fillTemplate(i18n.deleteFailed))
    }
  }

  async function handleDeleteAllUnused() {
    if (!window.confirm(`${fillTemplate(i18n.deleteConfirm)} (${unusedAssets.value.length})?`)) return
    const pending = [...unusedAssets.value]
    try {
      await removeUnusedAssets()
      if (!isMounted.value) return
      showMsg(fillTemplate(i18n.deleteSuccess))
      forgetAssetPaths(pending)
      await loadAssetList(requestToken, getUnusedAssets, unusedAssets, "加载未使用资源失败:")
    }
    catch {
      if (isMounted.value) showMsg(fillTemplate(i18n.deleteFailed))
    }
  }

  // ── Category ──

  /** 删除空分类（内置=隐藏）：先预检空分类拦截不可删，再确认后执行；筛选正指向该分类时复位 */
  async function handleDeleteCategory(key: string, label: string) {
    const empty = await isCategoryEmpty(key)
    if (!isMounted.value) return
    if (!empty) {
      showMsg(fillTemplate(i18n.categoryNotEmpty))
      return
    }
    const tip = fillTemplate(i18n.deleteCategoryConfirm, { cat: label })
    if (!window.confirm(tip || fillTemplate(i18n.deleteCategory))) return
    const result = await deleteCategory(key)
    if (!isMounted.value) return
    if (result === "notEmpty") {
      showMsg(fillTemplate(i18n.categoryNotEmpty))
      return
    }
    if (result === "failed") {
      showMsg(fillTemplate(i18n.deleteFailed))
      return
    }
    if (categoryFilter.value === key) categoryFilter.value = ""
    showMsg(fillTemplate(i18n.deleteCategorySuccess))
  }

  /** 恢复被隐藏的内置分类（快捷分类栏重新出现） */
  async function handleRestoreBuiltIn(key: string) {
    await restoreBuiltIn(key)
    if (isMounted.value) showMsg(fillTemplate(i18n.restoreSuccess))
  }

  // ── Rebuild Index ──

  async function handleRebuildIndex() {
    if (rebuildingIndex.value) return
    rebuildingIndex.value = true
    rebuildResult.value = fillTemplate(i18n.rebuildIndexStart)
    try {
      await fullReindexAssetContent()
      if (isMounted.value) {
        rebuildResult.value = fillTemplate(i18n.rebuildIndexSuccess)
        showMsg(fillTemplate(i18n.rebuildIndexSuccess))
      }
    }
    catch (e: unknown) {
      if (isMounted.value) {
        const msg = e instanceof Error ? e.message : String(e)
        rebuildResult.value = `${fillTemplate(i18n.rebuildIndexFailed)}: ${msg}`
        showMsg(fillTemplate(i18n.rebuildIndexFailed))
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
    // 图片压缩（「图片资源」页签）
    selectedCompressPaths,
    selectedCompressCount,
    compressing,
    replacing,
    compressDialogOpen,
    compressProgressText,
    hasCompressResult,
    compressStats,
    compressSrcVersions,
    toggleCompressSelect,
    selectAllVisibleForCompress,
    deselectAllForCompress,
    openCompressDialog,
    runCompress,
    handleReplaceOriginals,
    clearCompressResults,
  }
}
