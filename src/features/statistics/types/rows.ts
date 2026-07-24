// SQL 查询结果行类型定义（各 queries 模块共用，替代散落的 any 行类型）

/** 通用 SQL 查询结果行（executeSql 泛型默认值） */
export type SqlRow = Record<string, unknown>

/** blocks 表文档行（type='d' 常用字段） */
export interface DocBlockRow {
  id: string
  content?: string
  created?: string
  updated?: string
  box?: string
}

/** 按日期分组的计数行 */
export interface DateCountRow {
  date: string
  cnt?: number
}

/** 按块类型分组的计数行 */
export interface BlockTypeCountRow {
  type: string
  cnt?: number
}

/** 字数聚合行（分组字段动态：date/month/year 之一） */
export interface AggregationRow {
  date?: string
  month?: string
  year?: string
  total?: number
}

/** 单值聚合行（SUM/COUNT 结果） */
export interface ScalarRow {
  total_words?: number
  cnt?: number
  active_days?: number
}

/** 按日期聚合的字数/创建数行 */
export interface DateWordsRow {
  date: string
  words?: number
  created?: number
}

/** 按月份聚合的字数/创建数行 */
export interface MonthWordsRow {
  month: string
  words?: number
  created?: number
}

/** 仅含日期的行 */
export interface DateOnlyRow {
  date: string
}

/** 笔记本文档数聚合行 */
export interface NotebookDocCountRow {
  notebook_id: string
  doc_count?: number
}

/** 笔记本字数聚合行（total_words 别名） */
export interface NotebookWordRow {
  notebook_id: string
  total_words?: number
}

/** 笔记本字数聚合行（words 别名） */
export interface NotebookWordSumRow {
  notebook_id: string
  words?: number
}

/** 笔记本按日期活跃度行 */
export interface NotebookActivityRow {
  notebook_id: string
  date: string
  words?: number
}

/** 笔记本块类型分布行 */
export interface NotebookBlockTypeRow {
  notebook_id: string
  type: string
  cnt?: number
}
