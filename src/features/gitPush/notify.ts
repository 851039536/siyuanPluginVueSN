/**
 * gitPush 全局消息提示队列（插件侧宿主适配）
 *
 * 桌面端由 `@host/notify` 提供，插件没有 host 层，故在功能内实现同一套最小契约：
 * 队列 + 去重键 + 可选操作按钮，由 `components/GitPushToaster.vue` 渲染。
 *
 * 只服务于需要「操作按钮」的提示（F6 的撤销入口）；普通提示仍走思源 `showMessage`
 * （`showMessage` 未从这里导出，避免误用后失去思源原生样式与时长行为）。
 *
 * 生命周期口径：提示挂在全局队列上，切卡片 / 失焦都不打断；
 * 10 秒撤销窗口按真实时间计时，鼠标悬停暂停由 Toast 组件负责。
 */
import { ref } from "vue"

export type NotifyType = "info" | "success" | "warning" | "error"

/** 单条提示上的操作按钮 */
export interface NotifyAction {
  /** 按钮文案 */
  label: string
  /** 点击回调；抛错由 Toast 侧告警并照常关闭提示 */
  onClick: () => void
}

export interface NotifyItem {
  id: number
  message: string
  type: NotifyType
  /** 毫秒；0 表示不自动关闭 */
  timeout: number
  /** 可选操作按钮（如「撤销」） */
  action?: NotifyAction
  /** 去重键：同键只保留最新一条 */
  key?: string
}

/** 撤销入口的展示时长：路线图 F0.5 约定操作完成后 10 秒内可撤销 */
export const UNDO_TOAST_TIMEOUT_MS = 10_000

let sequence = 0

/** 当前队列（GitPushToaster 消费） */
export const notifyItems = ref<NotifyItem[]>([])

function push(message: string, timeout: number, type: NotifyType, key?: string, action?: NotifyAction): void {
  if (!message) return
  // 同键先剔除旧条目，再追加新条目（保持队列其余提示不动）
  const base = key ? notifyItems.value.filter(item => item.key !== key) : notifyItems.value
  const id = ++sequence
  notifyItems.value = [...base, {
    id,
    message,
    type,
    timeout: timeout > 0 ? timeout : 0,
    action,
    key,
  }]
}

/**
 * 展示带「撤销」按钮的提示。
 *
 * 10 秒后自动消失；连续同类操作只保留最新一条（同一 key 覆盖），
 * 避免旧按钮指向已被新操作覆盖的历史状态。
 * 按钮文案由调用方给（走 i18n，插件支持 zh/en）；缺省值仅为中文兜底。
 */
export function showUndoMessage(message: string, onUndo: () => void, key = "undo", label = "撤销"): void {
  push(message, UNDO_TOAST_TIMEOUT_MS, "info", key, { label, onClick: onUndo })
}

/** 移除指定提示 */
export function dismissMessage(id: number): void {
  notifyItems.value = notifyItems.value.filter(item => item.id !== id)
}

/** 清空全部提示 */
export function clearMessages(): void {
  notifyItems.value = []
}
