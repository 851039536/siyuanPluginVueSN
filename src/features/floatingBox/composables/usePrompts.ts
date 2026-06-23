import type { Ref } from "vue"
import type { Prompt } from "../types"
import type { FloatingBoxStorage } from "../types/storage"
import { ref } from "vue"

/**
 * 提示词数据管理 composable
 * 负责 prompts 列表的加载、增删改及旧格式迁移
 */
export function usePrompts(storageRef: Ref<FloatingBoxStorage | null>) {
  const prompts = ref<Prompt[]>([])
  const loading = ref(true)

  async function load() {
    const s = storageRef.value
    if (!s) return
    const loaded = await s.prompts.loadOrDefault()
    if (Array.isArray(loaded)) {
      // 旧格式迁移：单 content 字符串 → contents[] 数组
      const needMigration = loaded.some(
        (p) =>
          !p.contents
          || !Array.isArray(p.contents)
          || (p.content && (!p.contents || p.contents.length === 0)),
      )
      if (needMigration) {
        const migrated = s.migratePrompts(loaded)
        if (migrated) {
          await s.prompts.save(loaded)
        }
      }
      prompts.value = loaded
    } else {
      prompts.value = []
    }
    loading.value = false
  }

  async function add(prompt: Prompt) {
    prompts.value.push(prompt)
    await storageRef.value?.prompts.save(prompts.value)
  }

  async function update(updated: Prompt) {
    const idx = prompts.value.findIndex((p) => p.id === updated.id)
    if (idx !== -1) {
      prompts.value[idx] = updated
      await storageRef.value?.prompts.save(prompts.value)
    }
  }

  async function remove(id: string) {
    prompts.value = prompts.value.filter((p) => p.id !== id)
    await storageRef.value?.prompts.save(prompts.value)
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
