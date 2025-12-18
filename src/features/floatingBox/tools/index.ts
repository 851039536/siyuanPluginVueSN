/**
 * 工具统一导出
 */
export { superPanelTool } from './superPanel'
export { timestampTool } from './timestamp'
export { refreshTool } from './refresh'
export { skillsTool } from './skills'
export { textDiffTool } from './textDiff'

// 导出所有工具数组
import { superPanelTool } from './superPanel'
import { timestampTool } from './timestamp'
import { refreshTool } from './refresh'
import { skillsTool } from './skills'
import { textDiffTool } from './textDiff'
import type { FloatingTool } from '../types'

export const allTools: FloatingTool[] = [
  superPanelTool,
  timestampTool,
  refreshTool,
  textDiffTool,
  skillsTool,
]
