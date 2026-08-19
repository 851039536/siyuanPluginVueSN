/**
 * AI 工具元数据（顶层共享配置层）
 * 供 aiContentGenerator 技能来源展示使用。
 *
 * 注意：skillsViewer 功能内部也有独立的 AI_TOOLS 配置（含图标/路径等扩展字段），
 * 按项目"零跨 Feature 直接导入"规则不在此处反向引用；若两处工具清单出现漂移，
 * 以 skillsViewer 的 AI_TOOLS 为准，此处仅维护展示所需的最小字段。
 */
export interface AIToolMeta {
  id: string
  name: string
  color: string
}

export const AI_TOOL_META: AIToolMeta[] = [
  {
    id: "claude",
    name: "Claude",
    color: "#D97757",
  },
  {
    id: "codebuddy",
    name: "CodeBuddy",
    color: "#4A90D9",
  },
  {
    id: "qoder",
    name: "Qoder",
    color: "#9B59B6",
  },
  {
    id: "trae",
    name: "Trae",
    color: "#27AE60",
  },
  {
    id: "opencode",
    name: "Opencode",
    color: "#00ACC1",
  },
]
