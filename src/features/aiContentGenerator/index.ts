/**
 * AI内容生成功能模块（含 skills/ 子模块：技能管理弹窗与扫描）
 */
import type { Plugin } from "siyuan"
import { AIContentGenerator } from "./modules/AIContentGenerator"
import { registerSkillsManager } from "./skills"

export function registerAIContentGenerator(plugin: Plugin) {
  registerSkillsManager(plugin)
  const generator = new AIContentGenerator(plugin)
  generator.init()
  return generator
}
