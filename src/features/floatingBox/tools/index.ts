/**
 * 工具统一导出
 */
export { superPanelTool, createSuperPanelTool } from './superPanel'
export { refreshTool, createRefreshTool } from './refresh'
export { createSkillsTool, skillsTool } from './skills'
export { textDiffTool, createTextDiffTool } from './textDiff'
export { passwordVaultTool, createPasswordVaultTool } from './passwordVault'
export { flashcardReadingTool, createFlashcardReadingTool } from './flashcardReading'

// 导出所有工具数组（不包含需要 plugin 参数的工具）
import { superPanelTool } from './superPanel'
import { refreshTool } from './refresh'
import { textDiffTool } from './textDiff'
import type { FloatingTool } from '../types'

export const allTools: FloatingTool[] = [
  superPanelTool,
  refreshTool,
  textDiffTool,
]
