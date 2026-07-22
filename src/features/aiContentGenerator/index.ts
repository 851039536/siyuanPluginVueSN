/**
 * AI内容生成功能模块
 */
import type { Plugin } from "siyuan"
import { AIContentGenerator } from "./modules/AIContentGenerator"
import type { ScanSkillsFn } from "./types"

export function registerAIContentGenerator(plugin: Plugin, options?: { scanSkills?: ScanSkillsFn }) {
  const generator = new AIContentGenerator(plugin, options)
  generator.init()
  return generator
}

