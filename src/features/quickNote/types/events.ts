/**
 * 速记 — 面板交互事件名常量
 * Manager 与面板共用同一字符串，避免两侧字面量漂移导致监听静默失效
 */

/** 遮罩点击请求收起为最小化条（Manager → 面板） */
export const QUICK_NOTE_MASK_MINIMIZE_EVENT = "quickNoteMaskMinimize"

/**
 * 面板状态变更（Manager → 面板）
 * open / reset / 初始化回放等「面板未主动发起」的状态变化后派发，
 * 面板据此把本地 position / minimized ref 拉回 Manager 的权威状态
 */
export const QUICK_NOTE_STATE_EVENT = "quickNoteStateChange"
