/**
 * Select 私有类型 —— 选项形态的单一数据源
 * 独立成 `.ts` 的原因：`.ts` 文件从 `.vue` 导入类型会触发 tsc 的 TS2614（tsc 不解析 .vue 导出），
 * 故选项类型必须放在纯 TS 文件里，才能被同目录的导航/工具模块共享而不复制粘贴。
 * 公开入口仍是 @/components/Select.vue（由其再导出选项类型），feature 不得深入本目录。
 */

/** 单个选项 */
export interface SelectOption {
  /** 选项值 */
  value: string | number | boolean
  /** 显示标签 */
  label: string
  /** 是否禁用 */
  disabled?: boolean
  /** 附加搜索关键词（filterable 时参与匹配，用于标签之外的别名/描述检索） */
  keywords?: string
  /** 自定义数据 */
  [key: string]: any
}

/** 分组选项 */
export interface SelectGroupOption {
  /** 分组标识 */
  isGroup: true
  /** 分组标签 */
  label: string
  /** 分组选项 */
  options: SelectOption[]
}

/** 选项集合的元素类型（普通项或分组项） */
export type OptionType = SelectOption | SelectGroupOption

/** 尺寸档位 */
export type SelectSize = "xsmall" | "small" | "medium" | "large"
