/**
 * AI 内容生成器类型定义与共享常量
 */
import type { IssueSeverity, ReviewRating, SkillItem } from "@/types/ai"

/**
 * 技能扫描原始条目（skillsViewer scanSkills 返回类型的本地投影，避免跨功能导入）
 * 注意：skillsViewer 的 SkillInfo 含 fileSize 字段，此处按需投影；
 * 若未来消费方需要该字段，需同步补充（保持与 SkillInfo 结构兼容）。
 */
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

/** 审核评级全枚举（validateRating 校验与审核 prompt 输出格式共用，消除多处硬编码） */
export const RATING_VALUES: readonly ReviewRating[] = ["优秀", "良好", "需改进"]

/** 问题严重程度级别列表（供 ReviewPanel 过滤选项与计数遍历，与 @/types/ai IssueSeverity 对应） */
export const SEVERITY_LEVELS: readonly IssueSeverity[] = ["高", "中", "低"]

/** AI 快捷编辑动作元数据（BottomInputArea 快捷按钮与 index.vue 动作执行/审核共用单一数据源） */
export interface EditActionMeta {
  /** 快捷按钮文案 */
  label: string
  /** 思源内置图标 symbol id（含 # 前缀） */
  icon: string
  /** 发送给 AI 的编辑指令 */
  prompt: string
  /** 审核阶段理解"用户需求"的指令描述 */
  reviewLabel: string
}

/** 六个快捷编辑动作的完整元数据表（键顺序即按钮展示顺序） */
export const ACTION_META: Record<EditActionKey, EditActionMeta> = {
  polish: {
    label: "润色",
    icon: "#iconEdit",
    prompt: "请对以下文档进行润色优化，保持原有结构，提升语言质量和可读性，使表达更加专业、流畅。保持Markdown格式，直接输出优化后的完整文档内容：",
    reviewLabel: "对文档进行润色优化",
  },
  expand: {
    label: "扩写",
    icon: "#iconAdd",
    prompt: "请对以下文档进行扩写，增加更详细的说明、例子和补充信息，使内容更加丰富和全面。保持Markdown格式，直接输出扩写后的完整文档内容：",
    reviewLabel: "对文档进行扩写",
  },
  condense: {
    label: "精简",
    icon: "#iconMin",
    prompt: "请对以下文档进行精简，去除冗余内容，保留核心要点，使表达更加简洁有力。保持Markdown格式，直接输出精简后的完整文档内容：",
    reviewLabel: "对文档进行精简",
  },
  fix: {
    label: "纠错",
    icon: "#iconCheck",
    prompt: "请对以下文档进行错误检查和修正，包括拼写错误、语法错误、逻辑错误等。保持Markdown格式，直接输出修正后的完整文档内容：",
    reviewLabel: "对文档进行错误修正",
  },
  rewrite: {
    label: "改写",
    icon: "#iconRefresh",
    prompt: "请用不同的表达方式重写以下文档，保持核心意思不变，但使用全新的语言风格和句式结构。保持Markdown格式，直接输出改写后的完整文档内容：",
    reviewLabel: "对文档进行改写",
  },
  summary: {
    label: "总结",
    icon: "#iconList",
    prompt: "请为以下文档生成一个简洁的总结，包括主要内容和关键要点。总结应该清晰明了，突出文档的核心信息。保持Markdown格式，直接输出总结内容：",
    reviewLabel: "为文档生成总结",
  },
}

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
