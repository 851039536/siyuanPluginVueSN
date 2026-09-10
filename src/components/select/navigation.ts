/**
 * Select 私有导航逻辑 —— 纯类型与纯函数（无 Vue 依赖）
 * 本目录为组件私有实现，禁止 feature 直接导入（公开入口仍是 @/components/Select.vue）。
 */
import type {
  OptionType,
  SelectGroupOption,
  SelectOption,
} from "./types"

/** 平铺项：数组下标 = 渲染顺序 = 导航顺序 = DOM 顺序 */
export interface FlatOptionItem {
  /** 选项本身 */
  option: SelectOption
  /** 所属分组下标；-1 表示非分组选项 */
  groupIndex: number
  /** 分组内下标；-1 表示非分组选项 */
  optionIndex: number
}

/** 打开面板时「无已选项」的落点策略（有已选项时一律优先定位已选项） */
export type AnchorFallback = "first" | "last"

/** 类型守卫：是否为分组项 */
export function isGroupOption(option: OptionType): option is SelectGroupOption {
  return option.isGroup === true
}

/** 按渲染顺序展开分组，产出与 DOM 一一对应的平铺数组（无 null 占位项） */
export function buildFlatItems(options: OptionType[]): FlatOptionItem[] {
  const items: FlatOptionItem[] = []

  options.forEach((option, groupIndex) => {
    if (isGroupOption(option)) {
      option.options.forEach((child, optionIndex) => {
        items.push({
          option: child,
          groupIndex,
          optionIndex,
        })
      })
      return
    }

    items.push({
      option,
      groupIndex: -1,
      optionIndex: -1,
    })
  })

  return items
}

/** 打开面板时的初始激活下标：优先已选项，退化为首/末项；无选项返回 -1 */
export function resolveAnchorIndex(
  items: FlatOptionItem[],
  isSelected: (option: SelectOption) => boolean,
  fallback: AnchorFallback = "first",
): number {
  if (items.length === 0) {
    return -1
  }

  const selectedIndex = items.findIndex((item) => isSelected(item.option))
  if (selectedIndex > -1) {
    return selectedIndex
  }

  return fallback === "last" ? items.length - 1 : 0
}
