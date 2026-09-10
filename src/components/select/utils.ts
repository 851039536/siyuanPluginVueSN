/**
 * Select 私有纯工具 —— 选项匹配 / 筛选 / 选中查找 / 键值派生（无 Vue 依赖）
 * 本目录为组件私有实现，禁止 feature 直接导入（公开入口仍是 @/components/Select.vue）。
 */
import type {
  OptionType,
  SelectOption,
} from "./types"
import { isGroupOption } from "./navigation"

/** 筛选匹配：标签 + 可选 keywords（别名/描述等附加检索词） */
export function matchSelectOption(option: SelectOption, lowerQuery: string): boolean {
  return option.label.toLowerCase().includes(lowerQuery)
    || (typeof option.keywords === "string" && option.keywords.toLowerCase().includes(lowerQuery))
}

/**
 * 按渲染顺序过滤选项（单遍 reduce，不产生中间数组）。
 * 分组内无匹配项时整组丢弃，避免留下空分组标题。
 */
export function filterOptionList(options: OptionType[], lowerQuery: string): OptionType[] {
  if (!lowerQuery) {
    return options
  }

  return options.reduce<OptionType[]>((acc, option) => {
    if (isGroupOption(option)) {
      const children = option.options.filter((child) => matchSelectOption(child, lowerQuery))
      if (children.length > 0) {
        acc.push({
          ...option,
          options: children,
        })
      }
    } else if (matchSelectOption(option, lowerQuery)) {
      acc.push(option)
    }
    return acc
  }, [])
}

/** 在（可能分组的）选项集合中查找当前选中项 */
export function findSelectedOption(
  options: OptionType[],
  modelValue: string | number | boolean | null | undefined,
): SelectOption | null {
  if (modelValue === null || modelValue === undefined) {
    return null
  }

  for (const option of options) {
    if (isGroupOption(option)) {
      const found = option.options.find((child) => child.value === modelValue)
      if (found) {
        return found
      }
    } else if (option.value === modelValue) {
      return option
    }
  }

  return null
}

/** 是否包含分组（分组时列表容器需要额外内边距） */
export function hasGroupOption(options: OptionType[]): boolean {
  return options.some((option) => isGroupOption(option))
}

/** 稳定的 v-for key：分组按标签 + 下标，普通项按值 + 下标 */
export function resolveOptionKey(option: OptionType, index: number): string {
  return isGroupOption(option)
    ? `group-${option.label}-${index}`
    : `option-${option.value}-${index}`
}
