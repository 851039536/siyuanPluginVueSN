// gitPush 报告表格纯排序比较器（热点/债务表列头排序共用；视图层状态在组件内）
//
// 从 CodeReport 组件迁出：比较器是纯函数，须可被单测覆盖。
// 语义：所有列默认降序（越大/越新越靠前，与榜单直觉一致），再次点击列头翻转由组件用 reverse 控制。

/** 热点表可排序列 */
export type HotspotSortKey = "heat" | "modCount" | "authorCount" | "loc" | "lastModified"

/** 债务表可排序列 */
export type DebtSortKey = "riskScore" | "modCount" | "lastModified"

/** 排序行的最小形状（热点/债务行的超集） */
interface SortableRow {
  modCount: number
  authorCount: number
  lastModified: string
  loc?: number | null
  heat?: number
  riskScore?: number
}

/** 排序键的取值器（null/undefined 视为最小值，排最后） */
function valueOf(row: SortableRow, key: HotspotSortKey | DebtSortKey): number {
  switch (key) {
    case "heat":
      return row.heat ?? 0
    case "riskScore":
      return row.riskScore ?? 0
    case "modCount":
      return row.modCount
    case "authorCount":
      return row.authorCount
    case "loc":
      return row.loc ?? -1
    case "lastModified":
      return row.lastModified ? Date.parse(row.lastModified) || 0 : 0
    default:
      return 0
  }
}

/**
 * 生成降序比较器（NaN/无效值统一按 0 处理，避免 Array.sort 对 NaN 的未定义行为）。
 * lastModified 按时间戳比较而非字典序（时区偏移符号会误判先后，与 aggregateFileStats 同口径）。
 */
export function compareByDesc<T extends SortableRow>(
  key: HotspotSortKey | DebtSortKey,
): (a: T, b: T) => number {
  return (a, b) => {
    const va = valueOf(a, key)
    const vb = valueOf(b, key)
    if (va === vb) return 0
    return vb - va
  }
}
