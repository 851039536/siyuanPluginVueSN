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
