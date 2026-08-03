/**
 * AI 内容生成器类型定义与共享常量
 */
import type { IssueSeverity, ReviewRating, SkillItem } from "@/types/ai"

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

/** AI 快捷编辑动作类型（BottomInputArea 快捷操作键 / index.vue aiEditAction 共用） */
export type EditActionKey = "polish" | "expand" | "condense" | "fix" | "rewrite" | "summary"

/** 审核评级：需改进（与 @/types/ai ReviewRating 对应，消除两处硬编码） */
export const RATING_NEEDS_FIX: ReviewRating = "需改进"

/** 问题严重程度级别列表（供 ReviewPanel 过滤选项与计数遍历，与 @/types/ai IssueSeverity 对应） */
export const SEVERITY_LEVELS: readonly IssueSeverity[] = ["高", "中", "低"]

/** 默认系统提示词（文档编辑助手系列，统一"直接输出完整文档 + 无解释性文字"模板，消除 4 处相似文案） */
export const DEFAULT_SYSTEM_PROMPTS = {
  /** 通用优化（快捷操作 polish / 无技能自定义编辑兜底共用） */
  polish: "你是一个专业的文档编辑助手，擅长优化Markdown文档。请直接输出优化后的完整文档，不要添加任何解释性文字。",
  /** 按用户指令编辑 */
  editByInstruction: "你是一个专业的文档编辑助手，擅长根据用户指令优化Markdown文档。请直接输出编辑后的完整文档，不要添加任何解释性文字。",
  /** 按审核反馈自动修正 */
  fixByReview: "你是一个专业的文档编辑助手，擅长根据审核反馈修正Markdown文档。请直接输出修正后的完整文档，不要添加任何解释性文字。",
  /** 定向修复单个问题 */
  fixIssue: "你是一个专业的文档编辑助手。请根据描述的问题定向修改，仅修正相关问题部分，保持其他内容不变。直接输出修改后的完整文档。",
} as const

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
