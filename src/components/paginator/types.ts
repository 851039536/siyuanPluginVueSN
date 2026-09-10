// Paginator 类型与默认常量：尺寸档位、页码窗口元素、导航文案兜底、变更载荷
// （Paginator.vue 的私有模块，禁止 feature 直接导入）

/** 尺寸档位（与全库控件阶梯一致） */
export type PaginatorSize = "xsmall" | "small" | "medium" | "large"

/** 页码窗口元素：数字为可点击页码，此值代表折叠点 */
export const PAGE_LINK_ELLIPSIS = "ellipsis"

/** 页码窗口元素 */
export type PageLink = number | typeof PAGE_LINK_ELLIPSIS

/** 导航控件的无障碍名称（可整体或逐项覆盖） */
export interface PaginatorLabels {
  /** 首页 */
  first?: string
  /** 上一页 */
  prev?: string
  /** 下一页 */
  next?: string
  /** 末页 */
  last?: string
  /** 跳页输入 */
  jump?: string
  /** 每页条数下拉 */
  rowsPerPage?: string
  /** 单个页码链接的无障碍名称，`{page}` 会被替换为页码 */
  pageLink?: string
}

/**
 * 导航文案兜底（组件内不硬编码中文 UI 文案的例外：默认 prop 值，
 * 沿用 Select.clearLabel / DatePicker.DEFAULT_ARIA_LABELS 的既有做法，调用方可覆盖）
 */
export const DEFAULT_LABELS: Required<PaginatorLabels> = {
  first: "首页",
  prev: "上一页",
  next: "下一页",
  last: "末页",
  jump: "跳至页码",
  rowsPerPage: "每页条数",
  pageLink: "第 {page} 页",
}

/** `change` 事件载荷：一次性提交时携带的完整分页状态 */
export interface PaginatorChangePayload {
  /** 1 基当前页 */
  page: number
  /** 每页条数 */
  rows: number
  /** 总条数 */
  total: number
  /** 总页数（至少 1） */
  totalPages: number
  /** 当前页首条序号（1 基，空数据时为 0） */
  first: number
  /** 当前页末条序号（1 基，空数据时为 0） */
  last: number
}

/** 报告模板占位符 */
export interface PaginatorReportTokens {
  page: number
  totalPages: number
  rows: number
  total: number
  first: number
  last: number
}
