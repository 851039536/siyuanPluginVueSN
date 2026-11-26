// gitPush 「复制 → 成功反馈」通用 composable：copied 状态 + 自动还原 + 卸载清理
import type { Ref } from "vue"
import { onUnmounted, ref } from "vue"
import { TimerRegistry } from "@/utils/timerRegistry"

/**
 * 复制反馈状态机（各弹窗与列表行的复制按钮共用，避免各自维护 copied + setTimeout + 卸载清理）。
 *
 * 定时器统一走 TimerRegistry（项目规范：计时器句柄集中托管，禁裸 setTimeout）。
 *
 * @param resetAfterMs 成功反馈保持时长（默认 2000ms）
 * @returns copied（是否处于成功反馈态）与 notifyCopied（外部复制成功后调用）
 */
export function useCopyFeedback(resetAfterMs = 2000) {
  const copied = ref(false)
  const timers = new TimerRegistry()
  let timer: number | null = null

  /** 标记「刚复制成功」，并在 resetAfterMs 后自动还原（重复调用会重置计时） */
  function notifyCopied() {
    timers.clear(timer)
    copied.value = true
    timer = timers.setTimeout(() => { copied.value = false }, resetAfterMs)
  }

  onUnmounted(() => {
    timers.clearAll()
  })

  return { copied, notifyCopied }
}

/**
 * 按行键区分的复制反馈（列表类场景：多行各带复制按钮，只让「刚复制的那一行」进入反馈态）。
 *
 * @param resetAfterMs 成功反馈保持时长（默认 2000ms）
 * @returns copiedKey（处于反馈态的行键，空串 = 无）与 notifyCopied(key)（复制成功后调用）
 */
export function useKeyedCopyFeedback(resetAfterMs = 2000): {
  copiedKey: Ref<string>
  notifyCopied: (key: string) => void
} {
  const copiedKey = ref("")
  const timers = new TimerRegistry()
  let timer: number | null = null

  /** 标记某行「刚复制成功」，并在 resetAfterMs 后还原（连续复制以最后一次为准） */
  function notifyCopied(key: string) {
    timers.clear(timer)
    copiedKey.value = key
    timer = timers.setTimeout(() => { copiedKey.value = "" }, resetAfterMs)
  }

  onUnmounted(() => {
    timers.clearAll()
  })

  return { copiedKey, notifyCopied }
}

