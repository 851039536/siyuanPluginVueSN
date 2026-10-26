/**
 * 脚本启动器 - 数据加载组合式函数
 *
 * 脚本数据仅由本面板读写（无其他消费方），CRUD 后直接重载列表即可，
 * 不再派发/监听全局自定义事件（旧实现自发自收导致每次 CRUD 双重加载）。
 */
import type { Plugin } from "siyuan"
import type {
  CreateScriptDTO,
  Script,
  UpdateScriptDTO,
} from "../types"
import {
  onMounted,
  ref,
} from "vue"
import { ScriptStorage } from "../types/storage"

export function useScriptStorage(plugin: Plugin) {
  const storage = new ScriptStorage(plugin)
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
    return script
  }

  const updateScript = async (id: string, data: UpdateScriptDTO) => {
    const result = await storage.update(id, data)
    await loadScripts()
    return result
  }

  const deleteScript = async (id: string) => {
    const result = await storage.remove(id)
    await loadScripts()
    return result
  }

  onMounted(() => {
    void loadScripts()
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
