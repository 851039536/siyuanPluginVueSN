/**
 * AI 供应商常量（单一数据源）
 *
 * 消除 AiProviderSelect / AiSettingsPanel / ApiKeyInput / AiModelSelect 间的重复定义
 */

export interface ModelOption {
  value: string
  label: string
}

export interface ProviderModels {
  common: ModelOption[]
  all: ModelOption[]
}

export interface ProviderMeta {
  id: string
  /** i18n 键名（在 i18n.superPanel 下） */
  i18nKey: string
  /** 中文回退显示名 */
  fallbackName: string
  /** 推荐模型（common 列表第一项） */
  defaultModel: string
  /** 模型配置 */
  models: ProviderModels
}

const tongyiModels: ProviderModels = {
  common: [
    {
      value: "qwen-plus",
      label: "Qwen Plus (推荐)",
    },
    {
      value: "qwen-turbo",
      label: "Qwen Turbo (快速)",
    },
    {
      value: "qwen-max",
      label: "Qwen Max (最强)",
    },
  ],
  all: [
    {
      value: "qwen-long",
      label: "Qwen Long (长文本)",
    },
    {
      value: "qwen-vl-plus",
      label: "Qwen VL Plus (视觉)",
    },
    {
      value: "qwen-vl-max",
      label: "Qwen VL Max (视觉最强)",
    },
  ],
}

const openaiModels: ProviderModels = {
  common: [
    {
      value: "gpt-3.5-turbo",
      label: "GPT-3.5 Turbo (推荐)",
    },
    {
      value: "gpt-4",
      label: "GPT-4",
    },
    {
      value: "gpt-4-turbo",
      label: "GPT-4 Turbo",
    },
  ],
  all: [
    {
      value: "gpt-4o",
      label: "GPT-4o",
    },
    {
      value: "gpt-4o-mini",
      label: "GPT-4o Mini",
    },
  ],
}

const deepseekModels: ProviderModels = {
  common: [
    {
      value: "deepseek-v4-flash",
      label: "V4 Flash (快速)",
    },
    {
      value: "deepseek-v4-pro",
      label: "V4 Pro (最强)",
    },
  ],
  all: [
    {
      value: "deepseek-chat",
      label: "Chat (旧版，将停用)",
    },
    {
      value: "deepseek-reasoner",
      label: "Reasoner (旧版思考，将停用)",
    },
    {
      value: "deepseek-coder",
      label: "Coder (代码)",
    },
  ],
}

const zhipuModels: ProviderModels = {
  common: [
    {
      value: "glm-4-flash",
      label: "GLM-4-Flash (推荐)",
    },
    {
      value: "glm-4-air",
      label: "GLM-4-Air",
    },
    {
      value: "glm-4-plus",
      label: "GLM-4-Plus",
    },
  ],
  all: [
    {
      value: "glm-4-long",
      label: "GLM-4-Long (长文本)",
    },
    {
      value: "glm-4.5",
      label: "GLM-4.5",
    },
    {
      value: "glm-4.6",
      label: "GLM-4.6",
    },
  ],
}

const xiaomiModels: ProviderModels = {
  common: [
    {
      value: "mimo-v2-flash",
      label: "MiMo-V2-Flash (推荐)",
    },
  ],
  all: [
    {
      value: "mimo-v2-pro",
      label: "MiMo-V2-Pro",
    },
  ],
}

const customModels: ProviderModels = {
  common: [],
  all: [],
}

/**
 * 供应商元数据列表（有序）
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: "tongyi",
    i18nKey: "tongyiQianwen",
    fallbackName: "通义千问",
    defaultModel: "qwen-plus",
    models: tongyiModels,
  },
  {
    id: "openai",
    i18nKey: "openAI",
    fallbackName: "OpenAI",
    defaultModel: "gpt-3.5-turbo",
    models: openaiModels,
  },
  {
    id: "deepseek",
    i18nKey: "deepSeek",
    fallbackName: "DeepSeek",
    defaultModel: "deepseek-v4-flash",
    models: deepseekModels,
  },
  {
    id: "zhipu",
    i18nKey: "zhipuAI",
    fallbackName: "智谱AI",
    defaultModel: "glm-4-flash",
    models: zhipuModels,
  },
  {
    id: "xiaomi",
    i18nKey: "xiaomiMiMo",
    fallbackName: "小米MiMo",
    defaultModel: "mimo-v2-flash",
    models: xiaomiModels,
  },
  {
    id: "custom",
    i18nKey: "customApi",
    fallbackName: "自定义API",
    defaultModel: "",
    models: customModels,
  },
]

/**
 * 供应商 ID → 元数据映射
 */
export const PROVIDER_MAP: Record<string, ProviderMeta> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
)

/**
 * 获取供应商默认模型
 */
export function getDefaultModel(providerId: string): string {
  return PROVIDER_MAP[providerId]?.defaultModel ?? ""
}

/**
 * 获取供应商显示名称（i18n 优先，回退中文）
 */
export function getProviderDisplayName(providerId: string, i18n: Record<string, any>): string {
  const meta = PROVIDER_MAP[providerId]
  if (!meta) return providerId
  return i18n[meta.i18nKey] || meta.fallbackName
}
