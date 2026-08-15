import type {
  Ref,
  ShallowRef,
} from "vue"
import type { Prompt } from "../types"
import type { PromptsStorage } from "../types/storage"
import { ref } from "vue"

/**
 * 提示词数据管理 composable
 * 负责 prompts 列表的加载、增删改及旧格式迁移
 */
export function usePrompts(storageRef: ShallowRef<PromptsStorage | null>): {
  prompts: Ref<Prompt[]>
  loading: Ref<boolean>
  load: () => Promise<void>
  add: (prompt: Prompt) => Promise<void>
  update: (updated: Prompt) => Promise<void>
  remove: (id: string) => Promise<void>
} {
  const prompts = ref<Prompt[]>([])
  const loading = ref(true)

  async function load(): Promise<void> {
    const s = storageRef.value
    if (!s) {
      loading.value = false
      return
    }

    try {
      const loaded = await s.loadPromptsWithMigration()
      if (Array.isArray(loaded)) {
        const needMigration = loaded.some(
          (p) =>
            !p.contents
            || !Array.isArray(p.contents)
            || (p.content && (!p.contents || p.contents.length === 0)),
        )
        if (needMigration && s.migratePrompts(loaded)) {
          await s.prompts.save(loaded)
        }
        prompts.value = loaded
      } else {
        prompts.value = []
      }
    } catch (error) {
      console.error("加载提示词失败:", error)
      prompts.value = []
    } finally {
      loading.value = false
    }
  }

  async function add(prompt: Prompt): Promise<void> {
    const s = storageRef.value
    if (!s) return

    prompts.value.push(prompt)
    try {
      await s.prompts.save(prompts.value)
    } catch (error) {
      prompts.value = prompts.value.filter((p) => p.id !== prompt.id)
      console.error("保存提示词失败:", error)
      throw error
    }
  }

  async function update(updated: Prompt): Promise<void> {
    const s = storageRef.value
    if (!s) return

    const idx = prompts.value.findIndex((p) => p.id === updated.id)
    if (idx === -1) return

    const previous = prompts.value[idx]
    prompts.value[idx] = updated
    try {
      await s.prompts.save(prompts.value)
    } catch (error) {
      prompts.value[idx] = previous
      console.error("更新提示词失败:", error)
      throw error
    }
  }

  async function remove(id: string): Promise<void> {
    const s = storageRef.value
    if (!s) return

    const previous = prompts.value
    prompts.value = prompts.value.filter((p) => p.id !== id)
    try {
      await s.prompts.save(prompts.value)
    } catch (error) {
      prompts.value = previous
      console.error("删除提示词失败:", error)
      throw error
    }
  }

  return {
    prompts,
    loading,
    load,
    add,
    update,
    remove,
  }
}
