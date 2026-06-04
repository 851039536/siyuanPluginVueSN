/**
 * 脚本启动器 - 数据加载组合式函数
 */
import type { Plugin } from "siyuan"
import type {
  CreateScriptDTO,
  Script,
  UpdateScriptDTO,
} from "../types"
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { emitCustomEvent } from "@/utils/eventBus"
import { ScriptStorage } from "../types/storage"

export function useScriptStorage(plugin: Plugin) {
  const storage = new ScriptStorage(plugin, "")
  const scripts = ref<Script[]>([])

  const loadScripts = async () => {
    try {
      scripts.value = await storage.getAll()
    } catch (error) {
      console.error("Failed to load scripts:", error)
    }
  }

  const addScript = async (data: CreateScriptDTO) => {
    const script = await storage.add(data)
    await loadScripts()
    emitCustomEvent("scriptDataChanged")
    return script
  }

  const updateScript = async (id: string, data: UpdateScriptDTO) => {
    const result = await storage.update(id, data)
    await loadScripts()
    emitCustomEvent("scriptDataChanged")
    return result
  }

  const deleteScript = async (id: string) => {
    const result = await storage.remove(id)
    await loadScripts()
    emitCustomEvent("scriptDataChanged")
    return result
  }

  let dataChangeHandler: (() => void) | null = null

  onMounted(() => {
    loadScripts()
    dataChangeHandler = () => loadScripts()
    window.addEventListener("scriptDataChanged", dataChangeHandler)
  })

  onUnmounted(() => {
    if (dataChangeHandler) {
      window.removeEventListener("scriptDataChanged", dataChangeHandler)
      dataChangeHandler = null
    }
  })

  return {
    storage,
    scripts,
    loadScripts,
    addScript,
    updateScript,
    deleteScript,
  }
}
