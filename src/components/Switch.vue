<template>
  <button
    :class="switchClasses"
    :disabled="disabled || loading"
    role="switch"
    :aria-checked="checked"
    :aria-disabled="disabled"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
  >
    <span
      class="si-switch__track"
      :style="trackStyle"
    >
      <span
        v-if="loading"
        class="si-switch__loading"
      ></span>
      <span
        v-else
        class="si-switch__thumb"
      ></span>
    </span>
    <span
      v-if="label || $slots.default"
      class="si-switch__label"
    >
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
import {
  computed,
  useSlots,
} from "vue"

type SwitchSize = "small" | "medium" | "large"

interface Props {
  /** 是否选中 */
  modelValue?: boolean
  /** 标签文本 */
  label?: string
  /** 开关尺寸 */
  size?: SwitchSize
  /** 是否禁用 */
  disabled?: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 选中时的颜色 */
  activeColor?: string
  /** 未选中时的颜色 */
  inactiveColor?: string
  /** 是否显示标签在左侧 */
  labelBefore?: boolean
}

interface Emits {
  (e: "update:modelValue", value: boolean): void
  (e: "change", value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  size: "medium",
  disabled: false,
  loading: false,
  labelBefore: false,
})

const emit = defineEmits<Emits>()
const slots = useSlots()

const checked = computed(() => props.modelValue)

const switchClasses = computed(() => [
  "si-switch",
  `si-switch--${props.size}`,
  {
    "si-switch--checked": checked.value,
    "si-switch--disabled": props.disabled || props.loading,
    "si-switch--loading": props.loading,
    "si-switch--has-label": props.label || slots.default,
    "si-switch--label-before": props.labelBefore,
  },
])

const trackStyle = computed(() => {
  const style: Record<string, string> = {}
  if (checked.value && props.activeColor) {
    style.backgroundColor = props.activeColor
  }
  if (!checked.value && props.inactiveColor) {
    style.backgroundColor = props.inactiveColor
  }
  return style
})

const handleClick = () => {
  if (!props.disabled && !props.loading) {
    const newValue = !props.modelValue
    emit("update:modelValue", newValue)
    emit("change", newValue)
  }
}
</script>

<style scoped lang="scss">
@use './styles/Switch.scss';
</style>
