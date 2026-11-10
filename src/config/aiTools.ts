/**
 * AI 工具元数据（顶层共享配置层，单一数据源）
 * skills 扫描/复制路径（aiContentGenerator/skills 子模块）与技能来源展示颜色均从此处派生。
 */
import type { IconKey } from "@/config/icons"
import type { SkillScope } from "@/types/ai"

/** AI 编程工具类型标识（与各工具 skills 目录约定一一对应；siyuan 为思源内置 Agent 技能目录） */
export type AIToolType
  = | "claude"
    | "codebuddy"
    | "qoder"
    | "trae"
    | "opencode"
    | "codex"
    | "cursor"
    | "gemini"
    | "copilot"
    | "siyuan"

/** AI 编程工具完整配置：展示元信息 + 全局/项目级/思源工作区 skills 路径 */
export interface AIToolConfig {
  id: AIToolType
  name: string
  icon: IconKey
  color: string
  /** 全局（用户目录下）skills 相对路径列表 */
  skillPaths: string[]
  /** 项目级 skills 相对路径列表 */
  projectPaths: string[]
  /** 思源工作区（workspaceDir 下）skills 相对路径列表（与项目路径输入无关，始终扫描） */
  workspacePaths?: string[]
}

/** 技能来源作用域（类型真源在 @/types/ai，此处别名供配置层使用） */
export type AISkillScope = SkillScope

/** 单个可开关的技能来源路径（由 AI_TOOLS 派生，id 为持久化标识，勿手工拼接） */
export interface AISkillSource {
  /** 稳定 id：`<toolId>:<scope>:<相对路径>` */
  id: string
  toolId: AIToolType
  scope: AISkillScope
  /** 相对基准目录的路径（global → 用户目录 / project → 项目根 / workspace → 思源工作区） */
  relPath: string
}

/** 拼接技能来源稳定 id（tool/scope/相对路径任一变化即视为新来源，旧持久化记录自动失效） */
export function skillSourceId(toolId: AIToolType, scope: AISkillScope, relPath: string): string {
  return `${toolId}:${scope}:${relPath}`
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
  {
    id: "codex",
    name: "Codex",
    icon: "codexTool",
    color: "#10A37F",
    skillPaths: [".codex/skills"],
    projectPaths: [".codex/skills"],
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "cursorTool",
    color: "#E8A33D",
    skillPaths: [".cursor/skills"],
    projectPaths: [".cursor/skills"],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    icon: "geminiTool",
    color: "#7B61FF",
    skillPaths: [".gemini/skills"],
    projectPaths: [".gemini/skills"],
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    icon: "copilotTool",
    color: "#9CA3AF",
    skillPaths: [".copilot/skills"],
    projectPaths: [".github/skills"],
  },
  {
    id: "siyuan",
    name: "思源",
    icon: "ideaCatSiyuan",
    color: "#D5544C",
    skillPaths: [],
    projectPaths: [],
    workspacePaths: ["data/storage/ai/agent/skills"],
  },
]

/** 全部技能来源路径（按 AI_TOOLS 顺序展开；新增工具或路径自动纳入，无需另处登记） */
export const SKILL_SOURCES: readonly AISkillSource[] = AI_TOOLS.flatMap((tool) => {
  const groups: ReadonlyArray<readonly [AISkillScope, readonly string[]]> = [
    ["global", tool.skillPaths],
    ["project", tool.projectPaths],
    ["workspace", tool.workspacePaths ?? []],
  ]
  return groups.flatMap(([scope, paths]) =>
    paths.map((relPath) => ({
      id: skillSourceId(tool.id, scope, relPath),
      toolId: tool.id,
      scope,
      relPath,
    })),
  )
})

/** 技能来源 id 集合（用于校验持久化数据里已下线/改名的路径） */
const SKILL_SOURCE_ID_SET: ReadonlySet<string> = new Set(SKILL_SOURCES.map((s) => s.id))

/** 是否为当前版本仍存在的技能来源 id */
export function isKnownSkillSourceId(id: string): boolean {
  return SKILL_SOURCE_ID_SET.has(id)
}

/** AI 工具最小展示元信息（仅 id/name/color，供展示类消费方使用） */
export interface AIToolMeta {
  id: string
  name: string
  color: string
}

/** 从完整配置派生的最小投影，避免多处维护 id/name/color 造成漂移 */
export const AI_TOOL_META: AIToolMeta[] = AI_TOOLS.map(({ id, name, color }) => ({ id, name, color }))

/** 按 id 查询工具配置（工具色/名等展示信息的统一取值口，替代各处自建 Map） */
export function getAITool(id: string): AIToolConfig | undefined {
  return AI_TOOLS.find((t) => t.id === id)
}
