<!-- 设置项滑块：减号/range/加号 + 数值显示，内置范围钳制，供代码块设置等复用 -->
<template>
  <div class="setting-slider">
    <!-- 减号按钮 -->
    <button
      class="slider-btn"
      type="button"
      @click="stepBy(-buttonDelta)"
    >
      −
    </button>
    <input
      :value="modelValue"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      class="range-slider"
      @input="onInput"
    />
    <!-- 加号按钮 -->
    <button
      class="slider-btn"
      type="button"
      @click="stepBy(buttonDelta)"
    >
      +
    </button>
    <!-- 当前值 -->
    <span
      v-if="showValue"
      class="slider-value"
    >{{ displayValue }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

interface Props {
  modelValue: number
  min: number
  max: number
  step: number
  /** 加减按钮的步进量，默认等于 step */
  buttonStep?: number
  /** 是否显示数值徽标 */
  showValue?: boolean
  /** 数值显示格式化函数 */
  formatValue?: (value: number) => string
}

const props = withDefaults(defineProps<Props>(), {
  buttonStep: undefined,
  showValue: true,
  formatValue: undefined,
})

const emit = defineEmits<{ (e: "update:modelValue", value: number): void }>()

const buttonDelta = computed(() => props.buttonStep ?? props.step)

// 根据 step 推导小数位，避免浮点累加误差（如 0.1 + 0.2）
const decimals = computed(() => {
  const s = String(props.step)
  const dot = s.indexOf(".")
  return dot === -1 ? 0 : s.length - dot - 1
})

const displayValue = computed(() =>
  props.formatValue ? props.formatValue(props.modelValue) : String(props.modelValue),
)

function clamp(value: number): number {
  const rounded = Number(value.toFixed(decimals.value))
  return Math.max(props.min, Math.min(props.max, rounded))
}

function onInput(e: Event) {
  emit("update:modelValue", clamp(Number((e.target as HTMLInputElement).value)))
}

function stepBy(delta: number) {
  const next = clamp(props.modelValue + delta)
  if (next !== props.modelValue) {
    emit("update:modelValue", next)
  }
}
</script>

<style scoped lang="scss">
@use "../styles/SettingSlider.scss";
</style>
