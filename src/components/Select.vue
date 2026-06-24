<template>
  <div
    :class="selectClasses"
    v-bind="containerAttrs"
  >
    <FormField
      :label="label"
      :required="required"
      :hint="hint"
      :size="size"
    />
    <div
      ref="wrapperRef"
      class="si-select__wrapper"
    >
      <div
        class="si-select__trigger"
        :class="{ 'si-select__trigger--disabled': disabled }"
        :tabindex="disabled ? -1 : 0"
        @click="toggleDropdown"
        @keydown="handleKeydown"
      >
        <span
          v-if="selectedLabel"
          class="si-select__value"
        >{{ selectedLabel }}</span>
        <span
          v-else
          class="si-select__placeholder"
        >{{ placeholder }}</span>
        <span
          v-if="clearable && selectedOption && !disabled"
          class="si-select__clear"
          @click.stop="handleClear"
        >
          <IconWrapper
            :name="'x' as IconKey"
            :size="iconSize"
          />
        </span>
        <IconWrapper
          :name="(isOpen ? 'chevronUp' : 'chevronDown') as IconKey"
          :size="iconSize"
          class="si-select__arrow"
        />
      </div>

      <Transition name="si-select-dropdown">
        <div
          v-if="isOpen && !disabled"
          class="si-select__dropdown"
          :class="dropdownClasses"
          :style="dropdownStyle"
        >
          <div
            v-if="filterable && filteredOptions.length > 0"
            class="si-select__filter"
          >
            <input
              ref="filterInputRef"
              v-model="filterQuery"
              type="text"
              class="si-select__filter-input"
              :placeholder="filterPlaceholder"
              @click.stop
            />
          </div>

          <div
            v-if="filteredOptions.length === 0"
            class="si-select__empty"
          >
            {{ emptyText }}
          </div>

          <div
            v-else
            class="si-select__options"
            :class="{ 'si-select__options--grouped': hasGroups }"
          >
            <template
              v-for="(option, index) in filteredOptions"
              :key="getOptionKey(option, index)"
            >
              <!-- 分组选项 -->
              <div
                v-if="isGroupOption(option)"
                class="si-select__group"
              >
                <div class="si-select__group-label">
                  {{ option.label }}
                </div>
                <div
                  v-for="(groupOption, groupIndex) in option.options"
                  :key="getOptionKey(groupOption, groupIndex)"
                  class="si-select__option"
                  :class="{
                    'si-select__option--selected': isSelected(groupOption.value),
                    'si-select__option--disabled': groupOption.disabled,
                    'si-select__option--hovered': hoveredGroupKey === `${index}-${groupIndex}`,
                  }"
                  @click.stop="selectOption(groupOption)"
                  @mouseenter="setHoveredGroupOption(index, groupIndex)"
                >
                  <slot
                    name="option"
                    :option="groupOption"
                  >
                    {{ groupOption.label }}
                  </slot>
                </div>
              </div>

              <!-- 普通选项 -->
              <div
                v-else
                class="si-select__option"
                :class="{
                  'si-select__option--selected': isSelected(option.value),
                  'si-select__option--disabled': option.disabled,
                  'si-select__option--hovered': hoveredIndex === index,
                }"
                @click.stop="selectOption(option)"
                @mouseenter="setHoveredIndex(index)"
              >
                <slot
                  name="option"
                  :option="option"
                >
                  {{ option.label }}
                </slot>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useAttrs,
  watch,
} from "vue"
import FormField from "@/components/FormField.vue"
import IconWrapper from "@/components/IconWrapper.vue"

type SelectSize = "small" | "medium" | "large"

export interface SelectOption {
  /** 选项值 */
  value: string | number | boolean
  /** 显示标签 */
  label: string
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义数据 */
  [key: string]: any
}

export interface SelectGroupOption {
  /** 分组标识 */
  isGroup: true
  /** 分组标签 */
  label: string
  /** 分组选项 */
  options: SelectOption[]
}

type OptionType = SelectOption | SelectGroupOption

interface Props {
  /** 选项数据 */
  options: OptionType[]
  /** 绑定值 */
  modelValue?: string | number | boolean | null
  /** 占位文本 */
  placeholder?: string
  /** 禁用状态 */
  disabled?: boolean
  /** 尺寸 */
  size?: SelectSize
  /** 标签文本 */
  label?: string
  /** 是否必填 */
  required?: boolean
  /** 提示文本 */
  hint?: string
  /** 是否可筛选 */
  filterable?: boolean
  /** 筛选占位文本 */
  filterPlaceholder?: string
  /** 空状态文本 */
  emptyText?: string
  /** 下拉框位置 */
  placement?: "top" | "bottom" | "auto"
  /** 下拉框最大高度 */
  maxHeight?: string | number
  /** 图标大小 */
  iconSize?: number
  /** 是否可清除 */
  clearable?: boolean
}

interface Emits {
  (e: "update:modelValue", value: string | number | boolean | null): void
  (
    e: "change",
    value: string | number | boolean | null,
    option: SelectOption,
  ): void
  (e: "visible-change", visible: boolean): void
  (e: "clear"): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "请选择",
  disabled: false,
  size: "medium",
  required: false,
  filterable: false,
  filterPlaceholder: "搜索...",
  emptyText: "暂无数据",
  placement: "auto",
  maxHeight: 200,
  iconSize: 14,
  clearable: false,
})

const emit = defineEmits<Emits>()
const attrs = useAttrs()

const containerAttrs = computed(() => {
  const {
    class: className,
    style,
    ...rest
  } = attrs
  return rest
})

// 状态
const isOpen = ref(false)
const filterQuery = ref("")
const hoveredIndex = ref(-1)
const hoveredGroupKey = ref<string | null>(null)
const wrapperRef = ref<HTMLElement>()
const filterInputRef = ref<HTMLInputElement>()
const resolvedPlacement = ref<"top" | "bottom">("bottom")

// 类型守卫
const isGroupOption = (option: OptionType): option is SelectGroupOption =>
  (option as SelectGroupOption).isGroup === true

// 计算属性
const selectClasses = computed(() => [
  "si-select",
  `si-select--${props.size}`,
  {
    "si-select--disabled": props.disabled,
    "si-select--labeled": !!props.label,
  },
])

const dropdownClasses = computed(() => [
  `si-select__dropdown--${resolvedPlacement.value}`,
])

const dropdownStyle = computed(() => ({
  maxHeight: typeof props.maxHeight === "number" ? `${props.maxHeight}px` : props.maxHeight,
}))

const selectedOption = computed<SelectOption | null>(() => {
  if (props.modelValue === null || props.modelValue === undefined) {
    return null
  }

  const findOption = (options: OptionType[]): SelectOption | null => {
    for (const option of options) {
      if (isGroupOption(option)) {
        const found = option.options.find(
          (opt) => opt.value === props.modelValue,
        )
        if (found) return found
      } else if (option.value === props.modelValue) {
        return option
      }
    }
    return null
  }

  return findOption(props.options)
})

const selectedLabel = computed(() => selectedOption.value?.label || "")

const hasGroups = computed(() => props.options.some(isGroupOption))

const filteredOptions = computed(() => {
  if (!props.filterable || !filterQuery.value) {
    return props.options
  }

  const query = filterQuery.value.toLowerCase()

  const filterGroup = (group: SelectGroupOption): SelectGroupOption => ({
    ...group,
    options: group.options.filter((opt) =>
      opt.label.toLowerCase().includes(query),
    ),
  })

  const filterOption = (option: SelectOption): boolean =>
    option.label.toLowerCase().includes(query)

  return props.options.reduce<OptionType[]>((acc, option) => {
    if (isGroupOption(option)) {
      const filtered = filterGroup(option)
      if (filtered.options.length > 0) {
        acc.push(filtered)
      }
    } else if (filterOption(option)) {
      acc.push(option)
    }
    return acc
  }, [])
})

/** 展开所有分组，返回可导航的平铺选项列表 */
const flatNavigableOptions = computed<Array<{ option: SelectOption, groupIndex: number, optionIndex: number } | null>>(() => {
  const result: Array<{ option: SelectOption, groupIndex: number, optionIndex: number } | null> = []
  for (let i = 0; i < filteredOptions.value.length; i++) {
    const opt = filteredOptions.value[i]
    if (isGroupOption(opt)) {
      for (let j = 0; j < opt.options.length; j++) {
        result.push({
          option: opt.options[j],
          groupIndex: i,
          optionIndex: j,
        })
      }
    } else {
      result.push(null) // null 表示非分组占位，对应 hoveredIndex
    }
  }
  return result
})

const totalNavigableCount = computed(() =>
  flatNavigableOptions.value.filter(Boolean).length,
)

// 方法
const getOptionKey = (
  option: SelectOption | SelectGroupOption,
  index: number,
): string => {
  if (isGroupOption(option)) {
    return `group-${option.label}-${index}`
  }
  return `option-${option.value}-${index}`
}

const isSelected = (value: string | number | boolean) =>
  value === props.modelValue

const setHoveredIndex = (index: number) => {
  hoveredIndex.value = index
  hoveredGroupKey.value = null
}

const setHoveredGroupOption = (groupIndex: number, optionIndex: number) => {
  hoveredIndex.value = -1
  hoveredGroupKey.value = `${groupIndex}-${optionIndex}`
}

const selectOption = (option: SelectOption) => {
  if (option.disabled) return

  emit("update:modelValue", option.value)
  emit("change", option.value, option)
  closeDropdown()
}

const handleClear = () => {
  emit("update:modelValue", null)
  emit("clear")
  closeDropdown()
}

const toggleDropdown = () => {
  if (props.disabled) return

  if (isOpen.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

const openDropdown = () => {
  isOpen.value = true
  hoveredIndex.value = -1
  hoveredGroupKey.value = null
  filterQuery.value = ""
  emit("visible-change", true)

  nextTick(() => {
    resolvePlacement()
    if (props.filterable) {
      filterInputRef.value?.focus()
    }
  })
}

const closeDropdown = () => {
  isOpen.value = false
  emit("visible-change", false)
  filterQuery.value = ""
  hoveredIndex.value = -1
  hoveredGroupKey.value = null
}

const resolvePlacement = () => {
  if (props.placement !== "auto" || !wrapperRef.value) {
    resolvedPlacement.value = props.placement === "top" ? "top" : "bottom"
    return
  }

  const rect = wrapperRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  resolvedPlacement.value = spaceBelow >= spaceAbove ? "bottom" : "top"
}

/** 获取第 flatIndex 个可导航选项并执行回调 */
const navigateFlatOption = (flatIndex: number, callback: (opt: SelectOption) => void) => {
  const navigable = flatNavigableOptions.value.filter(Boolean)
  const item = navigable[flatIndex]
  if (item) {
    callback(item.option)
  }
}

/** 同步 hover 状态到当前 flatIndex */
const syncHoverState = (flatIndex: number) => {
  const navigable = flatNavigableOptions.value.filter(Boolean)
  const item = navigable[flatIndex]
  if (!item) return

  if (hasGroups.value) {
    hoveredIndex.value = -1
    hoveredGroupKey.value = `${item.groupIndex}-${item.optionIndex}`
  } else {
    hoveredIndex.value = flatIndex
    hoveredGroupKey.value = null
  }
}

/** 追踪当前可导航 flat 索引 */
const currentFlatHoverIndex = computed(() => {
  if (!hasGroups.value) return hoveredIndex.value

  const navigable = flatNavigableOptions.value.filter(Boolean)
  if (!hoveredGroupKey.value) return -1

  const [gi, oi] = hoveredGroupKey.value.split("-").map(Number)
  return navigable.findIndex(
    (item) => item && item.groupIndex === gi && item.optionIndex === oi,
  )
})

const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return

  switch (event.key) {
    case "Enter":
    case " ": {
      event.preventDefault()
      const idx = currentFlatHoverIndex.value
      if (isOpen.value && idx >= 0) {
        navigateFlatOption(idx, (opt) => {
          if (!opt.disabled) selectOption(opt)
        })
      } else {
        toggleDropdown()
      }
      break
    }
    case "Escape":
      event.preventDefault()
      closeDropdown()
      break
    case "ArrowDown":
      event.preventDefault()
      if (!isOpen.value) {
        openDropdown()
      } else {
        const next = Math.min(currentFlatHoverIndex.value + 1, totalNavigableCount.value - 1)
        syncHoverState(next)
      }
      break
    case "ArrowUp":
      event.preventDefault()
      if (isOpen.value) {
        const prev = Math.max(currentFlatHoverIndex.value - 1, 0)
        syncHoverState(prev)
      }
      break
    case "Tab":
      closeDropdown()
      break
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

// 监听
watch(
  () => props.modelValue,
  () => {
    filterQuery.value = ""
  },
)

// 生命周期
onMounted(() => {
  document.addEventListener("click", handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside)
})

// 暴露公共方法
defineExpose({
  focus: () => wrapperRef.value?.querySelector<HTMLDivElement>(".si-select__trigger")?.focus(),
  blur: () => wrapperRef.value?.querySelector<HTMLDivElement>(".si-select__trigger")?.blur(),
  open: openDropdown,
  close: closeDropdown,
})
</script>

<style scoped lang="scss">
@use './styles/Select.scss';
@use './styles/index.scss';
</style>
