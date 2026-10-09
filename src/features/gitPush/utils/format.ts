// gitPush 展示格式化（纯函数）：相对/绝对时间、年份选项、分析状态文案、活动分级、操作日志标签
import type { GitOpLogEntry } from "../types"
import { formatLocalDate } from "./analysis"

/** LOG 默认显示条数（与 BranchCommitList.countOptions 首项保持一致） */
export const DEFAULT_LOG_LIMIT = 200

/** 把 ISO 时间转为相对时间文案（i18n 驱动，含 {0} 数字占位），无法解析返回空 */
export function relativeTime(iso: string | undefined, i18n: Record<string, any>): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (isNaN(t)) return ""
  const diff = Date.now() - t
  const min = 60 * 1000; const hour = 60 * min; const day = 24 * hour
  if (diff < min) return i18n.timeJustNow
  if (diff < hour) return i18n.timeMinutesAgo.replace("{0}", String(Math.floor(diff / min)))
  if (diff < day) return i18n.timeHoursAgo.replace("{0}", String(Math.floor(diff / hour)))
  if (diff < 30 * day) return i18n.timeDaysAgo.replace("{0}", String(Math.floor(diff / day)))
  if (diff < 365 * day) return i18n.timeMonthsAgo.replace("{0}", String(Math.floor(diff / (30 * day))))
  return i18n.timeYearsAgo.replace("{0}", String(Math.floor(diff / (365 * day))))
}

/** 将 ISO 绝对时间格式化为 "YYYY-MM-DD HH:mm"（空值返回空串，无效日期返回原字符串；提交列表等处共用） */
export function formatDateTime(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ISO 时间 → YYYY-MM-DD HH:mm（无法解析时降级返回原值） */
export function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

/** 显示设置年份选项：数据年份 ∪ 今年 ∪ 已保存 range 年份，降序（分析视图 popover 与设置汇总弹窗共用） */
export function buildYearOptions(entries: { date: string }[], range: "lastYear" | number): number[] {
  const years = new Set<number>([new Date().getFullYear()])
  if (typeof range === "number") years.add(range)
  for (const e of entries) {
    const d = new Date(e.date)
    if (!Number.isNaN(d.getTime())) years.add(d.getFullYear())
  }
  return [...years].sort((a, b) => b - a)
}

/**
 * 分析状态文案统一："分析中… / 上次分析 xx / 未分析"（提交分析与提交规则检查工具条共用，
 * notRunKey 区分 analysisNotRun / ruleCheckNotRun，消除跨工具条重复三元表达式）。
 */
export function analysisStatusText(opts: {
  analyzing: boolean
  analyzed: boolean
  analyzedAt: string
  i18n: Record<string, any>
  notRunKey: string
  /** 相对时间不可用时（analyzedAt 缺失/无法解析）的兜底文案键，如 timeJustNow；不传则保留空串（既有行为） */
  fallbackKey?: string
}): string {
  const { analyzing, analyzed, analyzedAt, i18n, notRunKey, fallbackKey } = opts
  if (analyzing) return i18n.auditing
  if (analyzed) {
    const relative = relativeTime(analyzedAt, i18n) || (fallbackKey ? i18n[fallbackKey] : "")
    return i18n.analysisLastRun.replace("{0}", relative)
  }
  return i18n[notRunKey]
}

/**
 * 统计视图快照状态文案统一："刷新中… / 上次刷新 xx / 共 n 个项目"。
 * 与 analysisStatusText 同源（都走 relativeTime 的三态收敛），差异仅在三态各自取用的 i18n 键：
 * 刷新中取 loadingLabel、有快照取 statsSnapshotAt、从未刷新取 statsProjectCount。
 * 抽出本函数消除 StatsToolbar 内联的同构三元表达式（原与该统一逻辑重复）。
 */
export function statsStatusText(opts: {
  refreshing: boolean
  /** 上次刷新完成时间（ISO，空串 = 本次会话尚未刷新过） */
  refreshedAt: string
  projectCount: number
  i18n: Record<string, any>
}): string {
  const { refreshing, refreshedAt, projectCount, i18n } = opts
  if (refreshing) return i18n.loadingLabel
  if (refreshedAt) return i18n.statsSnapshotAt.replace("{0}", relativeTime(refreshedAt, i18n))
  return i18n.statsProjectCount.replace("{0}", String(projectCount))
}

/** 按活动时间分级（用于卡片颜色提示） */
export function activityLevel(iso?: string): "fresh" | "recent" | "stale" | "dead" {
  if (!iso) return "dead"
  const t = Date.parse(iso)
  if (isNaN(t)) return "dead"
  const day = 24 * 60 * 60 * 1000
  const diff = Date.now() - t
  if (diff < 7 * day) return "fresh"
  if (diff < 30 * day) return "recent"
  if (diff < 90 * day) return "stale"
  return "dead"
}

/** 判断操作日志条目是否包含平台明细（push/pull 且有 platforms 数据） */
export function hasLogPlatforms(entry: GitOpLogEntry): boolean {
  return (entry.action === "push" || entry.action === "pull") && !!entry.platforms?.length
}

/** 操作类型 → 中文标签（i18n 驱动，无匹配时降级返回原始 action） */
export function logActionLabel(action: string, i18n: Record<string, any>): string {
  const map: Record<string, string> = {
    push: i18n.opPush,
    pull: i18n.opPull,
    commit: i18n.opCommit,
  }
  return map[action] ?? action
}

/**
 * 操作日志条目 → 复制到剪贴板的纯文本（**单一真源**，表格行与详情弹窗共用）。
 *
 * 历史问题：两处各自拼接过这段文本，且时间口径不一致 —— 表格行用
 * `formatLogTime(time).slice(11)` 只保留了 `HH:mm`，弹窗用完整 `YYYY-MM-DD HH:mm`。
 * 跨天日志从行内复制出来后无法分辨是哪天的操作，故统一为**完整日期时间**（信息更全）。
 *
 * commit 条目附带完整提交信息（换行分隔）；其余条目为「[时间] 项目名 — 摘要」。
 */
export function formatLogEntryText(entry: GitOpLogEntry): string {
  const stamp = formatLogTime(entry.time)
  if (entry.message) return `[${stamp}] ${entry.projectName}\n${entry.message}`
  return `[${stamp}] ${entry.projectName} — ${entry.summary}`
}

/**
 * ISO 时间戳 → 自然日键 `YYYY-MM-DD`（日志按日分组用；无法解析时降级返回原串）。
 *
 * ⚠️ 必须显式判 `Number.isNaN`：`new Date("garbage")` **不抛错**，而是得到 Invalid Date，
 * 直接交给 formatLocalDate 会产出字面量 `"NaN-NaN-NaN"` 并成为分组键
 * （原实现用 try/catch 兜底，该分支实际永不触发，属隐性的空兜底）。
 */
export function logDateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return formatLocalDate(d)
}

/**
 * ISO 时间戳 → 分组标题（"今天" / "昨天" / `YYYY-MM-DD`）。
 *
 * 按本地自然日比较（而非小时差），避免「今天 00:30」与「昨天 23:50」被算成同一天；
 * 两侧都归零到 00:00 后再取整日差，故夏令时切换日也不会差一天。
 */
export function logDateLabel(iso: string, i18n: Record<string, any>): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000)
  if (diff === 0) return i18n.logDateToday
  if (diff === 1) return i18n.logDateYesterday
  return logDateKey(iso)
}
