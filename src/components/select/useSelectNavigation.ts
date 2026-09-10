/**
 * Select 私有导航与 ARIA 派生 —— 平铺下标状态、激活项 id、选项元素注册与滚动定位
 * 导航状态单一来源：`activeIndex` 同时驱动高亮类与 `aria-activedescendant`。
 * 本目录为组件私有实现，禁止 feature 直接导入（公开入口仍是 @/components/Select.vue）。
 */
import type {
  AnchorFallback,
  FlatOptionItem,
} from "./navigation"
import type {
  OptionType,
  SelectOption,
} from "./types"
import {
  computed,
  nextTick,
  ref,
  useId,
} from "vue"
import {
  buildFlatItems,
  resolveAnchorIndex,
} from "./navigation"

interface UseSelectNavigationOptions {
  /** 当前可见（已筛选）的选项集合，须为响应式 getter */
  visibleOptions: () => OptionType[]
  /** 判断选项是否为当前选中项（打开面板时定位用） */
  isSelected: (option: SelectOption) => boolean
}

/**
 * 滚动沿用 Listbox 的「选项元素数组 + scrollIntoView({ block: "nearest" })」方案，
 * 不引入全局 DOM 查询，也不会带动外层页面滚动。
 */
export function useSelectNavigation(options: UseSelectNavigationOptions) {
  const uid = useId()
  /** 下拉列表容器 id（combobox 的 aria-controls 指向它） */
  const listId = `${uid}-list`
  /** 可见标签元素 id（由 FormField 打在 label 上，供 aria-labelledby 关联） */
  const labelId = `${uid}-label`

  /** 选项 id；非法负下标返回 undefined，使属性整体不渲染 */
  const optionId = (domIndex: number) => (domIndex > -1 ? `${uid}-opt-${domIndex}` : undefined)
  /** 分组 id */
  const groupId = (groupIndex: number) => `${uid}-group-${groupIndex}`

  const flatItems = computed<FlatOptionItem[]>(() => buildFlatItems(options.visibleOptions()))

  /** 选项对象 → 平铺下标（模板渲染是嵌套的，需据此打 id 与判定高亮） */
  const domIndexMap = computed(() => {
    const map = new WeakMap<SelectOption, number>()
    flatItems.value.forEach((item, index) => map.set(item.option, index))
    return map
  })

  const domIndex = (option: SelectOption) => domIndexMap.value.get(option) ?? -1

  const activeIndex = ref(-1)
  const optionEls = ref<(HTMLElement | null)[]>([])

  const activeDescendantId = computed(() => optionId(activeIndex.value))

  /** 高亮判定（模板逐项调用，读取的是响应式 activeIndex） */
  const isActive = (option: SelectOption) => domIndex(option) === activeIndex.value

  /** 选项元素注册（:ref 回调） */
  const setOptionRef = (el: unknown, index: number) => {
    if (index < 0) {
      return
    }
    optionEls.value[index] = (el as HTMLElement | null) ?? null
  }

  const scrollActiveIntoView = () => {
    if (activeIndex.value < 0) {
      return
    }
    nextTick(() => {
      optionEls.value[activeIndex.value]?.scrollIntoView({ block: "nearest" })
    })
  }

  /** 设置激活项（并滚动入视野） */
  const setActiveIndex = (index: number) => {
    activeIndex.value = index
    scrollActiveIntoView()
  }

  /** 按选项对象设置激活项（鼠标悬停用） */
  const setActiveByOption = (option: SelectOption) => {
    const index = domIndex(option)
    if (index > -1) {
      setActiveIndex(index)
    }
  }

  /** 面板打开时的落点（优先已选项，其次按 fallback 取首/末项） */
  const anchorIndex = (fallback: AnchorFallback = "first") =>
    resolveAnchorIndex(flatItems.value, options.isSelected, fallback)

  return {
    listId,
    labelId,
    optionId,
    groupId,
    flatItems,
    activeIndex,
    activeDescendantId,
    domIndex,
    isActive,
    setActiveIndex,
    setActiveByOption,
    setOptionRef,
    scrollActiveIntoView,
    anchorIndex,
  }
}
