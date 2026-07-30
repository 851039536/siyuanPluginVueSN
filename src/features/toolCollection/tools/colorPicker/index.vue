<!-- 颜色选择器 — HEX/RGB/HSL 互转 + 调色板 + 复制 -->
<template>
  <div class="color-picker">
    <!-- 预览行：色块 + 原生取色器 -->
    <div class="cp-preview-row">
      <div
        class="cp-swatch"
        :style="{ background: hexValue }"
      />
      <input
        type="color"
        class="cp-native-input"
        :value="hexValue"
        @input="onNativePick"
      >
    </div>

    <!-- 格式输入/输出 -->
    <div class="cp-fields">
      <!-- HEX -->
      <div class="cp-field">
        <span class="cp-field-label">HEX</span>
        <input
          class="cp-field-input"
          :value="hexValue"
          @change="onHexInput"
        >
        <button
          class="cp-copy-btn"
          @click="copy(hexValue)"
        >
          {{ i18n.colorPicker?.copy }}
        </button>
      </div>
      <!-- RGB -->
      <div class="cp-field">
        <span class="cp-field-label">RGB</span>
        <input
          class="cp-field-input"
          :value="rgbString"
          readonly
        >
        <button
          class="cp-copy-btn"
          @click="copy(rgbString)"
        >
          {{ i18n.colorPicker?.copy }}
        </button>
      </div>
      <!-- HSL -->
      <div class="cp-field">
        <span class="cp-field-label">HSL</span>
        <input
          class="cp-field-input"
          :value="hslString"
          readonly
        >
        <button
          class="cp-copy-btn"
          @click="copy(hslString)"
        >
          {{ i18n.colorPicker?.copy }}
        </button>
      </div>
    </div>

    <!-- 快捷色板 -->
    <div class="cp-palette">
      <!-- 色板标签 -->
      <span class="cp-palette-label">{{ i18n.colorPicker?.palette }}</span>
      <div class="cp-palette-grid">
        <div
          v-for="color in PALETTE"
          :key="color"
          class="cp-palette-item"
          :style="{ background: color }"
          @click="hexValue = color"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 颜色选择器工具 - 主组件
 * HEX/RGB/HSL 三格式互转 + 原生取色 + 快捷色板
 */
import type { Plugin } from "siyuan"
import { computed, ref } from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import {
  formatHsl,
  formatRgb,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
} from "./utils/color"

interface Props {
  plugin: Plugin
  i18n: Record<string, any>
}

const props = defineProps<Props>()

const hexValue = ref("#e67e22")

/** 快捷色板预设 */
const PALETTE = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#9b59b6", "#34495e", "#ecf0f1", "#95a5a6",
  "#d35400", "#c0392b", "#27ae60", "#2980b9", "#8e44ad",
]

const rgb = computed(() => hexToRgb(hexValue.value) ?? { r: 230, g: 126, b: 34 })
const hsl = computed(() => rgbToHsl(rgb.value))
const rgbString = computed(() => formatRgb(rgb.value))
const hslString = computed(() => formatHsl(hsl.value))

const onNativePick = (e: Event) => {
  hexValue.value = (e.target as HTMLInputElement).value
}

const onHexInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value.trim()
  if (hexToRgb(val)) hexValue.value = val.startsWith("#") ? val : `#${val}`
}

const copy = (text: string) => {
  copyToClipboard(text)
}
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
