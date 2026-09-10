<!-- 滑块：单值范围输入，四档尺寸、可显示当前值与极值、支持只读 -->
<template>
  <div
    :class="sliderClasses"
    v-bind="containerAttrs"
  >
    <FormField
      :label="label"
      :label-id="labelId"
      :required="required"
      :hint="hint"
      :error="error"
      :size="size"
    >
      <div class="si-slider__wrapper">
        <!-- 轨道列：极值标签需与轨道等宽并对齐左右端，故与 input 同列 -->
        <div class="si-slider__field-column">
          <input
            ref="inputRef"
            type="range"
            :value="nativeValue"
            :min="min"
            :max="max"
            :step="step"
            :disabled="disabled"
            :name="name"
            class="si-slider__field"
            :aria-labelledby="label ? labelId : undefined"
            :aria-readonly="readonly ? 'true' : undefined"
            @input="handleInput"
            @change="handleChange"
            @keydown="handleKeydown"
            @focus="handleFocus"
            @blur="handleBlur"
          />
          <div
            v-if="showMinMax"
            class="si-slider__minmax"
          >
            <span class="si-slider__minmax-value">{{ minLabel }}</span>
            <span class="si-slider__minmax-value">{{ maxLabel }}</span>
          </div>
        </div>
        <div
          v-if="showValue"
          class="si-slider__value"
        >
          {{ displayValue }}
        </div>
      </div>
    </FormField>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  useAttrs,
  useId,
} from "vue"
import FormField from "@/components/FormField.vue"

type SliderSize = "xsmall" | "small" | "medium" | "large"

interface Props {
  /** 绑定值 */
  modelValue?: number | null
  /** 尺寸 */
  size?: SliderSize
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 步长 */
  step?: number
  /** 禁用状态 */
  disabled?: boolean
  /** 只读状态（原生 range 不支持 readonly，组件内自行拦截拖拽与改值按键） */
  readonly?: boolean
  /** 标签文本 */
  label?: string
  /** 是否必填 */
  required?: boolean
  /** 提示文本 */
  hint?: string
  /** 错误文本 */
  error?: string
  /** 是否显示当前值 */
  showValue?: boolean
  /** 是否在轨道下方显示最小/最大值 */
  showMinMax?: boolean
  /** 值显示格式化函数（当前值与极值文案共用） */
  formatValue?: (value: number) => string
  /** 原生 name 属性 */
  name?: string
}

interface Emits {
  (e: "update:modelValue", value: number | null): void
  (e: "input", value: number, event: Event): void
  (e: "change", value: number, event: Event): void
  (e: "focus", event: FocusEvent): void
  (e: "blur", event: FocusEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  size: "small",
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  readonly: false,
  required: false,
  showValue: false,
  showMinMax: false,
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

const inputRef = ref<HTMLInputElement>()

/** 可见标签元素 id（打在 FormField 的 label 上，供滑块的 aria-labelledby 关联） */
const labelId = `${useId()}-label`

/** 只读态需拦截的按键：全部为会改值的键（Tab 必须放行，否则焦点出不去） */
const READONLY_BLOCKED_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]

/** 受控值 → 原生 input 值的单一来源（null 时回落到最小值） */
const nativeValue = computed(() => props.modelValue ?? props.min)

/** 值 → 展示文案（当前值与极值共用 formatValue） */
const formatDisplayValue = (value: number): string =>
  props.formatValue ? props.formatValue(value) : String(value)

const displayValue = computed(() => formatDisplayValue(nativeValue.value))

const minLabel = computed(() => formatDisplayValue(props.min))

const maxLabel = computed(() => formatDisplayValue(props.max))

const sliderClasses = computed(() => [
  "si-slider",
  `si-slider--${props.size}`,
  {
    "si-slider--disabled": props.disabled,
    "si-slider--readonly": props.readonly,
    "si-slider--error": props.error,
  },
])

/**
 * 只读态回滚：受控值未变化时 Vue 不会重新 patch `value`，
 * 必须主动把 DOM 值写回，否则会出现「能拖动」的错觉与状态漂移。
 */
const syncNativeValue = () => {
  const el = inputRef.value
  if (el) {
    el.value = String(nativeValue.value)
  }
}

const handleInput = (event: Event) => {
  if (props.readonly) {
    syncNativeValue()
    return
  }

  const target = event.target as HTMLInputElement
  const value = Number.parseFloat(target.value)
  emit("update:modelValue", value)
  emit("input", value, event)
}

const handleChange = (event: Event) => {
  if (props.readonly) {
    syncNativeValue()
    return
  }

  const target = event.target as HTMLInputElement
  const value = Number.parseFloat(target.value)
  emit("change", value, event)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.readonly && READONLY_BLOCKED_KEYS.includes(event.key)) {
    event.preventDefault()
  }
}

const handleFocus = (event: FocusEvent) => {
  emit("focus", event)
}

const handleBlur = (event: FocusEvent) => {
  emit("blur", event)
}

const focus = () => {
  inputRef.value?.focus()
}

const blur = () => {
  inputRef.value?.blur()
}

defineExpose({
  focus,
  blur,
  inputElement: inputRef,
})
</script>

<style scoped lang="scss">
@use './styles/Slider.scss';
</style>
