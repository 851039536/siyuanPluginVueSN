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

/** DeepSeek V4 系列模型名前缀（思考模式开关等前缀判断依赖） */
export const DEEPSEEK_V4_MODEL_PREFIX = "deepseek-v4-"

/** DeepSeek V4 Pro（审核等需要最强模型的场景默认使用） */
export const DEEPSEEK_V4_PRO = "deepseek-v4-pro"

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
      { value: DEEPSEEK_V4_PRO, label: "V4 Pro (最强)" },
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
