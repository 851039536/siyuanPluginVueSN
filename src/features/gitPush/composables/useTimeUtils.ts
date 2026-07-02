// Git 项目时间格式化与排序工具
import type { GitProject } from "../types"

/** 与时间/排序相关的纯工具函数 */
export function useTimeUtils() {
  /** 把 ISO 时间转为相对时间文案（"刚刚/N分钟前/N天前/N个月前"），无法解析返回空 */
  function relativeTime(iso?: string): string {
    if (!iso) return ""
    const t = Date.parse(iso)
    if (isNaN(t)) return ""
    const diff = Date.now() - t
    const min = 60 * 1000; const hour = 60 * min; const day = 24 * hour
    if (diff < min) return "刚刚"
    if (diff < hour) return `${Math.floor(diff / min)}分钟前`
    if (diff < day) return `${Math.floor(diff / hour)}小时前`
    if (diff < 30 * day) return `${Math.floor(diff / day)}天前`
    if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}个月前`
    return `${Math.floor(diff / (365 * day))}年前`
  }

  /** 按活动时间分级（用于卡片颜色提示） */
  function activityLevel(iso?: string): "fresh" | "recent" | "stale" | "dead" {
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

  /** 全局排序：starred 优先 → lastActivity 降序 → name */
  function sortProjects(list: GitProject[]): GitProject[] {
    return [...list].sort((a, b) => {
      if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1
      const ta = a.lastActivity ? Date.parse(a.lastActivity) : 0
      const tb = b.lastActivity ? Date.parse(b.lastActivity) : 0
      if (ta !== tb) return tb - ta
      return a.name.localeCompare(b.name)
    })
  }

  return {
    relativeTime,
    activityLevel,
    sortProjects,
  }
}
