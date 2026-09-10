<!-- 下拉选择：单选 / 分组 / 筛选 / 可清空 / 四档尺寸；提供 combobox + listbox 无障碍语义与完整键盘操作 -->
<template>
  <div
    :class="selectClasses"
    v-bind="containerAttrs"
  >
    <FormField
      :label="label"
      :label-id="labelId"
      :required="required"
      :hint="hint"
      :size="size"
    >
      <div
        ref="wrapperRef"
        class="si-select__wrapper"
      >
        <div
          class="si-select__trigger"
          :class="{ 'si-select__trigger--disabled': disabled }"
          role="combobox"
          aria-haspopup="listbox"
          :aria-expanded="isOpen ? 'true' : 'false'"
          :aria-controls="listId"
          :aria-activedescendant="isOpen ? activeDescendantId : undefined"
          :aria-disabled="disabled ? 'true' : undefined"
          :aria-labelledby="ariaLabelledby || (label ? labelId : undefined)"
          :aria-label="ariaLabel"
          :tabindex="disabled ? -1 : 0"
          @click="toggleDropdown"
          @keydown="handleKeydown"
        >
          <span
            v-if="selectedLabel"
            class="si-select__value"
          >
            <!-- selected slot：已选项富内容（如名称 + 来源标记）；默认回退为纯文本标签 -->
            <slot
              name="selected"
              :option="selectedOption"
            >{{ selectedLabel }}</slot>
          </span>
          <span
            v-else
            class="si-select__placeholder"
          >{{ placeholder }}</span>
          <!-- 清除按钮：鼠标便捷入口，保持在 Tab 序列之外（tabindex=-1），仅虚拟光标可达 -->
          <span
            v-if="clearable && selectedOption && !disabled"
            class="si-select__clear"
            role="button"
            tabindex="-1"
            :aria-label="clearLabel"
            @click.stop="handleClear"
          >
            <IconWrapper
              :name="'x' as IconKey"
              :size="iconSize"
              aria-hidden="true"
            />
          </span>
          <IconWrapper
            :name="(isOpen ? 'chevronUp' : 'chevronDown') as IconKey"
            :size="iconSize"
            class="si-select__arrow"
            aria-hidden="true"
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
              v-if="filterable"
              class="si-select__filter"
            >
              <input
                ref="filterInputRef"
                :value="filterQuery"
                type="text"
                class="si-select__filter-input"
                :placeholder="filterPlaceholder"
                :aria-label="filterPlaceholder"
                :aria-controls="listId"
                :aria-activedescendant="activeDescendantId"
                aria-autocomplete="list"
                @input="handleFilterInput"
                @click.stop
                @keydown="handleFilterKeydown"
              />
            </div>

            <!-- 列表容器恒常渲染（无匹配时也保留 listbox 落点），空态作为其子节点 -->
            <div
              :id="listId"
              class="si-select__options"
              :class="{ 'si-select__options--grouped': hasGroups }"
              role="listbox"
              :aria-labelledby="ariaLabelledby || (label ? labelId : undefined)"
            >
              <div
                v-if="filteredOptions.length === 0"
                class="si-select__empty"
              >
                {{ emptyText }}
              </div>

              <template
                v-for="(option, index) in filteredOptions"
                :key="resolveOptionKey(option, index)"
              >
                <!-- 分组选项 -->
                <div
                  v-if="isGroup(option)"
                  class="si-select__group"
                  role="group"
                  :aria-labelledby="groupId(index)"
                >
                  <div
                    :id="groupId(index)"
                    class="si-select__group-label"
                  >
                    {{ option.label }}
                  </div>
                  <div
                    v-for="(groupOption, groupIndex) in option.options"
                    :key="resolveOptionKey(groupOption, groupIndex)"
                    :id="optionId(domIndex(groupOption))"
                    :ref="(el) => setOptionRef(el, domIndex(groupOption))"
                    class="si-select__option"
                    role="option"
                    :class="{
                      'si-select__option--selected': isSelected(groupOption.value),
                      'si-select__option--disabled': groupOption.disabled,
                      'si-select__option--hovered': isActive(groupOption),
                    }"
                    :title="groupOption.label"
                    :aria-selected="isSelected(groupOption.value) ? 'true' : 'false'"
                    :aria-disabled="groupOption.disabled ? 'true' : undefined"
                    @click.stop="selectOption(groupOption)"
                    @mouseenter="setActiveByOption(groupOption)"
                  >
                    <slot
                      name="option"
                      :option="groupOption"
                    >{{ groupOption.label }}</slot>
                  </div>
                </div>

                <!-- 普通选项 -->
                <div
                  v-else
                  :id="optionId(domIndex(option))"
                  :ref="(el) => setOptionRef(el, domIndex(option))"
                  class="si-select__option"
                  role="option"
                  :class="{
                    'si-select__option--selected': isSelected(option.value),
                    'si-select__option--disabled': option.disabled,
                    'si-select__option--hovered': isActive(option),
                  }"
                  :title="option.label"
                  :aria-selected="isSelected(option.value) ? 'true' : 'false'"
                  :aria-disabled="option.disabled ? 'true' : undefined"
                  @click.stop="selectOption(option)"
                  @mouseenter="setActiveByOption(option)"
                >
                  <slot
                    name="option"
                    :option="option"
                  >{{ option.label }}</slot>
                </div>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </FormField>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import type {
  OptionType,
  SelectGroupOption as SelectGroupOptionShape,
  SelectOption as SelectOptionShape,
  SelectSize,
} from "./select/types"
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
import { isGroupOption as isGroupLike } from "./select/navigation"
import { useSelectKeyboard } from "./select/useSelectKeyboard"
import { useSelectNavigation } from "./select/useSelectNavigation"
import {
  filterOptionList,
  findSelectedOption,
  hasGroupOption,
  resolveOptionKey,
} from "./select/utils"

/**
 * 选项类型对外导出：`Listbox.vue` 与多个 feature 依赖 `@/components/Select.vue` 这一导入路径，
 * 故真实定义下沉到 `./select/types`（纯 TS 模块，可被同目录工具共享），此处仅作类型别名导出。
 */
export type SelectOption = SelectOptionShape
export type SelectGroupOption = SelectGroupOptionShape
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
  /** 无障碍名称（无可见 label 时使用；与 aria-labelledby 同时存在时后者优先） */
  ariaLabel?: string
  /** 无障碍名称来源元素 id（优先于由 label 推导的 id） */
  ariaLabelledby?: string
  /** 清除按钮的无障碍名称 */
  clearLabel?: string
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
  size: "small",
  required: false,
  filterable: false,
  filterPlaceholder: "搜索...",
  emptyText: "暂无数据",
  placement: "auto",
  maxHeight: 200,
  iconSize: 14,
  clearable: false,
  clearLabel: "清除",
})

const emit = defineEmits<Emits>()
const attrs = useAttrs()

/** 仅保留非 class/style 属性透传，避免与内部类名/宽度控制互相污染 */
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
const wrapperRef = ref<HTMLElement>()
const filterInputRef = ref<HTMLInputElement>()
const resolvedPlacement = ref<"top" | "bottom">("bottom")

// 类型守卫（包装私有泛型守卫，保持本地精确类型）
const isGroup = (option: OptionType): option is SelectGroupOption => isGroupLike(option)

// 计算属性
const selectClasses = computed(() => [
  "si-select",
  `si-select--${props.size}`,
  {
    "si-select--disabled": props.disabled,
    "si-select--labeled": !!props.label,
  },
])

const dropdownClasses = computed(() => [`si-select__dropdown--${resolvedPlacement.value}`])

const dropdownStyle = computed(() => ({
  maxHeight: typeof props.maxHeight === "number" ? `${props.maxHeight}px` : props.maxHeight,
}))

const selectedOption = computed(() =>
  findSelectedOption(props.options, props.modelValue),
)

const selectedLabel = computed(() => selectedOption.value?.label || "")

const hasGroups = computed(() => hasGroupOption(props.options))

const filteredOptions = computed<OptionType[]>(() => (
  props.filterable
    ? filterOptionList(props.options, filterQuery.value.toLowerCase())
    : props.options
))

// 导航与 ARIA（平铺下标 / 激活项 id / 滚动定位）
const {
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
  anchorIndex,
} = useSelectNavigation({
  visibleOptions: () => filteredOptions.value,
  isSelected: (option) => option.value === props.modelValue,
})

// 方法
const isSelected = (value: string | number | boolean) => value === props.modelValue

const focusTrigger = () => {
  wrapperRef.value?.querySelector<HTMLDivElement>(".si-select__trigger")?.focus()
}

/**
 * 选中选项。键盘路径传 `restoreFocus: true` 把焦点收回触发器（便于连续操作）；
 * 鼠标点击路径不抢焦点。
 */
const selectOption = (option: SelectOption, options: { restoreFocus?: boolean } = {}) => {
  if (option.disabled) return

  emit("update:modelValue", option.value)
  emit("change", option.value, option)
  closeDropdown(options)
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
    openDropdown("first")
  }
}

/** 打开面板并定位到已选项（无已选项时按 fallback 取首/末项），随后滚动入视野 */
const openDropdown = (fallback: "first" | "last" = "first") => {
  isOpen.value = true
  filterQuery.value = ""
  emit("visible-change", true)

  setActiveIndex(anchorIndex(fallback))

  nextTick(() => {
    resolvePlacement()
    if (props.filterable) {
      filterInputRef.value?.focus()
    }
  })
}

/** 关闭面板。仅在 `restoreFocus` 为真时把焦点收回触发器，避免外部点击时抢焦点 */
const closeDropdown = (options: { restoreFocus?: boolean } = {}) => {
  const wasOpen = isOpen.value

  isOpen.value = false
  filterQuery.value = ""
  activeIndex.value = -1

  if (wasOpen) {
    emit("visible-change", false)
  }

  if (options.restoreFocus) {
    nextTick(focusTrigger)
  }
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

// 键盘（收起/展开态方向键、Enter/Space、Esc、Tab；筛选框仅委托部分按键）
const { handleKeydown, handleFilterKeydown } = useSelectKeyboard({
  isOpen: () => isOpen.value,
  disabled: () => props.disabled,
  flatItems: () => flatItems.value,
  activeIndex: () => activeIndex.value,
  setActiveIndex,
  open: openDropdown,
  close: closeDropdown,
  toggle: toggleDropdown,
  select: selectOption,
})

/** 筛选输入：更新查询词并把激活项复位（避免指向已被过滤掉的项） */
const handleFilterInput = (event: Event) => {
  filterQuery.value = (event.target as HTMLInputElement).value
  activeIndex.value = -1
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
  focus: focusTrigger,
  blur: () => wrapperRef.value?.querySelector<HTMLDivElement>(".si-select__trigger")?.blur(),
  open: () => openDropdown("first"),
  close: closeDropdown,
})
</script>

<style scoped lang="scss">
@use './styles/Select.scss';
@use './styles/index.scss';
</style>
