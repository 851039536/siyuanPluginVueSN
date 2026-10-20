// 速记功能 — 无依赖纯函数（日期、标签、顺延规则、面板几何约束）
// 这些函数不依赖 Vue 响应式与思源 API，也不 import 本 feature 的其它模块，
// 因此可被 *.spec.ts 直接导入（composable / utils.ts 会间接引入 siyuan，无法在 node 环境加载）
import type { TodoItem } from "./types"

/** 毫秒时间戳 → 本地日期 YYYY-MM-DD（自动顺延与分组比较用） */
export function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** 字符串 YYYY-MM-DD → Date（当天零点），解析失败返回 null */
export function parseDateStr(str: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** 一周毫秒数（周界递推用） */
export const WEEK_MS = 7 * 86_400_000

/**
 * 指定周偏移的周一零点时间戳（offset=0 本周，1 上周…）
 * offset 递增表示向「更早」回溯，故按 offset 向前减 7 天
 */
export function getWeekStart(offset: number, now: number): number {
  const date = new Date(now)
  const day = date.getDay() === 0 ? 7 : date.getDay() // 周一为 1，周日为 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - (day - 1) - offset * 7)
  monday.setHours(0, 0, 0, 0)
  return monday.getTime()
}

/** 标签输入：按逗号/顿号/空格拆分并去重去空（保留首次出现顺序） */
export function splitTags(input: string): string[] {
  const set = new Set<string>()
  input
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => set.add(s))
  return Array.from(set)
}

/**
 * 判定是否逾期：未完成且截止日期严格早于 todayStart
 * @param t 待办条目
 * @param todayStart 今天零点（由调用方预先算好，避免逐条重复解析日期）
 */
export function isOverdueAgainst(t: TodoItem, todayStart: Date | null): boolean {
  if (t.done || !t.dueDate?.trim()) return false
  const due = parseDateStr(t.dueDate)
  if (!due || !todayStart) return false
  return due < todayStart
}

/**
 * 每日自动顺延：若上次顺延日期非今天，将已过期未完成的任务截止日期顺延到今天，
 * 并累计顺延次数。返回是否变更以决定是否需要持久化（未变更项保持原对象引用）
 * @param list 待办列表
 * @param lastRolloverDate 上次顺延日期（YYYY-MM-DD）
 * @param nowMs 当前时刻基准（毫秒，测试可注入固定时间）
 */
export function rolloverOverdue(
  list: TodoItem[],
  lastRolloverDate: string | null,
  nowMs: number,
): { list: TodoItem[], lastRolloverDate: string, changed: boolean } {
  const today = toDateStr(new Date(nowMs))
  if (lastRolloverDate === today) {
    return {
      list,
      lastRolloverDate: today,
      changed: false,
    }
  }
  const todayStart = parseDateStr(today)
  let changed = false
  const next = list.map((t) => {
    // 已逾期（截止日期早于今天）且未完成 → 顺延到今天
    if (!t.done && t.dueDate) {
      const due = parseDateStr(t.dueDate)
      if (due && todayStart && due < todayStart) {
        changed = true
        return {
          ...t,
          dueDate: today,
          rolloverCount: t.rolloverCount + 1,
          updatedAt: nowMs,
        }
      }
    }
    return t
  })
  return {
    list: next,
    lastRolloverDate: today,
    changed,
  }
}

// ==================== 面板几何约束（拖拽 / 缩放 / 视口自适应） ====================

/** 面板宽高（px） */
export interface PanelSize {
  width: number
  height: number
}

/** 面板左上角视口坐标（px） */
export interface PanelPoint {
  x: number
  y: number
}

/**
 * 数值钳制：max 小于 min 时以可用空间 max 为准，
 * 避免「视口比面板最小值还小」时反而撑出屏幕
 */
export function clampBetween(value: number, min: number, max: number): number {
  const upper = Math.max(max, 0)
  const lower = Math.min(min, upper)
  const safeValue = Number.isFinite(value) ? value : lower
  return Math.min(Math.max(safeValue, lower), upper)
}

/**
 * 把期望尺寸钳制到 [最小值, 视口 - 两侧留白]
 * 手动缩放后的尺寸可超过视口（窗口随后变小），故渲染时必须重新钳制
 */
export function resolvePanelSize(
  desired: PanelSize,
  viewport: PanelSize,
  min: PanelSize,
  gutter: number,
): PanelSize {
  return {
    width: clampBetween(desired.width, min.width, viewport.width - gutter * 2),
    height: clampBetween(desired.height, min.height, viewport.height - gutter * 2),
  }
}

/**
 * 把期望左上角钳制到视口内（四周留白 gutter）
 * 保证标题栏拖拽把手始终留在屏幕内，避免面板拖出视口后无法找回
 */
export function resolvePanelPoint(
  desired: PanelPoint,
  size: PanelSize,
  viewport: PanelSize,
  gutter: number,
): PanelPoint {
  return {
    x: clampBetween(desired.x, gutter, viewport.width - size.width - gutter),
    y: clampBetween(desired.y, gutter, viewport.height - size.height - gutter),
  }
}
