// Paginator 状态推导：由「页码 / 每页条数 / 总条数」算出总页数、首末序号与 change 载荷
// （纯函数，不依赖 Vue 响应式；Paginator.vue 的私有模块，禁止 feature 直接导入）

import type { PaginatorChangePayload } from "./types"

/** 归一后的完整分页状态（页码与每页条数均已收敛到合法范围） */
export interface PaginatorState {
  /** 每页条数 */
  rows: number
  /** 总条数 */
  total: number
  /** 总页数（至少 1） */
  totalPages: number
  /** 当前页（1 基，已收敛到 [1, totalPages]） */
  page: number
  /** 当前页首条序号（1 基，空数据时为 0） */
  first: number
  /** 当前页末条序号（1 基，空数据时为 0） */
  last: number
}

/** 每页条数兜底为正整数：非正数 / 非数字一律回落到 1，避免 `Math.ceil(total / 0)` 得 Infinity */
export function normalizeRows(rows: unknown): number {
  const value = Math.floor(Number(rows))
  return Number.isFinite(value) && value > 0 ? value : 1
}

/** 总条数兜底为非负整数 */
export function normalizeTotal(total: unknown): number {
  const value = Math.floor(Number(total))
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** 由原始入参推导分页状态；页码越界（含数据变少后超界）会被收敛，不会停留在空页 */
export function resolvePaginatorState(
  page: unknown,
  rows: unknown,
  total: unknown,
): PaginatorState {
  const safeRows = normalizeRows(rows)
  const safeTotal = normalizeTotal(total)
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeRows))
  const rawPage = Math.floor(Number(page))
  const current = Number.isFinite(rawPage) ? Math.min(Math.max(1, rawPage), totalPages) : 1

  return {
    rows: safeRows,
    total: safeTotal,
    totalPages,
    page: current,
    first: safeTotal === 0 ? 0 : (current - 1) * safeRows + 1,
    last: Math.min(current * safeRows, safeTotal),
  }
}

/** 以分页状态构造 `change` 事件载荷 */
export function toChangePayload(state: PaginatorState): PaginatorChangePayload {
  return {
    page: state.page,
    rows: state.rows,
    total: state.total,
    totalPages: state.totalPages,
    first: state.first,
    last: state.last,
  }
}

/** 把 `{token}` 占位符替换为计数；未识别的占位符原样保留，便于调用方排查拼写 */
export function formatReport(template: string, tokens: Record<string, number>): string {
  return template.replace(
    /\{(\w+)\}/g,
    (match: string, key: string) => (key in tokens ? String(tokens[key]) : match),
  )
}
