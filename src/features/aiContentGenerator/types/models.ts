/**
 * AI 模型选择器共享类型与配置（aiContentGenerator feature 内部共用）
 */
export interface ModelOption {
  value: string
  label: string
}

export interface ProviderModels {
  common: ModelOption[]
  all: ModelOption[]
}

export const AI_MODELS_CONFIG: Record<string, ProviderModels> = {
  tongyi: {
    common: [
      { value: "qwen-turbo", label: "Qwen Turbo (快速)" },
      { value: "qwen-max", label: "Qwen Max (最强)" },
    ],
    all: [
      { value: "qwen-long", label: "Qwen Long (长文本)" },
    ],
  },
  openai: {
    common: [
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
      { value: "deepseek-chat", label: "Chat" },
      { value: "deepseek-reasoner", label: "Reasoner (思考)" },
      { value: "deepseek-coder", label: "Coder (代码)" },
    ],
  },
  custom: {
    common: [],
    all: [],
  },
}
