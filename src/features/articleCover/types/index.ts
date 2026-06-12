// ============================================================
// 封面生成相关类型（纯类型定义，不含运行时逻辑）
// ============================================================

export interface CoverSizePreset {
  label: string
  width: number
  height: number
}

export interface CoverStylePreset {
  id: string
  label: string
  description: string
}

export type CoverGenerationStatus = "idle" | "generating" | "done" | "error"

export interface CoverGenerationConfig {
  title: string
  category: string
  keywords: string
  watermark: string
  width: number
  height: number
  styleId: string
}
