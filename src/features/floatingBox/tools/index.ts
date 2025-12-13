/**
 * 工具统一导出
 */
export { timestampTool } from './timestamp'

// 导出所有工具数组
import { timestampTool } from './timestamp'
import type { FloatingTool } from '../types'

export const allTools: FloatingTool[] = [
  timestampTool,
]
