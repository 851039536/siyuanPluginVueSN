/**
 * HTML展示功能类型定义
 */

// ============================================================
// 类型定义
// ============================================================

/**
 * HTML片段条目
 */
export interface HtmlSnippet {
  /** 唯一标识 */
  id: string
  /** 名称/标题 */
  name: string
  /** 分类标签 */
  category: string
  /** HTML内容 */
  content: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/**
 * HTML片段分类
 */
export interface HtmlCategory {
  /** 分类ID */
  id: string
  /** 分类名称 */
  name: string
  /** 分类颜色 */
  color: string
}

// ============================================================
// AI 封面生成相关类型
// ============================================================

/** 封面尺寸预设 */
export interface CoverSizePreset {
  label: string
  width: number
  height: number
}

/** 封面风格预设 */
export interface CoverStylePreset {
  id: string
  label: string
  description: string
}

/** 封面生成状态 */
export type CoverGenerationStatus = "idle" | "generating" | "done" | "error"

/** 封面生成配置 */
export interface CoverGenerationConfig {
  /** 文档标题 */
  title: string
  /** 标题右侧分类挂饰 */
  category: string
  /** 关键字（空格分隔） */
  keywords: string
  /** 左下角水印文字 */
  watermark: string
  /** 封面宽度 */
  width: number
  /** 封面高度 */
  height: number
  /** 风格ID */
  styleId: string
}
