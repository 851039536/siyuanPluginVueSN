<!-- 内联列表选择：平铺选项列表，支持单选 / 多选、复选与勾选指示、内置筛选、四档尺寸与基础键盘（Tab / ↑↓ / Enter / Space / Home / End）。
     指示器为纯装饰 span：role="option" 内不得嵌套可交互元素（Checkbox 是 label + 原生 input，会双重语义并双触发），故此为唯一的复用例外。
     列表带 aria-activedescendant，容器持 tabindex；不做完整键盘矩阵（Shift/Ctrl 组合、字符定位）与虚拟滚动，也不做选项分组与字段映射。 -->
<template>
  <div :class="rootClasses">
    <FormField
      :label="label"
      :required="required"
      :hint="hint"
      :error="error"
      :size="size"
    >
      <div class="si-listbox__panel">
        <!-- 筛选区：复用共享 Input（内联形态无浮层约束，无需自建筛选输入） -->
        <div
          v-if="filter"
          class="si-listbox__filter"
        >
          <Input
            v-model="filterQuery"
            borderless
            clearable
            :size="size"
            prefix-icon="magnify"
            :placeholder="filterPlaceholder"
            :aria-label="filterPlaceholder"
          />
        </div>
        <!-- 选项列表 -->
        <div
          v-if="visibleOptions.length > 0"
          :id="listId"
          ref="listRef"
          class="si-listbox__list"
          :style="listStyle"
          role="listbox"
          :tabindex="disabled ? -1 : 0"
          :aria-multiselectable="multiple ? 'true' : undefined"
          :aria-label="resolvedAriaLabel"
          :aria-disabled="disabled ? 'true' : undefined"
          :aria-activedescendant="activeOptionId"
          @keydown="handleKeydown"
        >
          <div
            v-for="(option, index) in visibleOptions"
            :id="optionId(index)"
            :key="String(option.value)"
            :ref="(el) => setOptionRef(el, index)"
            class="si-listbox__option"
            :class="optionClasses(option, index)"
            role="option"
            :aria-selected="isSelected(option)"
            :aria-disabled="option.disabled ? 'true' : undefined"
            @click="handleOptionClick(option, index)"
          >
            <!-- 装饰性指示器：checkbox 常驻方框；checkmark 仅选中时显示勾选 -->
            <span
              v-if="checkbox || checkmark"
              class="si-listbox__check"
              aria-hidden="true"
            >
              <IconWrapper
                v-if="isSelected(option)"
                :name="'check' as IconKey"
                :size="checkIconSize"
              />
            </span>
            <span class="si-listbox__option-text">
              <slot
                name="option"
                :option="option"
                :selected="isSelected(option)"
              >{{ option.label }}</slot>
            </span>
          </div>
        </div>
        <!-- 空态：无数据与筛选无结果共用 -->
        <div
          v-else
          class="si-listbox__empty"
        >
          {{ emptyText }}
        </div>
      </div>
    </FormField>
  </div>
</template>

<script setup lang="ts">
import type { ComponentPublicInstance } from "vue"
import type { IconKey } from "./kit/icons"
import {
  computed,
  ref,
  useId,
  watch,
} from "vue"
import FormField from "./FormField.vue"
import IconWrapper from "./IconWrapper.vue"
import Input from "./Input.vue"
import type { SelectOption } from "./Select.vue"
import "./kit/theme"

type ListboxSize = "xsmall" | "small" | "medium" | "large"
/** 单选为单值、多选为数组、未选为 null */
type ListboxValue = SelectOption["value"] | SelectOption["value"][] | null

/** 各档位指示器方框边长（与字号阶梯 10/12/14/16 同步） */
const TIER_CHECK_SIZE: Record<ListboxSize, number> = {
  xsmall: 14,
  small: 16,
  medium: 18,
  large: 20,
}

interface Props {
  /** 单选为 value；多选（multiple 为真）为 value 数组 */
  modelValue?: ListboxValue
  /** 选项数据（扁平列表，不做分组与字段映射） */
  options: SelectOption[]
  /** 多选：modelValue 形态随之切换为数组 */
  multiple?: boolean
  /** 复选指示器：每项常驻方框（仅在 multiple 下生效） */
  checkbox?: boolean
  /** 勾选指示：选中才显示勾选图标（适合单选列表） */
  checkmark?: boolean
  /** 选中是否改变整行底色（默认 true；为 false 时选中态仅由指示器表达） */
  highlightOnSelect?: boolean
  /** 内置筛选框 */
  filter?: boolean
  /** 筛选框占位文案 */
  filterPlaceholder?: string
  /** 无数据或筛选无结果时的提示文案（两者共用） */
  emptyText?: string
  /** 尺寸档位 */
  size?: ListboxSize
  /** 整体禁用（不可点击、不可聚焦） */
  disabled?: boolean
  /** 校验失败文案（描红外框并展示，项目统一约定，等价 PrimeVue 的 invalid） */
  error?: string
  /** 行内标签文案 */
  label?: string
  /** 是否必填 */
  required?: boolean
  /** 辅助说明 */
  hint?: string
  /** 列表最大高度 */
  maxHeight?: string | number
  /** 无障碍名称（未传时回退到 label） */
  ariaLabel?: string
}

interface Emits {
  (e: "update:modelValue", value: ListboxValue): void
  (e: "change", value: ListboxValue, option: SelectOption | null): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  multiple: false,
  checkbox: false,
  checkmark: false,
  highlightOnSelect: true,
  filter: false,
  filterPlaceholder: "搜索...",
  emptyText: "暂无数据",
  size: "small",
  disabled: false,
  maxHeight: 200,
})

const emit = defineEmits<Emits>()

const uid = useId()
const listId = `${uid}-list`
const optionId = (index: number) => `${uid}-opt-${index}`

const listRef = ref<HTMLElement | null>(null)
const filterQuery = ref("")
const activeIndex = ref(-1)
/** 选项 DOM 引用（供键盘活动项滚动入视；刻意不做成响应式，避免额外渲染） */
const optionEls: (HTMLElement | null)[] = []

const rootClasses = computed(() => [
  "si-listbox",
  `si-listbox--${props.size}`,
  {
    "si-listbox--multiple": props.multiple,
    "si-listbox--checkbox": props.checkbox,
    "si-listbox--checkmark": props.checkmark,
    "si-listbox--disabled": props.disabled,
    "si-listbox--error": !!props.error,
  },
])

const listStyle = computed(() => ({
  maxHeight:
    typeof props.maxHeight === "number" ? `${props.maxHeight}px` : props.maxHeight,
}))

const resolvedAriaLabel = computed(() => props.ariaLabel || props.label)

const checkIconSize = computed(() => TIER_CHECK_SIZE[props.size] - 4)

/** 多选命中集：Set 做 O(1) 判断（避免逐项 indexOf 的 O(n²)） */
const selectedSet = computed<Set<SelectOption["value"]>>(() => {
  if (!props.multiple) return new Set()
  const value = props.modelValue
  return new Set(Array.isArray(value) ? value : [])
})

const isSelected = (option: SelectOption): boolean => {
  if (props.multiple) return selectedSet.value.has(option.value)
  const value = props.modelValue
  return !Array.isArray(value) && value === option.value
}

/** 筛选结果：label 与 keywords 双字段匹配（与 Select 的 filterable 行为一致） */
const visibleOptions = computed(() => {
  const query = filterQuery.value.trim().toLowerCase()
  if (!query) return props.options
  return props.options.filter((option) => {
    if (option.label.toLowerCase().includes(query)) return true
    return String(option.keywords ?? "").toLowerCase().includes(query)
  })
})

const activeOptionId = computed(() =>
  activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined,
)

const optionClasses = (option: SelectOption, index: number) => ({
  "si-listbox__option--selected": isSelected(option),
  "si-listbox__option--highlight": isSelected(option) && props.highlightOnSelect,
  "si-listbox__option--disabled": !!option.disabled,
  "si-listbox__option--active": index === activeIndex.value,
})

const setOptionRef = (
  el: Element | ComponentPublicInstance | null,
  index: number,
) => {
  optionEls[index] = el instanceof HTMLElement ? el : null
}

const setActive = (index: number) => {
  activeIndex.value = index
  optionEls[index]?.scrollIntoView({ block: "nearest" })
}

/** 沿方向找下一个未禁用项（全部禁用时保持原位） */
const findEnabledIndex = (from: number, delta: number): number => {
  const list = visibleOptions.value
  let index = from + delta
  while (index >= 0 && index < list.length) {
    if (!list[index].disabled) return index
    index += delta
  }
  return from
}

const moveActive = (delta: number) => {
  const list = visibleOptions.value
  const start = activeIndex.value < 0
    ? (delta > 0 ? -1 : list.length)
    : activeIndex.value
  const next = findEnabledIndex(start, delta)
  if (next >= 0 && next !== activeIndex.value) setActive(next)
}

const toggleOption = (option: SelectOption) => {
  if (props.disabled || option.disabled) return
  if (props.multiple) {
    const next = new Set(selectedSet.value)
    if (next.has(option.value)) next.delete(option.value)
    else next.add(option.value)
    const values = [...next] // 全新数组（非 deep watch 对原地 splice 不触发）
    emit("update:modelValue", values)
    emit("change", values, option)
    return
  }
  emit("update:modelValue", option.value)
  emit("change", option.value, option)
}

const handleOptionClick = (option: SelectOption, index: number) => {
  activeIndex.value = index
  listRef.value?.focus() // 保持键盘可连续操作（focus-visible 才画轮廓，鼠标点击不闪）
  toggleOption(option)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled || visibleOptions.value.length === 0) return
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault()
      moveActive(1)
      break
    case "ArrowUp":
      event.preventDefault()
      moveActive(-1)
      break
    case "Home":
      event.preventDefault()
      setActive(findEnabledIndex(-1, 1))
      break
    case "End":
      event.preventDefault()
      setActive(findEnabledIndex(visibleOptions.value.length, -1))
      break
    case "Enter":
    case " ": {
      event.preventDefault()
      const option = visibleOptions.value[activeIndex.value]
      if (option) toggleOption(option)
      break
    }
    default:
      break
  }
}

// 筛选结果变化后重置活动项（下次按方向键从新结果的首/末项开始）
watch(visibleOptions, () => {
  activeIndex.value = -1
})
</script>

<style scoped lang="scss">
@use './styles/Listbox.scss';
</style>
