// diff 查看偏好归一化（纯函数）：旧版本/损坏数据逐字段回退默认值

import type { DiffViewPrefs } from "../types/storage"
import { DEFAULT_DIFF_VIEW_PREFS } from "../types/storage"

/** 合并存储值：字段缺失或类型不符时回退默认，layout 只接受三态枚举 */
export function normalizeDiffViewPrefs(raw: Partial<DiffViewPrefs> | null | undefined): DiffViewPrefs {
  const layout = raw?.layout
  return {
    layout: layout === "unified" || layout === "split" || layout === "auto"
      ? layout
      : DEFAULT_DIFF_VIEW_PREFS.layout,
    showLineNumbers: typeof raw?.showLineNumbers === "boolean"
      ? raw.showLineNumbers
      : DEFAULT_DIFF_VIEW_PREFS.showLineNumbers,
    onlyChanges: typeof raw?.onlyChanges === "boolean"
      ? raw.onlyChanges
      : DEFAULT_DIFF_VIEW_PREFS.onlyChanges,
    wrap: typeof raw?.wrap === "boolean"
      ? raw.wrap
      : DEFAULT_DIFF_VIEW_PREFS.wrap,
  }
}
