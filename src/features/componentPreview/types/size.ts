/**
 * 组件预览 — 组件尺寸档位类型与常量（独立文件：无 vue/plugin 依赖，供 composable 安全引用，避免循环依赖）
 */

/** 组件尺寸档位（对应各组件 size prop 的档位值） */
export type ComponentSize = "xsmall" | "small" | "medium" | "large"

/** 尺寸档位切换项（单一数据源，供头部切换器渲染） */
export interface SizeOption {
  /** 档位值（直接透传给组件 size prop） */
  value: ComponentSize
  /** 按钮短标签（语言无关） */
  short: string
  /** 完整档位名的 i18n 键（tooltip 用） */
  labelKey: "sizeXsmall" | "sizeSmall" | "sizeMedium" | "sizeLarge"
}

/** 档位清单（顺序即展示顺序，small 与各组件 size prop 默认值一致） */
export const COMPONENT_SIZES: SizeOption[] = [
  { value: "xsmall", short: "XS", labelKey: "sizeXsmall" },
  { value: "small", short: "S", labelKey: "sizeSmall" },
  { value: "medium", short: "M", labelKey: "sizeMedium" },
  { value: "large", short: "L", labelKey: "sizeLarge" },
]

/** 默认尺寸档位（与各组件 size prop 默认值一致） */
export const DEFAULT_COMPONENT_SIZE: ComponentSize = "small"

/** 档位合法性校验（读取持久化值时使用） */
export function isComponentSize(value: unknown): value is ComponentSize {
  return COMPONENT_SIZES.some((item) => item.value === value)
}
