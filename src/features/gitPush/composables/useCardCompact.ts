// gitPush 卡片紧凑密度（隐藏 Markdown / 标签 / 备注等次要信息行）状态与持久化
import type { Ref } from "vue"
import { ref, watch } from "vue"
import type { TypedStorage } from "@/utils/typedStorage"

/**
 * 紧凑密度偏好：启动时读取、变更即保存。
 * 开启后详细模式卡片隐藏 Markdown 徽章 / 标签 / 备注 / 活动时间，只保留名称、路径、分支与页签。
 */
export function useCardCompact(storage: TypedStorage<boolean>): {
  cardCompact: Ref<boolean>
  loadCardCompact: () => Promise<void>
} {
  const cardCompact = ref(false)

  async function loadCardCompact(): Promise<void> {
    cardCompact.value = await storage.loadOrDefault()
  }

  watch(cardCompact, (v) => {
    storage.save(v).catch(() => {})
  })

  return {
    cardCompact,
    loadCardCompact,
  }
}
