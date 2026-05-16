/**
 * HTML展示功能类型定义
 */
import { ref } from "vue"

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
// 全局状态
// ============================================================

/**
 * 弹窗显示状态
 */
export const htmlViewerVisible = ref(false)

/**
 * 预览模式: 'preview' | 'source' | 'split'
 */
export const htmlViewerMode = ref<"preview" | "source" | "split">("preview")

/**
 * 右键菜单传入的HTML内容（临时）
 */
export const pendingHtmlContent = ref<string>("")

/**
 * 显示HTML展示弹窗
 */
export function showHtmlViewer() {
  htmlViewerVisible.value = true
}

/**
 * 隐藏HTML展示弹窗
 */
export function hideHtmlViewer() {
  htmlViewerVisible.value = false
}

/**
 * 切换HTML展示弹窗显示状态
 */
export function toggleHtmlViewer() {
  htmlViewerVisible.value = !htmlViewerVisible.value
}
