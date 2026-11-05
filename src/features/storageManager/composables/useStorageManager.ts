/**
 * 数据管理面板 - 视图状态与刷新编排
 */
import { onMounted, ref } from "vue"
import type { StorageInventory } from "../types/model"
import type { StorageManager } from "../types"

export interface StorageNotice {
  severity: "success" | "error" | "info"
  text: string
}

export function useStorageManager(manager: StorageManager) {
  const inventory = ref<StorageInventory | null>(null)
  const loading = ref(false)
  const error = ref("")
  const notice = ref<StorageNotice | null>(null)

  const refresh = async (force = false): Promise<void> => {
    if (loading.value) return
    loading.value = true
    error.value = ""
    try {
      inventory.value = await manager.getInventory(force)
    } catch (err) {
      error.value = err instanceof Error ? err.message : "dataDirUnavailable"
    } finally {
      loading.value = false
    }
  }

  const notify = (severity: StorageNotice["severity"], text: string): void => {
    notice.value = { severity, text }
  }

  const clearNotice = (): void => {
    notice.value = null
  }

  onMounted(() => {
    void refresh()
  })

  return {
    inventory,
    loading,
    error,
    notice,
    refresh,
    notify,
    clearNotice,
  }
}
