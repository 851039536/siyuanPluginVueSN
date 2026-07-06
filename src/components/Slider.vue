<template>
  <div
    :class="sliderClasses"
    v-bind="containerAttrs"
  >
    <FormField
      :label="label"
      :required="required"
      :hint="hint"
      :error="error"
      :size="size"
    />
    <div class="si-slider__wrapper">
      <input
        ref="inputRef"
        type="range"
        :value="modelValue"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        :name="name"
        class="si-slider__field"
        @input="handleInput"
        @change="handleChange"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      <div
        v-if="showValue"
        class="si-slider__value"
      >
        {{ displayValue }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  useAttrs,
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
  /** 只读状态 */
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
  /** 是否显示最小最大值标签 */
  showMinMax?: boolean
  /** 值显示格式化函数 */
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

const displayValue = computed(() => {
  if (props.formatValue && props.modelValue !== null) {
    return props.formatValue(props.modelValue)
  }
  return props.modelValue ?? props.min
})

const sliderClasses = computed(() => [
  "si-slider",
  `si-slider--${props.size}`,
  {
    "si-slider--disabled": props.disabled,
    "si-slider--readonly": props.readonly,
    "si-slider--error": props.error,
  },
])

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = Number.parseFloat(target.value)
  emit("update:modelValue", value)
  emit("input", value, event)
}

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = Number.parseFloat(target.value)
  emit("change", value, event)
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
