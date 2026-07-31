<!-- 颜色字段：色块弹出自绘预设调色板 + 文本输入框双向联动（思源 Electron 环境不弹出原生 input[type=color] 取色器，故改用自绘调色板），供代码块/标题/表格/列表样式设置复用 -->
<template>
  <div
    ref="rootEl"
    class="color-field"
  >
    <!-- 色块按钮：显示当前颜色，点击展开/收起调色板 -->
    <button
      type="button"
      class="color-swatch-btn"
      :title="modelValue"
      :style="{ backgroundColor: modelValue }"
      @click="showPalette = !showPalette"
    ></button>
    <input
      :value="modelValue"
      type="text"
      class="color-input"
      :placeholder="placeholder"
      @input="onChange"
    />
    <!-- 预设调色板弹层 -->
    <div
      v-if="showPalette"
      class="color-popover"
    >
      <div class="palette-grid">
        <button
          v-for="c in PALETTE"
          :key="c"
          type="button"
          class="palette-swatch"
          :class="{ active: c.toLowerCase() === modelValue.toLowerCase() }"
          :title="c"
          :style="{ backgroundColor: c }"
          @click="pickColor(c)"
        ></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"

interface Props {
  modelValue: string
  placeholder?: string
}

defineProps<Props>()

const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>()

/** 预设调色板：灰阶 / 明亮 / 标准 / 深色 四行，覆盖常用配色场景 */
const PALETTE = [
  // 灰阶
  "#000000", "#333333", "#666666", "#999999", "#cccccc", "#eeeeee", "#ffffff", "#8b572a",
  // 明亮
  "#d0021b", "#f5a623", "#f8e71c", "#7ed321", "#50e3c2", "#4a90d9", "#9013fe", "#e91e63",
  // 标准
  "#e74c3c", "#fd8700", "#f1c40f", "#00b600", "#1abc9c", "#0080ff", "#be6fff", "#ff7eb6",
  // 深色
  "#8e2020", "#b35b00", "#927608", "#1e7a1e", "#0e7c6b", "#23476c", "#5e2ca5", "#a04a6e",
] as const

const rootEl = ref<HTMLElement | null>(null)
const showPalette = ref(false)

function onChange(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).value)
}

function pickColor(color: string) {
  emit("update:modelValue", color)
  showPalette.value = false
}

// 点击组件外部 / 按 Esc 关闭调色板
function onDocPointerDown(e: MouseEvent) {
  if (showPalette.value && rootEl.value && !rootEl.value.contains(e.target as Node)) {
    showPalette.value = false
  }
}

function onDocKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    showPalette.value = false
  }
}

onMounted(() => {
  document.addEventListener("mousedown", onDocPointerDown)
  document.addEventListener("keydown", onDocKeydown)
})

onUnmounted(() => {
  document.removeEventListener("mousedown", onDocPointerDown)
  document.removeEventListener("keydown", onDocKeydown)
})
</script>

<style scoped lang="scss">
@use "../styles/ColorField.scss";
</style>
