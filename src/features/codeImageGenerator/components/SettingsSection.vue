<template>
  <div class="settings-section">
    <div class="settings-row">
      <!-- 内容类型 -->
      <div class="setting-item">
        <label class="setting-label">{{ contentTypeLabel }}</label>
        <Select
          :model-value="contentType"
          :options="contentTypeOptions"
          size="small"
          @update:model-value="onContentTypeChange"
        />
      </div>

      <!-- 语言选择(代码模式) -->
      <div
        v-if="contentType === 'code'"
        class="setting-item"
      >
        <label class="setting-label">{{ languageLabel }}</label>
        <Select
          :model-value="selectedLanguage"
          :options="languageOptions"
          size="small"
          @update:model-value="onLanguageChange"
        />
      </div>

      <!-- 风格选择 -->
      <div class="setting-item">
        <label class="setting-label">{{ styleLabel }}</label>
        <Select
          :model-value="selectedStyle"
          :options="styleOptions"
          size="small"
          @update:model-value="onStyleChange"
        />
      </div>
    </div>

    <div class="settings-row">
      <!-- 主题选择 -->
      <div class="setting-item">
        <label class="setting-label">{{ themeLabel }}</label>
        <Select
          :model-value="selectedTheme"
          :options="themeOptions"
          size="small"
          @update:model-value="onThemeChange"
        />
      </div>

      <!-- 字体大小 -->
      <div class="setting-item">
        <label class="setting-label">{{ fontSizeLabel }}</label>
        <div class="size-control">
          <button
            class="size-btn"
            tabindex="-1"
            @click="onStep(-1)"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
            ><path
              d="M7 2L3 5L7 8"
              stroke="currentColor"
              stroke-width="1.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg>
          </button>
          <div
            ref="sliderRef"
            class="size-slider"
            @mousedown="onDragStart"
            @touchstart.prevent="onTouchStart"
          >
            <div class="size-track" />
            <div
              class="size-fill"
              :style="{ width: `${percent}%` }"
            />
            <div
              class="size-thumb"
              :style="{ left: `${percent}%` }"
            />
          </div>
          <button
            class="size-btn"
            tabindex="-1"
            @click="onStep(1)"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
            ><path
              d="M3 2L7 5L3 8"
              stroke="currentColor"
              stroke-width="1.5"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg>
          </button>
          <span class="size-value">{{ fontSize }}px</span>
        </div>
      </div>
    </div>

    <!-- 装饰选项插槽 -->
    <slot name="decorations" />
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import {
  computed,
  ref,
} from "vue"
import Select from "@/components/Select.vue"

interface Props {
  contentType: "code" | "text"
  selectedLanguage: string
  selectedStyle: string
  selectedTheme: string
  fontSize: number
  contentTypeLabel: string
  languageLabel: string
  styleLabel: string
  themeLabel: string
  fontSizeLabel: string
  contentTypeOptions: SelectOption[]
  languageOptions: SelectOption[]
  styleOptions: SelectOption[]
  themeOptions: SelectOption[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  "update:contentType": [value: string]
  "update:selectedLanguage": [value: string]
  "update:selectedStyle": [value: string]
  "update:selectedTheme": [value: string]
  "update:fontSize": [value: number]
}>()

const MIN = 12
const MAX = 60

const sliderRef = ref<HTMLDivElement>()

const percent = computed(() =>
  ((props.fontSize - MIN) / (MAX - MIN)) * 100,
)

const clamp = (v: number) => Math.round(Math.min(MAX, Math.max(MIN, v)))

const setValueFromX = (clientX: number) => {
  const el = sliderRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  emit("update:fontSize", clamp(MIN + ratio * (MAX - MIN)))
}

const onStep = (delta: number) => {
  emit("update:fontSize", clamp(props.fontSize + delta))
}

// --- drag (mouse) ---
const onDragStart = (e: MouseEvent) => {
  setValueFromX(e.clientX)
  const onMove = (ev: MouseEvent) => setValueFromX(ev.clientX)
  const onUp = () => {
    window.removeEventListener("mousemove", onMove)
    window.removeEventListener("mouseup", onUp)
  }
  window.addEventListener("mousemove", onMove)
  window.addEventListener("mouseup", onUp)
}

// --- drag (touch) ---
const onTouchStart = (e: TouchEvent) => {
  setValueFromX(e.touches[0].clientX)
  const onMove = (ev: TouchEvent) => {
    ev.preventDefault()
    setValueFromX(ev.touches[0].clientX)
  }
  const onEnd = () => {
    window.removeEventListener("touchmove", onMove)
    window.removeEventListener("touchend", onEnd)
  }
  window.addEventListener("touchmove", onMove, { passive: false })
  window.addEventListener("touchend", onEnd)
}

const onContentTypeChange = (value: string) =>
  emit("update:contentType", value)
const onLanguageChange = (value: string) =>
  emit("update:selectedLanguage", value)
const onStyleChange = (value: string) => emit("update:selectedStyle", value)
const onThemeChange = (value: string) => emit("update:selectedTheme", value)
</script>

<style scoped lang="scss">
@use "../styles/index.scss";

.size-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.size-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }

  &:active {
    background: var(--b3-theme-surface);
  }
}

.size-slider {
  position: relative;
  flex: 1;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  touch-action: none;
}

.size-track {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 2px;
  background: var(--b3-theme-surface-lighter);
}

.size-fill {
  position: absolute;
  left: 0;
  height: 3px;
  border-radius: 2px;
  background: var(--b3-theme-primary);
  pointer-events: none;
}

.size-thumb {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transform: translateX(-50%);
  pointer-events: none;
}

.size-value {
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  min-width: 38px;
  text-align: right;
  flex-shrink: 0;
}
</style>
