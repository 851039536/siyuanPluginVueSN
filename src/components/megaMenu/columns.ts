// MegaMenu 分组列切分（纯函数，零 Vue 依赖）
// 沿用 splitter/sizes.ts、confirm/position.ts 的「计算外置、组件只做编排」先例
import type { MegaMenuItem } from "./types"

/** 一个分组列：可选列标题 + 该列下的叶子项 */
export interface MegaMenuColumn {
  /** 列标题项（原 `header: true` 的那一项），无标题列时为 `undefined` */
  header?: MegaMenuItem
  /** 该列的叶子项（不含标题项） */
  items: MegaMenuItem[]
}

/**
 * 把子项切分为多列：遇 `header: true` 的项开新列并作为该列标题，其余项归入当前列。
 *
 * 规则：
 * - **首个 `header` 之前的项**归入一个无标题列（允许「不分组、纯列表」的简单用法）
 * - 连续多个 `header` 时，后一个会开新列（前一个成为空标题列 —— 属调用方数据问题，不做静默丢弃）
 * - 无任何 `header` 时整体退化为**单列**（此时与普通下拉菜单等价，符合预期）
 *
 * 复杂度 O(n)，每次面板渲染调用一次（项数很少，无需缓存）。
 */
export function buildColumns(items?: MegaMenuItem[]): MegaMenuColumn[] {
  if (!items || items.length === 0) return []

  const columns: MegaMenuColumn[] = []
  /** 当前正在填充的列；首项即为 header 时不会产生前置空列 */
  let current: MegaMenuColumn | null = null

  for (const item of items) {
    if (item.header) {
      current = { header: item, items: [] }
      columns.push(current)
      continue
    }
    if (!current) {
      // 首个 header 之前的散项：自建一个无标题列承载
      current = { items: [] }
      columns.push(current)
    }
    current.items.push(item)
  }

  return columns
}
