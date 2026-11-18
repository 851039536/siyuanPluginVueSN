/**
 * 提示词库纯工具函数（不依赖 Vue 响应式）
 *
 * 集中放置被 2+ 文件使用的 ID 生成 / 颜色处理 / 提示时长等，避免各组件重复实现。
 * 对应审查报告问题 P2-8、P3-12。
 */
import type { PromptsI18n } from "./types"
import { DEFAULT_PROMPTS_I18N } from "./types"

/** 统一的 showMessage 提示时长（毫秒） */
export const MSG_DURATION = {
  SHORT: 2000,
  LONG: 3000,
} as const

/**
 * 达到条数上限时的错误标识。
 * manager 在写入前抛出它，UI 据此区分"上限"与普通写入失败，避免静默丢弃新条目。
 */
export const PROMPTS_LIMIT_ERROR = "PROMPTS_LIMIT_REACHED"

/**
 * 生成带前缀的唯一 ID（随机 UUID 优先，避免同毫秒批量创建时碰撞）
 * 用于提示词、分类、内容块，替换原先散落各处的 Date.now() 拼接。
 */
export function genId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }
  // 兜底：极老环境无 randomUUID，退化为时间戳 + 随机后缀
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 为十六进制颜色附加透明度（用于卡片分类色背景）。
 * alpha 取 0~1，转成两位十六进制后缀；0.125 → "20"，与历史 `${color}20` 视觉一致。
 */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha))
  const byte = Math.round(clamped * 255)
  return `${hex}${byte.toString(16).padStart(2, "0")}`
}

/**
 * 将可选的部分 i18n 与默认值合并为完整契约对象。
 * 调用方统一用返回值访问文案，杜绝 `(i18n || {}).key!` 产生 undefined。
 */
export function resolvePromptsI18n(partial?: Record<string, string>): PromptsI18n {
  // 始终返回新对象：避免调用方误改共享的 DEFAULT_PROMPTS_I18N
  return { ...DEFAULT_PROMPTS_I18N, ...(partial || {}) } as PromptsI18n
}
