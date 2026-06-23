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

type SliderSize = "small" | "medium" | "large"

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
  size: "medium",
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
@use '@/variables.scss' as *;

.si-slider {
  display: inline-flex;
  flex-direction: column;
  position: relative;
  font-family: $font-body;
  width: 100%;

  &__wrapper {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    position: relative;
  }

  &__field {
    flex: 1;
    width: 100%;
    height: 6px;
    border: none;
    outline: none;
    background: var(--b3-theme-surface, $brand-light-gray);
    border-radius: $radius-sm;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;

    // Webkit (Chrome, Safari, Edge) 滑块样式
    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      background: var(--b3-theme-primary, $brand-orange);
      border-radius: 50%;
      cursor: grab;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      &:hover {
        transform: scale(1.2);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }

      &:active {
        cursor: grabbing;
        transform: scale(1.1);
      }
    }

    // Firefox 滑块样式
    &::-moz-range-thumb {
      width: 16px;
      height: 16px;
      background: var(--b3-theme-primary, $brand-orange);
      border: none;
      border-radius: 50%;
      cursor: grab;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      &:hover {
        transform: scale(1.2);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }

      &:active {
        cursor: grabbing;
        transform: scale(1.1);
      }
    }

    // Webkit 轨道样式
    &::-webkit-slider-runnable-track {
      width: 100%;
      height: 6px;
      background: var(--b3-theme-surface, $brand-light-gray);
      border-radius: $radius-sm;
    }

    // Firefox 轨道样式
    &::-moz-range-track {
      width: 100%;
      height: 6px;
      background: var(--b3-theme-surface, $brand-light-gray);
      border-radius: $radius-sm;
    }

    &:focus {
      &::-webkit-slider-thumb {
        box-shadow: 0 0 0 4px rgba(var(--b3-theme-primary-rgb, $brand-orange), 0.2);
      }

      &::-moz-range-thumb {
        box-shadow: 0 0 0 4px rgba(var(--b3-theme-primary-rgb, $brand-orange), 0.2);
      }
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;

      &::-webkit-slider-thumb {
        cursor: not-allowed;
        background: var(--b3-theme-secondary, $brand-mid-gray);
      }

      &::-moz-range-thumb {
        cursor: not-allowed;
        background: var(--b3-theme-secondary, $brand-mid-gray);
      }
    }
  }

  &__value {
    flex-shrink: 0;
    min-width: 40px;
    text-align: center;
    font-size: $font-size-sm;
    font-weight: 500;
    color: var(--b3-theme-primary, $brand-orange);
    font-family: $font-heading;
  }

  &--disabled {
    .si-slider__field {
      cursor: not-allowed;
    }
  }

  &--readonly {
    .si-slider__field {
      cursor: default;
    }
  }

  &--error {
    .si-slider__field {
      &::-webkit-slider-thumb {
        background: var(--b3-theme-destructive, $brand-destructive);
      }

      &::-moz-range-thumb {
        background: var(--b3-theme-destructive, $brand-destructive);
      }
    }
  }

  // 尺寸变体
  &--small {
    .si-slider__field {
      height: 4px;

      &::-webkit-slider-thumb {
        width: 14px;
        height: 14px;
      }

      &::-moz-range-thumb {
        width: 14px;
        height: 14px;
      }
    }

    .si-slider__value {
      font-size: $font-size-xs;
      min-width: 32px;
    }
  }

  &--medium {
    .si-slider__field {
      height: 6px;

      &::-webkit-slider-thumb {
        width: 16px;
        height: 16px;
      }

      &::-moz-range-thumb {
        width: 16px;
        height: 16px;
      }
    }

    .si-slider__value {
      font-size: $font-size-sm;
      min-width: 40px;
    }
  }

  &--large {
    .si-slider__field {
      height: 8px;

      &::-webkit-slider-thumb {
        width: 18px;
        height: 18px;
      }

      &::-moz-range-thumb {
        width: 18px;
        height: 18px;
      }
    }

    .si-slider__value {
      font-size: 15px;
      min-width: 48px;
    }
  }
}
</style>
