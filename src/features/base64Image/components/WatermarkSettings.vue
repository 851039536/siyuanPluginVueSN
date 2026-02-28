<template>
  <div class="watermark-settings">
    <h4>{{ title }}</h4>
    <div class="setting-group">
      <label class="checkbox-label">
        <input type="checkbox" :checked="modelValue.enabled" @change="update('enabled', ($event.target as HTMLInputElement).checked)" />
        {{ enableText }}
      </label>
    </div>
    <template v-if="modelValue.enabled">
      <div class="setting-group">
        <input
          type="text"
          :value="modelValue.text"
          @input="update('text', ($event.target as HTMLInputElement).value)"
          :placeholder="textPlaceholder"
          class="text-input"
        />
      </div>
      <div class="setting-group">
        <Select
          :label="positionLabel"
          :options="positionOptions"
          :model-value="modelValue.position"
          @update:model-value="update('position', $event)"
          size="small"
        />
      </div>
      <div class="setting-group">
        <label>{{ opacityLabel }}: {{ modelValue.opacity }}%</label>
        <input type="range" :value="modelValue.opacity" @input="update('opacity', Number(($event.target as HTMLInputElement).value))" min="10" max="100" step="5" class="quality-slider" />
      </div>
      <div class="setting-group">
        <label>{{ fontSizeLabel }}: {{ modelValue.fontSize }}px</label>
        <input type="range" :value="modelValue.fontSize" @input="update('fontSize', Number(($event.target as HTMLInputElement).value))" min="12" max="72" step="2" class="quality-slider" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Select from '@/components/Select.vue'
import type { SelectOption } from '@/components/Select.vue'

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
  'update:modelValue': [value: WatermarkSettings]
}>()

const update = (key: keyof WatermarkSettings, value: string | number | boolean) => {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
