/**
 * Markdown 导出功能类型定义
 */

/**
 * 笔记本信息
 */
export interface NotebookInfo {
  id: string           // 笔记本 ID
  name: string         // 笔记本名称
  docCount?: number    // 文档数量
  closed?: boolean     // 是否关闭
}

/**
 * 导出进度信息
 */
export interface ExportProgress {
  show: boolean        // 是否显示进度
  current: number      // 当前导出数量
  total: number        // 总数量
  percent: number      // 完成百分比
}

/**
 * 导出日志
 */
export interface ExportLog {
  type: 'success' | 'error' | 'info'  // 日志类型
  message: string                      // 日志消息
  timestamp?: Date                     // 时间戳
}

/**
 * 导出选项
 */
export interface ExportOptions {
  notebookId: string   // 笔记本 ID
  notebookName: string // 笔记本名称
}

/**
 * 导出结果
 */
export interface ExportResult {
  success: boolean     // 是否成功
  notebookId: string   // 笔记本 ID
  notebookName: string // 笔记本名称
  error?: string       // 错误信息
}

/**
 * 思源笔记 API 响应 - 笔记本列表
 */
export interface SiYuanNotebooksResponse {
  notebooks: NotebookInfo[]
}

/**
 * 思源笔记 API 响应 - 导出笔记本
 */
export interface SiYuanExportResponse {
  code: number         // 响应码
  msg: string          // 响应消息
  data: any            // 响应数据
}
