/**
 * 文档分析功能 - Select 选项与载荷归一共享工具
 * 供过滤栏 / 设置弹窗 / 列表排序三处共用，避免重复实现。
 */
import type { NotebookInfo } from "../types/index"

/** Select 载荷归一为字符串（组件载荷为 string | number | boolean | null） */
export function normalizeSelectValue(value: string | number | boolean | null): string {
  return value === null ? "" : String(value)
}

/** 笔记本选项：空串代表"全部笔记本"（与 FilterOptions.notebookId 的空值语义一致） */
export function notebookSelectOptions(notebooks: NotebookInfo[]): { value: string, label: string }[] {
  return [
    { value: "", label: "全部笔记本" },
    ...notebooks.map((nb) => ({ value: nb.id, label: nb.name })),
  ]
}
