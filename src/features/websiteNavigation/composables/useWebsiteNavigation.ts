/**
 * 网站导航 — 数据层 composable（模块级单例，面板与弹窗共享同一份数据）
 */
import type { Plugin } from "siyuan"
import {
  onMounted,
  ref,
} from "vue"
import type {
  CreateWebsiteDTO,
  UpdateWebsiteDTO,
  WebsiteCategory,
  WebsiteEntry,
} from "@/utils/sharedStorage/websiteStorage"
import {
  DEFAULT_CATEGORY_ID,
  WebsiteNavigationStorage,
} from "@/utils/sharedStorage/websiteStorage"

let storage: WebsiteNavigationStorage | null = null

function requireStorage(): WebsiteNavigationStorage {
  if (!storage) {
    throw new Error("[WebsiteNavigation] storage not initialized")
  }
  return storage
}

export const entries = ref<WebsiteEntry[]>([])
export const categories = ref<WebsiteCategory[]>([])

export function getCategoryById(id: string): WebsiteCategory | undefined {
  return categories.value.find((c) => c.id === id)
}

/** 加载全部数据，返回是否成功 */
export async function loadData(): Promise<boolean> {
  try {
    const [nextEntries, nextCategories] = await Promise.all([
      requireStorage().getAllEntries(),
      requireStorage().getCategories(),
    ])
    entries.value = nextEntries
    categories.value = nextCategories
    return true
  } catch (error) {
    console.error("Failed to load website data:", error)
    return false
  }
}

export async function createEntry(data: CreateWebsiteDTO): Promise<WebsiteEntry> {
  const entry = await requireStorage().createEntry(data)
  entries.value = [...entries.value, entry]
  return entry
}

export async function updateEntry(id: string, data: UpdateWebsiteDTO): Promise<boolean> {
  const updated = await requireStorage().updateEntry(id, data)
  if (!updated) return false
  entries.value = entries.value.map((e) => (e.id === id ? updated : e))
  return true
}

export async function deleteEntry(id: string): Promise<boolean> {
  const ok = await requireStorage().deleteEntry(id)
  if (!ok) return false
  entries.value = entries.value.filter((e) => e.id !== id)
  return true
}

/** 新增分类；重名/空名称返回 false，持久化失败抛出异常 */
export async function addCategory(name: string, color: string): Promise<boolean> {
  const trimmed = name.trim()
  if (!trimmed || categories.value.some((c) => c.name === trimmed)) {
    return false
  }

  const cat: WebsiteCategory = {
    id: Date.now().toString(),
    name: trimmed,
    color,
  }
  const next = [...categories.value, cat]
  const ok = await requireStorage().saveCategories(next)
  if (!ok) {
    throw new Error("Failed to save categories")
  }
  categories.value = next
  return true
}

/** 删除分类；有条目或删除默认分类返回 false，持久化失败抛出异常 */
export async function removeCategory(id: string): Promise<boolean> {
  if (id === DEFAULT_CATEGORY_ID || entries.value.some((e) => e.category === id)) {
    return false
  }

  const next = categories.value.filter((c) => c.id !== id)
  const ok = await requireStorage().saveCategories(next)
  if (!ok) {
    throw new Error("Failed to save categories")
  }
  categories.value = next
  return true
}

/**
 * 初始化数据层：仅在父面板 setup 中调用一次。
 * 弹窗子组件直接复用模块级 refs 与 CRUD 函数，避免各自创建 Storage。
 */
export function useWebsiteNavigation(plugin: Plugin) {
  if (!storage) {
    storage = new WebsiteNavigationStorage(plugin)
  }

  onMounted(async () => {
    await loadData()
  })
}
