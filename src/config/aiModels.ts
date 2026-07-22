/**
 * AI 供应商模型清单（项目级单一数据源）
 * 供 superPanel 设置面板与 aiContentGenerator 模型选择器共用
 */
export interface ModelOption {
  value: string
  label: string
}

export interface ProviderModels {
  common: ModelOption[]
  all: ModelOption[]
}

export const PROVIDER_MODELS: Record<string, ProviderModels> = {
  tongyi: {
    common: [
      { value: "qwen-plus", label: "Qwen Plus (推荐)" },
      { value: "qwen-turbo", label: "Qwen Turbo (快速)" },
      { value: "qwen-max", label: "Qwen Max (最强)" },
    ],
    all: [
      { value: "qwen-long", label: "Qwen Long (长文本)" },
      { value: "qwen-vl-plus", label: "Qwen VL Plus (视觉)" },
      { value: "qwen-vl-max", label: "Qwen VL Max (视觉最强)" },
    ],
  },
  openai: {
    common: [
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (推荐)" },
      { value: "gpt-4", label: "GPT-4" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
    all: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    ],
  },
  deepseek: {
    common: [
      { value: "deepseek-v4-flash", label: "V4 Flash (快速)" },
      { value: "deepseek-v4-pro", label: "V4 Pro (最强)" },
    ],
    all: [
      { value: "deepseek-chat", label: "Chat (旧版，将停用)" },
      { value: "deepseek-reasoner", label: "Reasoner (旧版思考，将停用)" },
      { value: "deepseek-coder", label: "Coder (代码)" },
    ],
  },
  zhipu: {
    common: [
      { value: "glm-4-flash", label: "GLM-4-Flash (推荐)" },
      { value: "glm-4-air", label: "GLM-4-Air" },
      { value: "glm-4-plus", label: "GLM-4-Plus" },
    ],
    all: [
      { value: "glm-4-long", label: "GLM-4-Long (长文本)" },
      { value: "glm-4.5", label: "GLM-4.5" },
      { value: "glm-4.6", label: "GLM-4.6" },
    ],
  },
  xiaomi: {
    common: [
      { value: "mimo-v2-flash", label: "MiMo-V2-Flash (推荐)" },
    ],
    all: [
      { value: "mimo-v2-pro", label: "MiMo-V2-Pro" },
    ],
  },
  custom: {
    common: [],
    all: [],
  },
}
