/**
 * AI 工具元数据（顶层共享配置层，单一数据源）
 * skillsViewer 的扫描/复制路径与 aiContentGenerator 的展示颜色均从此处派生。
 */
import type { IconKey } from "@/config/icons"

/** AI 编程工具类型标识（与各工具 skills 目录约定一一对应） */
export type AIToolType = "claude" | "codebuddy" | "qoder" | "trae" | "opencode"

/** AI 编程工具完整配置：展示元信息 + 全局/项目级 skills 路径 */
export interface AIToolConfig {
  id: AIToolType
  name: string
  icon: IconKey
  color: string
  /** 全局（用户目录下）skills 相对路径列表 */
  skillPaths: string[]
  /** 项目级 skills 相对路径列表 */
  projectPaths: string[]
}

/** 全部 AI 编程工具配置（新增工具时在此处登记） */
export const AI_TOOLS: AIToolConfig[] = [
  {
    id: "claude",
    name: "Claude",
    icon: "claudeTool",
    color: "#D97757",
    skillPaths: [".claude/skills"],
    projectPaths: [".claude/skills"],
  },
  {
    id: "codebuddy",
    name: "CodeBuddy",
    icon: "codeBraces",
    color: "#4A90D9",
    skillPaths: [".codebuddy/skills"],
    projectPaths: [".codebuddy/skills"],
  },
  {
    id: "qoder",
    name: "Qoder",
    icon: "qoderTool",
    color: "#9B59B6",
    skillPaths: [".qoder/skills"],
    projectPaths: [".qoder/skills"],
  },
  {
    id: "trae",
    name: "Trae",
    icon: "traeTool",
    color: "#27AE60",
    skillPaths: [".trae/skills"],
    projectPaths: [".trae/skills"],
  },
  {
    id: "opencode",
    name: "Opencode",
    icon: "opencodeTool",
    color: "#00ACC1",
    skillPaths: [".config/opencode/skills", ".agents/skills"],
    projectPaths: [".opencode/skills"],
  },
]

/** AI 工具最小展示元信息（仅 id/name/color，供展示类消费方使用） */
export interface AIToolMeta {
  id: string
  name: string
  color: string
}

/** 从完整配置派生的最小投影，避免多处维护 id/name/color 造成漂移 */
export const AI_TOOL_META: AIToolMeta[] = AI_TOOLS.map(({ id, name, color }) => ({ id, name, color }))
