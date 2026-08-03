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
  deepseek: {
    common: [
      { value: "deepseek-v4-flash", label: "V4 Flash (快速)" },
      { value: "deepseek-v4-pro", label: "V4 Pro (最强)" },
    ],
    all: [],
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
