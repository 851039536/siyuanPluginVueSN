import type { Plugin } from "siyuan"
import type {
  WebsiteCategory,
  WebsiteEntry,
} from "../types"
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { WebsiteNavigationStorage } from "../types/storage"

export function useWebsiteNavigation(plugin: Plugin) {
  const storage = new WebsiteNavigationStorage(plugin)
  const entries = ref<WebsiteEntry[]>([])
  const categories = ref<WebsiteCategory[]>([])

  const loadData = async () => {
    try {
      entries.value = await storage.getAllEntries()
      categories.value = await storage.getCategories()
    } catch (error) {
      console.error("Failed to load website data:", error)
    }
  }

  let dataChangeHandler: (() => void) | null = null

  onMounted(() => {
    loadData()
    dataChangeHandler = () => loadData()
    window.addEventListener("websiteNavigationDataChanged", dataChangeHandler)
  })

  onUnmounted(() => {
    if (dataChangeHandler) {
      window.removeEventListener("websiteNavigationDataChanged", dataChangeHandler)
      dataChangeHandler = null
    }
  })

  return {
    storage,
    entries,
    categories,
    loadData,
  }
}
