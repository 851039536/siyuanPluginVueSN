<template>
  <div class="filter-settings">
    <h4>{{ title }}</h4>
    <div class="setting-group">
      <label>{{ grayscaleLabel }}: {{ modelValue.grayscale }}%</label>
      <input type="range" :value="modelValue.grayscale" @input="update('grayscale', $event)" min="0" max="100" step="5" class="quality-slider" />
    </div>
    <div class="setting-group">
      <label>{{ blurLabel }}: {{ modelValue.blur }}px</label>
      <input type="range" :value="modelValue.blur" @input="update('blur', $event)" min="0" max="20" step="1" class="quality-slider" />
    </div>
    <div class="setting-group">
      <label>{{ brightnessLabel }}: {{ modelValue.brightness }}%</label>
      <input type="range" :value="modelValue.brightness" @input="update('brightness', $event)" min="50" max="150" step="5" class="quality-slider" />
    </div>
    <div class="setting-group">
      <label>{{ contrastLabel }}: {{ modelValue.contrast }}%</label>
      <input type="range" :value="modelValue.contrast" @input="update('contrast', $event)" min="50" max="150" step="5" class="quality-slider" />
    </div>
    <div class="setting-group">
      <label>{{ saturationLabel }}: {{ modelValue.saturation }}%</label>
      <input type="range" :value="modelValue.saturation" @input="update('saturation', $event)" min="0" max="200" step="5" class="quality-slider" />
    </div>
    <div class="setting-group">
      <Button variant="ghost" size="small" @click="$emit('reset')">
        {{ resetText }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'

export interface FilterSettings {
  grayscale: number
  blur: number
  brightness: number
  contrast: number
  saturation: number
}

interface Props {
  modelValue: FilterSettings
  title: string
  grayscaleLabel: string
  blurLabel: string
  brightnessLabel: string
  contrastLabel: string
  saturationLabel: string
  resetText: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: FilterSettings]
  reset: []
}>()

const update = (key: keyof FilterSettings, event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', { ...props.modelValue, [key]: Number(target.value) })
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
