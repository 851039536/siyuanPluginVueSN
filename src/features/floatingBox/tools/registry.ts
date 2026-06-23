/**
 * 悬浮框工具注册表
 * 声明式配置每个工具的工厂、显示平台、条件、排序
 */

import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import {
  createFlashcardReadingTool,
  createPasswordVaultTool,
  createPromptsTool,
  createRefreshTool,
  createSuperPanelTool,
  createTextDiffTool,
} from "./index"

export interface ToolDefinition {
  id: string
  factory: (plugin: Plugin) => FloatingTool
  /** 在哪些平台显示 */
  platforms: ("desktop" | "mobile")[]
  /** 可选显示条件，返回 false 时隐藏 */
  condition?: (plugin: Plugin) => boolean
  /** 排序权重，越小越靠前 */
  order: number
}

/**
 * 工具注册表
 * 新增工具在此添加一条即可，无需修改 index.vue
 */
export const toolRegistry: ToolDefinition[] = [
  {
    id: "superPanel",
    factory: createSuperPanelTool,
    platforms: ["desktop", "mobile"],
    order: 10,
  },
  {
    id: "refresh",
    factory: createRefreshTool,
    platforms: ["desktop", "mobile"],
    order: 20,
  },
  {
    id: "textDiff",
    factory: createTextDiffTool,
    platforms: ["desktop"],
    order: 30,
  },
  {
    id: "prompts",
    factory: createPromptsTool,
    platforms: ["desktop"],
    condition: (plugin) => (plugin as any)?.settings?.enablePrompts !== false,
    order: 40,
  },
  {
    id: "flashcardReading",
    factory: createFlashcardReadingTool,
    platforms: ["mobile"],
    order: 50,
  },
  {
    id: "passwordVault",
    factory: createPasswordVaultTool,
    platforms: ["desktop", "mobile"],
    order: 60,
  },
]

/**
 * 根据平台和条件过滤工具列表，按 order 排序
 */
export function getToolsForPlatform(
  plugin: Plugin,
  isMobile: boolean,
): FloatingTool[] {
  const platform = isMobile ? "mobile" : "desktop"

  return toolRegistry
    .filter((def) => {
      if (!def.platforms.includes(platform)) return false
      if (def.condition && !def.condition(plugin)) return false
      return true
    })
    .sort((a, b) => a.order - b.order)
    .map((def) => def.factory(plugin))
}
