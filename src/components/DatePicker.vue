<!-- 日期选择器：单选 / 区间选择，日-月-年三视图日历面板 -->
<template>
  <div :class="pickerClasses">
    <FormField
      :label="label"
      :required="required"
      :hint="hint"
      :error="error"
      :size="size"
    />
    <!-- 输入框与弹层（弹层置于 wrapper 内以复用相对定位范式） -->
    <div
      ref="wrapperRef"
      class="si-datepicker__wrapper"
      @click.stop
      @keydown.esc="handleEscape"
    >
      <input
        ref="inputRef"
        class="si-datepicker__input"
        type="text"
        role="combobox"
        aria-autocomplete="none"
        :id="inputId"
        :name="name"
        :value="displayText"
        :placeholder="resolvedPlaceholder"
        :readonly="isRange || !manualInput || readonly"
        :disabled="disabled"
        :autocomplete="'off'"
        :aria-haspopup="'dialog'"
        :aria-expanded="isOpen ? 'true' : 'false'"
        :aria-controls="panelId"
        :aria-label="ariaLabel"
        :aria-labelledby="ariaLabelledby"
        @focus="handleInputFocus"
        @keydown="handleInputKeydown"
        @change="handleManualInput"
        @blur="emit('blur', $event)"
      />
      <!-- 清除按钮 -->
      <span
        v-if="showClear && hasValue && !disabled && !readonly"
        class="si-datepicker__clear"
        @click.stop="handleClear"
      >
        <IconWrapper
          :name="'x' as IconKey"
          :size="iconSize"
        />
      </span>
      <!-- 日历图标按钮 -->
      <button
        type="button"
        class="si-datepicker__trigger"
        :disabled="disabled"
        :tabindex="-1"
        :aria-haspopup="'dialog'"
        :aria-expanded="isOpen ? 'true' : 'false'"
        :aria-controls="panelId"
        :aria-label="triggerAriaLabel"
        @click.stop="togglePanel"
      >
        <IconWrapper
          :name="'calendar' as IconKey"
          :size="iconSize"
        />
      </button>

      <Transition name="si-datepicker-panel">
        <PickerPanel
          v-if="isOpen"
          ref="panelRef"
          :panel-id="panelId"
          :placement="resolvedPlacement"
          :selected="selectedDates"
          :range="isRange"
          :initial-view="view"
          :first-day-of-week="firstDayOfWeek"
          :weekday-labels="weekdayLabels"
          :weekday-full-labels="WEEKDAY_FULL_LABELS"
          :today="today"
          :disabled="disabledOptions"
          :show-button-bar="showButtonBar"
          :today-text="todayText"
          :clear-text="clearText"
          :ariaLabels="mergedAriaLabels"
          :nav-icon-size="iconSize"
          @select="handleDateSelect"
          @select-today="handleSelectToday"
          @clear="handleClear"
          @view-change="emit('viewChange', $event)"
        >
          <!-- date 插槽：自定义日期单元格内容，scope 为完整日历单元格元数据；未传入时回退为日序 -->
          <template #date="cellScope">
            <slot
              name="date"
              v-bind="cellScope"
            >{{ cellScope.date.getDate() }}</slot>
          </template>
          <!-- buttonbar 插槽：自定义底部按钮栏 -->
          <template #buttonbar="buttonbarScope">
            <slot
              name="buttonbar"
              v-bind="buttonbarScope"
            />
          </template>
        </PickerPanel>
      </Transition>
    </div>

    <!-- 仅屏幕阅读器可见的选中结果播报区 -->
    <span
      class="si-datepicker__live"
      aria-live="polite"
    >{{ liveText }}</span>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "./kit/icons"
import type {
  DatePickerAriaLabels,
  DatePickerSize,
  DatePickerValue,
  DisabledDates,
  PickerView,
} from "./datePicker/types"
import {
  computed,
  ref,
  useId,
} from "vue"
import FormField from "./FormField.vue"
import IconWrapper from "./IconWrapper.vue"
import PickerPanel from "./datePicker/PickerPanel.vue"
import {
  DEFAULT_ARIA_LABELS,
  WEEKDAY_FULL_LABELS,
  WEEKDAY_LABELS,
} from "./datePicker/types"
import {
  useDatePicker,
  type DatePickerPanelHandle,
} from "./datePicker/useDatePicker"
import "./kit/theme"

/** 尺寸档位 → 图标像素尺寸（与其它组件的档位图标约定一致） */
const TIER_ICON_SIZE: Record<DatePickerSize, number> = {
  xsmall: 12,
  small: 14,
  medium: 16,
  large: 18,
}

interface Props {
  /** 单选为 Date；区间为 Date[]；valueFormat 时为字符串 */
  modelValue?: DatePickerValue
  /** 选择模式 */
  selectionMode?: "single" | "range"
  /** 面板初始视图（面板内可逐级切换） */
  view?: PickerView
  /**
   * 显示格式模板，令牌：d/dd/o/oo/D/DD/m/mm/M/MM/y/yy/@/! 与 '字面文本'
   * 默认 "yy-mm-dd"（有意偏离 PrimeVue 的 mm/dd/yy，与项目 formatTime 的日期段一致）
   */
  dateFormat?: string
  /** 为真时 modelValue 读写字符串（对齐 PrimeVue updateModelType="string"） */
  valueFormat?: boolean
  /** 可选日期下界 */
  minDate?: Date | null
  /** 可选日期上界 */
  maxDate?: Date | null
  /** 禁用日期：数组或判定函数 */
  disabledDates?: DisabledDates
  /** 禁用的星期几（0=周日 … 6=周六） */
  disabledDays?: number[]
  /** 一周起始日（0=周日；默认 1 周一起始，贴合中文习惯） */
  firstDayOfWeek?: number
  /** 是否显示输入框内清除按钮 */
  showClear?: boolean
  /** 是否显示面板底部「今天 / 清除」按钮栏 */
  showButtonBar?: boolean
  /** 是否允许手输日期（默认关闭，仅通过日历选择；区间模式下始终关闭） */
  manualInput?: boolean
  /** 尺寸档位 */
  size?: DatePickerSize
  /** 行内标签文案 */
  label?: string
  /** 是否必填 */
  required?: boolean
  /** 辅助说明（error 优先显示） */
  hint?: string
  /** 校验失败文案（同时描红外框） */
  error?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否只读（不可手输，但仍可打开面板选择） */
  readonly?: boolean
  /** 原生 input 的 name */
  name?: string
  /** 原生 input 的 id */
  inputId?: string
  /**
   * 弹层展开方向。已知限制：弹层为相对定位下拉（同 Select），
   * 在 overflow: hidden 容器内可能被裁剪（本组件不提供 Teleport 挂载点）
   */
  placement?: "top" | "bottom" | "auto"
  /** 占位文本（默认按模式取「请选择日期」/「请选择日期范围」） */
  placeholder?: string
  /** 表头星期短名（索引 0 = 周日） */
  weekdayLabels?: string[]
  /** 底部栏「今天」按钮文案 */
  todayText?: string
  /** 底部栏「清除」按钮文案 */
  clearText?: string
  /** 无障碍名称 */
  ariaLabel?: string
  /** 无障碍名称来源元素 id */
  ariaLabelledby?: string
  /** 面板导航按钮与弹层的无障碍文案（可按需覆盖部分字段） */
  ariaLabels?: Partial<DatePickerAriaLabels>
}

interface Emits {
  (e: "update:modelValue", value: DatePickerValue): void
  (e: "change", value: DatePickerValue): void
  (e: "visibleChange", visible: boolean): void
  (e: "viewChange", view: PickerView): void
  (e: "clear"): void
  (e: "focus", event: FocusEvent): void
  (e: "blur", event: FocusEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  selectionMode: "single",
  view: "date",
  dateFormat: "yy-mm-dd",
  valueFormat: false,
  minDate: null,
  maxDate: null,
  disabledDates: undefined,
  disabledDays: () => [],
  firstDayOfWeek: 1,
  showClear: false,
  showButtonBar: true,
  manualInput: false,
  size: "small",
  required: false,
  disabled: false,
  readonly: false,
  placement: "auto",
  placeholder: "",
  weekdayLabels: () => WEEKDAY_LABELS,
  todayText: "今天",
  clearText: "清除",
  ariaLabels: undefined,
})

const emit = defineEmits<Emits>()

const wrapperRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const panelRef = ref<DatePickerPanelHandle>()

/** 弹层 id 供 aria-controls 关联（useId 保证多实例唯一） */
const panelId = `si-datepicker-panel-${useId()}`

const {
  isOpen,
  resolvedPlacement,
  today,
  liveText,
  disabledOptions,
  selectedDates,
  isRange,
  hasValue,
  displayText,
  resolvedPlaceholder,
  openPanel,
  closePanel,
  togglePanel,
  handleEscape,
  handleInputFocus,
  handleInputKeydown,
  handleManualInput,
  handleDateSelect,
  handleSelectToday,
  handleClear,
} = useDatePicker({
  props,
  emit: {
    update: (value) => emit("update:modelValue", value),
    change: (value) => emit("change", value),
    visibleChange: (visible) => emit("visibleChange", visible),
    clear: () => emit("clear"),
    focus: (event) => emit("focus", event),
  },
  inputRef,
  wrapperRef,
  panelRef,
})

const iconSize = computed(() => TIER_ICON_SIZE[props.size])

const mergedAriaLabels = computed<DatePickerAriaLabels>(() => ({
  ...DEFAULT_ARIA_LABELS,
  ...props.ariaLabels,
}))

const triggerAriaLabel = computed(() => {
  const base = mergedAriaLabels.value.chooseDate
  return displayText.value ? `${base}：${displayText.value}` : base
})

const pickerClasses = computed(() => [
  "si-datepicker",
  `si-datepicker--${props.size}`,
  {
    "si-datepicker--disabled": props.disabled,
    "si-datepicker--error": !!props.error,
    "si-datepicker--open": isOpen.value,
    "si-datepicker--range": isRange.value,
  },
])

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  open: () => openPanel(true),
  close: closePanel,
  inputElement: computed(() => inputRef.value),
})
</script>

<style scoped lang="scss">
@use './styles/DatePicker.scss';
</style>
