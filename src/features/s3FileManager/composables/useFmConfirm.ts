/**
 * S3 文件管理器确认框编排 composable
 *
 * 统一承载删除 / 清空日志 / 上传覆盖等需要确认的动作：
 * 单一 Promise 入口（`requestConfirm`），由共享 ConfirmDialog 渲染。
 * 原先「回调式 + Promise 式」两套 API 并存，此处收敛为一套。
 */
import { ref } from "vue"
import type { ConfirmOptions, ConfirmRequest, FmConfirmState } from "../types"

export function useFmConfirm() {
  const confirmState = ref<FmConfirmState | null>(null)
  /** 当前确认框的结果回调（确认 / 取消各一个，二者互斥触发） */
  let resolver: ((ok: boolean) => void) | null = null

  /**
   * 请求确认，返回是否被确认。
   * 同时只能有一个确认框，后到的请求会顶掉前一个（并让前一个按取消结算，避免悬空 Promise）。
   */
  const requestConfirm: ConfirmRequest = (title, message, options?: ConfirmOptions) => {
    resolver?.(false)
    return new Promise<boolean>((resolve) => {
      resolver = resolve
      confirmState.value = {
        title,
        message,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        danger: options?.danger,
      }
    })
  }

  /** 确认：先关闭再结算（避免回调内再次发起确认时状态被覆盖） */
  function handleConfirmAccept(): void {
    const resolve = resolver
    resolver = null
    confirmState.value = null
    resolve?.(true)
  }

  /** 取消 / 关闭：按未确认结算 */
  function handleConfirmCancel(): void {
    const resolve = resolver
    resolver = null
    confirmState.value = null
    resolve?.(false)
  }

  return { confirmState, requestConfirm, handleConfirmAccept, handleConfirmCancel }
}
