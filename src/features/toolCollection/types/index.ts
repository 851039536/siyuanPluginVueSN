/**
 * 工具合集 - 类型定义
 * 
 * 定义可注册到工具合集中的工具元数据接口
 */

/** 工具定义接口 */
export interface ToolDefinition {
  /** 工具唯一标识 */
  id: string
  /** 显示标签（i18n key） */
  labelI18nKey: string
  /** 图标（Iconify 格式） */
  icon: string
}
