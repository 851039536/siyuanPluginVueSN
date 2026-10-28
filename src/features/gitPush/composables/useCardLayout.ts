// gitPush 卡片布局（详细 / 手风琴）状态与持久化
import type { Ref } from "vue"
import { ref, watch } from "vue"
import type { TypedStorage } from "@/utils/typedStorage"
import type { CardLayout } from "../types/meta"

/**
 * 卡片布局偏好：启动时读取、变更即保存。
 * detailed = 全部卡片常驻展开（现状）；accordion = 收起为摘要行，一次只展开一张。
 */
export function useCardLayout(storage: TypedStorage<CardLayout>): {
  cardLayout: Ref<CardLayout>
  loadCardLayout: () => Promise<void>
} {
  const cardLayout = ref<CardLayout>("detailed")

  async function loadCardLayout(): Promise<void> {
    cardLayout.value = await storage.loadOrDefault()
  }

  watch(cardLayout, (v) => {
    storage.save(v).catch(() => {})
  })

  return {
    cardLayout,
    loadCardLayout,
  }
}
