// gitPush 单文件 HTML 导出 — 格式化原语（转义 / i18n 取值 / 占位替换 / 数值格式化）
// 直连叶子模块（不经 "../../utils" 桶）：桶会经 project.ts 拉入运行时 siyuan 依赖。
import { fmtTemplate } from "../utils/i18nFormat"

/** HTML 文本转义（& < > " ' 五字符全覆盖，同时适用于属性值） */
export function escapeHtml(input: string): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** i18n 取值（缺失键回退为空串，避免 undefined 泄漏进 HTML） */
export function t(i18n: Record<string, any>, key: string): string {
  const v = i18n?.[key]
  return typeof v === "string" ? v : ""
}

/**
 * 格式化模板占位（报告内多处用 {0}/{1}… 占位）；统一委托 fmtTemplate 单一真源。
 * 多占位模板请一次传齐参数（如 fmtTemplate(tpl, a, b)），嵌套单参调用无法替换 {1}。
 */
export function fmt(template: string, ...args: (string | number)[]): string {
  return fmtTemplate(template, ...args)
}

/** 数值千分位（与面板观感一致） */
export function num(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "0"
}

/** 百分比（0~100 整数） */
export function pct(part: number, total: number): string {
  if (!total) return "0%"
  return `${Math.round((part / total) * 100)}%`
}
