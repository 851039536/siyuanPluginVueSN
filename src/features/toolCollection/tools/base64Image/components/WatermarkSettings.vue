<template>
  <div class="watermark-settings">
    <h4>{{ title }}</h4>
    <div class="setting-group">
      <label class="checkbox-label">
        <input
          type="checkbox"
          :checked="modelValue.enabled"
          @change="update('enabled', ($event.target as HTMLInputElement).checked)"
        />
        {{ enableText }}
      </label>
    </div>
    <template v-if="modelValue.enabled">
      <div class="setting-group">
        <input
          type="text"
          :value="modelValue.text"
          :placeholder="textPlaceholder"
          class="text-input"
          @input="update('text', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="setting-group">
        <Select
          :label="positionLabel"
          :options="positionOptions"
          :model-value="modelValue.position"
          size="xsmall"
          @update:model-value="update('position', $event)"
        />
      </div>
      <div class="setting-group">
        <label>{{ opacityLabel }}: {{ modelValue.opacity }}%</label>
        <input
          type="range"
          :value="modelValue.opacity"
          min="10"
          max="100"
          step="5"
          class="quality-slider"
          @input="update('opacity', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="setting-group">
        <label>{{ fontSizeLabel }}: {{ modelValue.fontSize }}px</label>
        <input
          type="range"
          :value="modelValue.fontSize"
          min="12"
          max="72"
          step="2"
          class="quality-slider"
          @input="update('fontSize', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import Select from "@/components/Select.vue"

export interface WatermarkSettings {
  enabled: boolean
  text: string
  position: string
  opacity: number
  fontSize: number
}

interface Props {
  modelValue: WatermarkSettings
  title: string
  enableText: string
  textPlaceholder: string
  positionLabel: string
  positionOptions: SelectOption[]
  opacityLabel: string
  fontSizeLabel: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  "update:modelValue": [value: WatermarkSettings]
}>()

const update = (
  key: keyof WatermarkSettings,
  value: string | number | boolean | null,
) => {
  if (value === null) return
  emit("update:modelValue", {
    ...props.modelValue,
    [key]: value,
  })
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
