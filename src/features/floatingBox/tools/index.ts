/**
 * 工具统一导出
 */
export { superPanelTool } from './superPanel'
export { timestampTool } from './timestamp'

// 导出所有工具数组
import { superPanelTool } from './superPanel'
import { timestampTool } from './timestamp'
import type { FloatingTool } from '../types'

export const allTools: FloatingTool[] = [
  superPanelTool,
  timestampTool,
]
