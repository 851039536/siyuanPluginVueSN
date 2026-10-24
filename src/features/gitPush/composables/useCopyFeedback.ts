// gitPush 「复制 → 成功反馈」通用 composable：copied 状态 + 自动还原 + 卸载清理
import { onUnmounted, ref } from "vue"
import { TimerRegistry } from "@/utils/timerRegistry"

/**
 * 复制反馈状态机（操作日志的表格行与详情弹窗共用）。
 *
 * 原先两处各自维护 `copied` ref + `setTimeout` 句柄 + `onUnmounted` 清理，
 * 属同一模式的复制粘贴 —— 也正是这类重复让「复制文本」在两处产生了不同格式（见 formatLogEntryText）。
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
