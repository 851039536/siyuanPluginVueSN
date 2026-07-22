/**
 * AI 内容生成器类型定义
 */
import type { SkillItem } from "@/types/ai"

/** 技能扫描原始条目（skillsViewer scanSkills 返回类型的本地投影，避免跨功能导入） */
export interface SkillScanEntry {
  filePath: string
  name: string
  description: string
  content: string
  tool: string
}

/** 技能扫描函数签名 */
export type ScanSkillsFn = (projectPath?: string) => Promise<SkillScanEntry[]>

/** RawSkillEntry → SkillItem 转换 */
export function toSkillItem(entry: SkillScanEntry): SkillItem {
  return {
    id: entry.filePath,
    name: entry.name,
    description: entry.description,
    content: entry.content,
    tool: entry.tool,
    sources: [{
      id: entry.filePath,
      tool: entry.tool,
      content: entry.content,
    }],
  }
}
