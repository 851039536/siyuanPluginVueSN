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
  watch,
} from "vue"
import {
  fullReindexAssetContent,
  getMissingAssets,
  getUnusedAssets,
  putFile,
  readDir,
  removeUnusedAsset,
  removeUnusedAssets,
  renameFile,
  sql,
  updateBlock,
} from "@/api"
import { copyToClipboard } from "@/utils/domUtils"
import { PluginStorage } from "@/utils/pluginStorage"

const IMAGE_EXT = /\.(?:png|jpg|jpeg|gif|svg|webp|bmp|ico|tiff|avif)$/i
const BUILT_IN_CATEGORY_KEYS = new Set(["images", "net", "tool", "other"])
const STORAGE_KEY = "resourceManager-customCategories"

export function useResourceManager(plugin: Plugin, i18n: ResourceManagerI18n) {
  const storage = new PluginStorage(plugin)
  const isMounted = ref(false)
  const activeTab = ref("imageAssets")
  const loading = ref(false)
  const rebuildingIndex = ref(false)
  const imageAssets = ref<ImageAssetInfo[]>([])
  const fileAssets = ref<ImageAssetInfo[]>([])
  const missingAssets = ref<string[]>([])
  const unusedAssets = ref<string[]>([])

  const categoryFilter = ref("")
  const loadLimit = ref(30)

  const movingAsset = ref<string | null>(null)
  const moveNewPath = ref("")
  const customCategory = ref("")
  const customCategories = ref<string[]>([])

  const rebuildResult = ref("")

  const quickCategories = computed(() => {
    const builtIn = [
      {
        key: "images",
        label: i18n.categoryImages || "图片",
      },
      {
        key: "net",
        label: i18n.categoryNet || "NET",
      },
      {
        key: "tool",
        label: i18n.categoryTool || "tool",
      },
      {
        key: "other",
        label: i18n.categoryOther || "其他",
      },
    ]
    const custom = customCategories.value.map((cat) => ({
      key: cat,
      label: cat,
    }))
    return [...builtIn, ...custom]
  })

  const totalAssetCount = computed(() => {
    const list = activeTab.value === "fileAssets" ? fileAssets.value : imageAssets.value
    if (!categoryFilter.value) {
      const categoryKeys = quickCategories.value.map((c) => c.key)
      return list.filter((item) => {
        const lower = item.path.toLowerCase()
        return !categoryKeys.some((key) => lower.startsWith(`assets/${key.toLowerCase()}/`))
      }).length
    }
    const prefix = `assets/${categoryFilter.value}/`
    return list.filter((item) => item.path.toLowerCase().startsWith(prefix.toLowerCase())).length
  })

  const currentAssetList = computed(() => {
    const list = activeTab.value === "fileAssets" ? fileAssets.value : imageAssets.value
    if (!categoryFilter.value) {
      const categoryKeys = quickCategories.value.map((c) => c.key)
      return list
        .filter((item) => {
          const lower = item.path.toLowerCase()
          return !categoryKeys.some((key) => lower.startsWith(`assets/${key.toLowerCase()}/`))
        })
        .slice(0, loadLimit.value)
    }
    const prefix = `assets/${categoryFilter.value}/`
    return list
      .filter((item) => item.path.toLowerCase().startsWith(prefix.toLowerCase()))
      .slice(0, loadLimit.value)
  })

  // ── Helpers ──

  function showMsg(msg: string, timeout = 3000) {
    try { showMessage(msg, timeout, "info") }
    catch { /* ignore */ }
  }

  function escapeSqlLike(str: string): string {
    return str.replace(/'/g, "''")
  }

  async function copyPathToClipboard(path: string) {
    const ok = await copyToClipboard(path)
    showMsg(ok ? i18n.pathCopied : i18n.copyFailed || "复制失败")
  }

  // ── Data Loading ──

  function buildAssetList(paths: string[], isImage: boolean): ImageAssetInfo[] {
    const extFilter = isImage
      ? (p: string) => IMAGE_EXT.test(p)
      : (p: string) => !IMAGE_EXT.test(p)
    return paths.filter(extFilter).map((path) => ({ path }))
  }

  async function scanAssetDir(dirPath: string): Promise<string[]> {
    const paths: string[] = []
    try {
      const entries = await readDir(dirPath)
      const files = Array.isArray(entries) ? entries : [entries]
      for (const entry of files) {
        const fullPath = `${dirPath}/${entry.name}`
        if (entry.isDir) {
          const sub = await scanAssetDir(fullPath)
          paths.push(...sub)
        }
        else {
          const relPath = fullPath.replace(/^\/data\//, "")
          paths.push(relPath)
        }
      }
    }
    catch { /* ignore scan errors */ }
    return paths
  }

  async function loadAllAssets(isImage: boolean) {
    const target = isImage ? imageAssets : fileAssets
    try {
      const referenced = await sql("SELECT DISTINCT path FROM assets WHERE path LIKE 'assets/%'")
      const refPaths = (referenced || [])
        .map((r: { path: string }) => r.path)
        .filter((p: unknown): p is string => typeof p === "string")

      const unused = await getUnusedAssets()
      const unusedPaths = (unused || [])
        .filter((p: unknown): p is string => typeof p === "string")

      const fsPaths = await scanAssetDir("/data/assets")

      const allPaths = [...new Set([...refPaths, ...unusedPaths, ...fsPaths])].sort()
      target.value = buildAssetList(allPaths, isImage)
    }
    catch (e: unknown) {
      console.error(`加载全部${isImage ? "图片" : "文件"}资源失败:`, e)
      showMsg(i18n.loadFailed || "加载失败")
    }
  }

  async function loadMissingAssets() {
    try {
      const result = await getMissingAssets()
      if (isMounted.value) missingAssets.value = result || []
    }
    catch (e: unknown) {
      console.error("加载丢失资源失败:", e)
      showMsg(i18n.loadFailed || "加载失败")
    }
  }

  async function loadUnusedAssets() {
    try {
      const result = await getUnusedAssets()
      if (isMounted.value) unusedAssets.value = result || []
    }
    catch (e: unknown) {
      console.error("加载未使用资源失败:", e)
      showMsg(i18n.loadFailed || "加载失败")
    }
  }

  async function refresh() {
    loading.value = true
    try {
      if (activeTab.value === "imageAssets" || activeTab.value === "fileAssets") {
        await loadAllAssets(activeTab.value === "imageAssets")
      }
      else if (activeTab.value === "missingAssets") {
        await loadMissingAssets()
      }
      else if (activeTab.value === "unusedAssets") {
        await loadUnusedAssets()
      }
    }
    finally {
      if (isMounted.value) loading.value = false
    }
  }

  // ── Delete ──

  async function handleDeleteUnused(path: string) {
    if (!confirm(`${i18n.deleteConfirm} ${path}?`)) return
    try {
      await removeUnusedAsset(path)
      if (!isMounted.value) return
      showMsg(i18n.deleteSuccess)
      await loadUnusedAssets()
    }
    catch {
      if (isMounted.value) showMsg(i18n.deleteFailed)
    }
  }

  async function handleDeleteAllUnused() {
    if (!confirm(`${i18n.deleteConfirm}?`)) return
    try {
      await removeUnusedAssets()
      if (!isMounted.value) return
      showMsg(i18n.deleteSuccess)
      await loadUnusedAssets()
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

  function updateAssetItemAfterMove(oldPath: string, newPath: string) {
    const target = activeTab.value === "fileAssets" ? fileAssets : imageAssets
    const idx = target.value.findIndex((item) => item.path === oldPath)
    if (idx === -1) return

    const updated: ImageAssetInfo = {
      ...target.value[idx],
      path: newPath,
    }

    const shouldRemove = categoryFilter.value
      ? !newPath.startsWith(`assets/${categoryFilter.value}/`)
      : quickCategories.value.some((cat) => newPath.startsWith(`assets/${cat.key}/`))

    if (shouldRemove) {
      target.value = target.value.filter((item) => item.path !== oldPath)
    }
    else {
      const next = [...target.value]
      next.splice(idx, 1, updated)
      next.sort((a, b) => a.path.localeCompare(b.path))
      target.value = next
    }
  }

  async function handleMoveAsset(oldPath: string) {
    const newPath = moveNewPath.value.trim()
    if (!newPath || newPath === oldPath) {
      cancelMove()
      return
    }
    try {
      const dirPart = newPath.substring(0, newPath.lastIndexOf("/"))
      if (dirPart && dirPart !== "assets") {
        try { await putFile(`/data/${dirPart}`, true, new File([], "")) }
        catch { /* 目录可能已存在 */ }
      }

      await renameFile(`/data/${oldPath}`, `/data/${newPath}`)

      const escapedOldPath = escapeSqlLike(oldPath)
      const blocks = await sql(
        `SELECT id, markdown FROM blocks WHERE markdown LIKE '%${escapedOldPath}%' LIMIT 1000`,
      ) as { id: string, markdown: string }[]

      let updatedCount = 0
      for (const block of blocks) {
        try {
          const newMarkdown = block.markdown.split(oldPath).join(newPath)
          if (newMarkdown !== block.markdown) {
            await updateBlock("markdown", newMarkdown, block.id)
            updatedCount++
          }
        }
        catch { /* skip single block failure */ }
      }

      try { await fullReindexAssetContent() }
      catch { /* ignore */ }

      if (!isMounted.value) return
      const refMsg = updatedCount > 0 ? `（${i18n.updatedRefs?.replace("{count}", String(updatedCount)) || `已更新 ${updatedCount} 处引用`}）` : ""
      showMsg(`${i18n.moveSuccess}${refMsg}（${i18n.newPath}: ${newPath}）`)
      updateAssetItemAfterMove(oldPath, newPath)
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

  watch(activeTab, () => {
    categoryFilter.value = ""
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
