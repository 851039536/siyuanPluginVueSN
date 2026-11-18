/**
 * 提示词数据管理 composable
 * 负责 prompts 列表的内存态与增删改（加载逻辑见 PromptsStorage.loadPrompts）
 */
import type {
  PromptsManager,
  Prompt,
} from "../types"
import type { ShallowRef } from "vue"
import type { PromptsStorage } from "../types/storage"
import { MAX_PROMPTS } from "../types"
import { ref } from "vue"
import { PROMPTS_LIMIT_ERROR } from "../utils"

export function usePrompts(storageRef: ShallowRef<PromptsStorage | null>): PromptsManager {
  const prompts = ref<Prompt[]>([])
  const loading = ref(true)

  async function load(): Promise<void> {
    const s = storageRef.value
    if (!s) {
      loading.value = false
      return
    }

    try {
      const loaded = await s.loadPrompts()
      prompts.value = loaded
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

    // P2-3：读-改-写包进串行队列，避免并发操作交错覆盖
    await s.runExclusive(async () => {
      // 达到上限时拒绝新增（原先 push 后 slice 会把"新加的那条"裁掉，界面却提示成功）
      if (prompts.value.length >= MAX_PROMPTS) {
        throw new Error(PROMPTS_LIMIT_ERROR)
      }
      prompts.value.push(prompt)
      try {
        // P1-1：必须检查写入结果，失败抛错使下方回滚不再是不可达死代码
        await s.persistOrThrow(s.prompts, prompts.value)
      } catch (error) {
        prompts.value = prompts.value.filter((p) => p.id !== prompt.id)
        console.error("保存提示词失败:", error)
        throw error
      }
    })
  }

  async function update(updated: Prompt): Promise<void> {
    const s = storageRef.value
    if (!s) return

    await s.runExclusive(async () => {
      const idx = prompts.value.findIndex((p) => p.id === updated.id)
      if (idx === -1) return

      const previous = prompts.value[idx]
      prompts.value[idx] = updated
      try {
        await s.persistOrThrow(s.prompts, prompts.value)
      } catch (error) {
        prompts.value[idx] = previous
        console.error("更新提示词失败:", error)
        throw error
      }
    })
  }

  async function remove(id: string): Promise<void> {
    const s = storageRef.value
    if (!s) return

    await s.runExclusive(async () => {
      const previous = prompts.value
      prompts.value = prompts.value.filter((p) => p.id !== id)
      try {
        await s.persistOrThrow(s.prompts, prompts.value)
      } catch (error) {
        prompts.value = previous
        console.error("删除提示词失败:", error)
        throw error
      }
    })
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
