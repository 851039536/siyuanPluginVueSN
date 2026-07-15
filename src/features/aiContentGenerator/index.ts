/**
 * AI内容生成功能模块
 */
import { Plugin } from "siyuan"
import { AIContentGenerator } from "./modules/AIContentGenerator"

export function registerAIContentGenerator(
  plugin: Plugin,
  options?: { scanSkills?: (projectPath?: string) => Promise<Array<{
    filePath: string; name: string; description: string; content: string; tool: string
  }>> },
) {
  const generator = new AIContentGenerator(plugin, options as any)
  generator.init();

  (plugin as any).__aiContentGenerator = generator

  return generator
}

