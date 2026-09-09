// 分类管理 composable：内置/自定义分类可见性组装、空分类删除（内置=隐藏）、恢复与持久化
import type { Plugin } from "siyuan"
import type { CategoryItem, ResourceManagerI18n } from "../types"
import { computed, onMounted, ref } from "vue"
import { readDir, removeFile } from "@/api"
import { PluginStorage } from "@/utils/pluginStorage"
import {
  BUILT_IN_CATEGORY_DEFS,
  BUILT_IN_CATEGORY_KEYS,
  categoryDirPrefix,
  normalizeCategoryKey,
  resolveCategoryLabel,
  STORAGE_HIDDEN_KEY,
  STORAGE_KEY,
} from "../utils"

/** 空分类删除结果：ok 删除成功 / notEmpty 分类下仍有资源 / failed 持久化失败 */
export type DeleteCategoryResult = "ok" | "notEmpty" | "failed"

/**
 * 分类可见性管理：内置分类可删除（=隐藏并持久化，可恢复），自定义分类删除后从存储移除。
 * @param getAssetPaths 读取全量资源路径列表（图片+文件），用于判定分类目录是否仍被资源占用
 */
export function useCategoryManager(
  plugin: Plugin,
  i18n: ResourceManagerI18n,
  getAssetPaths: () => readonly string[],
) {
  const storage = new PluginStorage(plugin)
  /** 用户自建分类（key 归一化小写，落盘 assets/<key>/） */
  const customCategories = ref<string[]>([])
  /** 被隐藏的内置分类 key 集合（删除内置分类即隐藏，保留可恢复入口） */
  const hiddenBuiltIn = ref<string[]>([])

  /** 可见的内置分类（排除已隐藏） */
  const builtInCategories = computed<CategoryItem[]>(() =>
    BUILT_IN_CATEGORY_DEFS
      .filter((def) => !hiddenBuiltIn.value.includes(def.key))
      .map((def) => ({ key: def.key, label: resolveCategoryLabel(i18n, def.key), builtIn: true })),
  )

  /** 被隐藏的内置分类（供「已隐藏」展开区恢复） */
  const hiddenBuiltInCategories = computed<CategoryItem[]>(() =>
    BUILT_IN_CATEGORY_DEFS
      .filter((def) => hiddenBuiltIn.value.includes(def.key))
      .map((def) => ({ key: def.key, label: resolveCategoryLabel(i18n, def.key), builtIn: true })),
  )

  /** 分类栏全量条目：可见内置 + 自定义 */
  const quickCategories = computed<CategoryItem[]>(() => [
    ...builtInCategories.value,
    ...customCategories.value.map((key) => ({ key, label: key, builtIn: false })),
  ])

  /** 判定分类目录下是否仍占用资源：内存缓存前缀优先，磁盘目录条目兜底 */
  async function hasCategoryContent(key: string): Promise<boolean> {
    const prefix = categoryDirPrefix(key)
    if (getAssetPaths().some((p) => p.toLowerCase().startsWith(prefix))) return true
    try {
      // 磁盘兜底：覆盖缓存滞后时磁盘仍有文件（含非索引可见条目）的情况；目录不存在视为空
      const entries = await readDir(`/data/assets/${key}`)
      const list = entries || []
      return list.length > 0
    }
    catch {
      return false
    }
  }

  /** 预检分类目录当前是否为空（供 UI 在确认框前先行拦截不可删分类） */
  async function isCategoryEmpty(key: string): Promise<boolean> {
    return !(await hasCategoryContent(key))
  }

  /** 移除磁盘上的空分类目录（目录不存在/删除失败均不阻断分类移除） */
  async function removeEmptyCategoryDir(key: string): Promise<void> {
    try {
      await removeFile(`/data/assets/${key}`)
    }
    catch (e: unknown) {
      console.warn(`删除分类空目录失败（可忽略）: assets/${key}`, e)
    }
  }

  /**
   * 删除空分类：内置分类删除=隐藏（磁盘空目录一并清理，可从「已隐藏」恢复）；
   * 自定义分类删除=移除记录并持久化。分类下仍有资源时返回 notEmpty。
   */
  async function deleteCategory(key: string): Promise<DeleteCategoryResult> {
    const cat = normalizeCategoryKey(key)
    if (await hasCategoryContent(cat)) return "notEmpty"
    await removeEmptyCategoryDir(cat)
    if (BUILT_IN_CATEGORY_KEYS.has(cat)) {
      if (hiddenBuiltIn.value.includes(cat)) return "ok"
      const next = [...hiddenBuiltIn.value, cat]
      try {
        await storage.save(STORAGE_HIDDEN_KEY, next)
      }
      catch (e: unknown) {
        console.error("保存隐藏内置分类失败:", e)
        return "failed"
      }
      hiddenBuiltIn.value = next
    }
    else {
      const next = customCategories.value.filter((c) => c !== cat)
      try {
        await storage.save(STORAGE_KEY, next)
      }
      catch (e: unknown) {
        console.error("保存自定义分类失败:", e)
        return "failed"
      }
      customCategories.value = next
    }
    return "ok"
  }

  /** 恢复被隐藏的内置分类（仅移除隐藏标记，不重建磁盘目录，目录在下次移入资源时自动创建） */
  async function restoreBuiltIn(key: string): Promise<void> {
    const cat = normalizeCategoryKey(key)
    if (!BUILT_IN_CATEGORY_KEYS.has(cat) || !hiddenBuiltIn.value.includes(cat)) return
    const next = hiddenBuiltIn.value.filter((c) => c !== cat)
    try {
      await storage.save(STORAGE_HIDDEN_KEY, next)
      hiddenBuiltIn.value = next
    }
    catch (e: unknown) {
      console.error("恢复内置分类失败:", e)
    }
  }

  /** 移动成功后将新自定义分类写入存储（内置 key 与重复项跳过） */
  async function addCustomCategory(key: string): Promise<void> {
    const cat = normalizeCategoryKey(key)
    if (!cat || BUILT_IN_CATEGORY_KEYS.has(cat) || customCategories.value.includes(cat)) return
    const next = [...customCategories.value, cat]
    try {
      await storage.save(STORAGE_KEY, next)
      customCategories.value = next
    }
    catch (e: unknown) {
      console.error("保存自定义分类失败:", e)
    }
  }

  onMounted(async () => {
    try {
      const saved = await storage.load<string[]>(STORAGE_KEY)
      if (Array.isArray(saved)) {
        // 历史数据可能含大写/空白/误入的内置 key，读取时归一化去重并过滤
        customCategories.value = [...new Set(saved
          .map(normalizeCategoryKey)
          .filter((k) => k && !BUILT_IN_CATEGORY_KEYS.has(k)))]
      }
    }
    catch (e: unknown) {
      console.error("读取自定义分类失败:", e)
    }
    try {
      const saved = await storage.load<string[]>(STORAGE_HIDDEN_KEY)
      if (Array.isArray(saved)) {
        hiddenBuiltIn.value = [...new Set(saved.filter((k): k is string =>
          typeof k === "string" && BUILT_IN_CATEGORY_KEYS.has(k)))]
      }
    }
    catch (e: unknown) {
      console.error("读取隐藏内置分类失败:", e)
    }
  })

  return {
    quickCategories,
    hiddenBuiltInCategories,
    isCategoryEmpty,
    deleteCategory,
    restoreBuiltIn,
    addCustomCategory,
  }
}
