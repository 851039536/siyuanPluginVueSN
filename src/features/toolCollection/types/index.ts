/**
 * 工具合集 - 类型定义
 */
import type { Component } from "vue"

/** 工具 Tab 元数据 */
export interface ToolMeta {
  /** 工具唯一标识 */
  id: string
  /** 显示标签（回退文本） */
  label: string
  /** 图标（Iconify 格式） */
  icon: string
  /** 工具组件（可选，用于动态渲染） */
  component?: Component
}
