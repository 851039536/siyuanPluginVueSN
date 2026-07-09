// 单词阅读功能 - 共享纯工具函数
import type { Ref } from "vue"
import type { Flashcard } from "./types"
import type { FlashcardStorage } from "./types/storage"
import { showMessage } from "siyuan"
import { copyToClipboard } from "@/utils/domUtils"

/**
 * 同步增加卡片练习次数（存储 + 本地响应式数组），消除 usePlayWord / onTypingCorrect 中的重复逻辑
 */
export async function syncIncrementPractice(
  storage: FlashcardStorage,
  cards: Ref<Flashcard[]>,
  cardId: string,
): Promise<void> {
  await storage.incrementPracticeCount(cardId)
  const index = cards.value.findIndex((c) => c.id === cardId)
  if (index !== -1) {
    cards.value[index].practiceCount = (cards.value[index].practiceCount || 0) + 1
  }
}

/**
 * 复制文本到剪贴板并显示通知消息
 */
export async function copyAndNotify(
  text: string,
  successMsg: string,
  errorMsg = "复制失败",
): Promise<void> {
  if (!text) return
  const ok = await copyToClipboard(text)
  showMessage(ok ? successMsg : errorMsg, 2000, ok ? "info" : "error")
}
