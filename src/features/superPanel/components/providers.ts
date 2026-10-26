/**
 * AI 供应商常量（单一数据源）
 *
 * ProviderMeta/PROVIDERS/PROVIDER_MAP 等 superPanel 特有元数据
 * 模型清单来自项目级共享配置 @/config/aiModels
 */
import type { ProviderModels } from "@/config/aiModels"
import { PROVIDER_MODELS } from "@/config/aiModels"


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

/**
 * 供应商元数据列表（有序）
 * defaultModel 派生自 aiModels 清单 common 首项（推荐模型），避免双源硬编码漂移
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    id: "tongyi",
    i18nKey: "tongyiQianwen",
    fallbackName: "通义千问",
    defaultModel: PROVIDER_MODELS.tongyi.common[0]?.value ?? "",
    models: PROVIDER_MODELS.tongyi,
  },
  {
    id: "deepseek",
    i18nKey: "deepSeek",
    fallbackName: "DeepSeek",
    defaultModel: PROVIDER_MODELS.deepseek.common[0]?.value ?? "",
    models: PROVIDER_MODELS.deepseek,
  },
  {
    id: "xiaomi",
    i18nKey: "xiaomiMiMo",
    fallbackName: "小米MiMo",
    defaultModel: PROVIDER_MODELS.xiaomi.common[0]?.value ?? "",
    models: PROVIDER_MODELS.xiaomi,
  },
  {
    id: "custom",
    i18nKey: "customApi",
    fallbackName: "自定义API",
    defaultModel: PROVIDER_MODELS.custom.common[0]?.value ?? "",
    models: PROVIDER_MODELS.custom,
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
