<template>
  <div
    class="compress-dialog-overlay"
    @click="onCancel"
  >
    <div
      class="compress-dialog"
      @click.stop
    >
      <div class="dialog-header">
        <h3>{{ i18n.compress }}</h3>
        <button
          class="close-btn"
          @click="onCancel"
        >
          <svg class="icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <div class="dialog-content">
        <div class="setting-item">
          <SiSlider
            :label="i18n.quality"
            :model-value="options.quality"
            :min="0.1"
            :max="1"
            :step="0.1"
            :show-value="true"
            :format-value="formatQuality"
            :hint="i18n.qualityHint"
            @update:model-value="(v) => { if (v !== null) options.quality = v }"
          />
        </div>

        <div class="setting-item">
          <SiSlider
            :label="i18n.maxSize"
            :model-value="options.maxSizeMB"
            :min="0.1"
            :max="10"
            :step="0.1"
            :show-value="true"
            :format-value="formatMaxSize"
            :hint="i18n.maxSizeHint"
            @update:model-value="(v) => { if (v !== null) options.maxSizeMB = v }"
          />
        </div>

        <div class="setting-item">
          <SiSlider
            :label="i18n.maxDimension"
            :model-value="options.maxWidthOrHeight"
            :min="500"
            :max="4000"
            :step="100"
            :show-value="true"
            :format-value="formatMaxDimension"
            :hint="i18n.maxDimensionHint"
            @update:model-value="(v) => { if (v !== null) options.maxWidthOrHeight = v }"
          />
        </div>

        <div class="setting-item">
          <SiSwitch
            v-model="options.useWebWorker"
            :label="i18n.webWorkerLabel"
          />
          <div class="hint-text">
            {{ i18n.webWorkerHint }}
          </div>
        </div>

        <div
          v-if="selectedCount > 0"
          class="statistics-preview"
        >
          <div class="stat-row">
            <span>{{ i18n.selectedImagesLabel }}</span>
            <span class="stat-value">{{ selectedCount }}</span>
          </div>
          <div class="stat-row">
            <span>{{ i18n.estimatedTimeLabel }}</span>
            <span class="stat-value">{{ estimatedTime }}</span>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <SiButton
          variant="secondary"
          @click="onCancel"
        >
          {{ i18n.cancel }}
        </SiButton>
        <SiButton @click="onConfirm">
          {{ i18n.compress }}
        </SiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CompressOptions,
  ImageCompressorI18n,
} from "../types"
import {
  computed,
  ref,
} from "vue"
import SiButton from "@/components/Button.vue"
import SiSlider from "@/components/Slider.vue"
import SiSwitch from "@/components/Switch.vue"
import { DEFAULT_COMPRESS_OPTIONS } from "../services/compressor"

interface Props {
  i18n: ImageCompressorI18n
  selectedCount: number
}

interface Emits {
  (e: "confirm", options: CompressOptions): void
  (e: "cancel"): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const options = ref<CompressOptions>({
  ...DEFAULT_COMPRESS_OPTIONS,
})

const estimatedTime = computed(() => {
  const s = props.i18n.second
  const m = props.i18n.minute
  if (props.selectedCount === 0) return `0${s}`
  const seconds = props.selectedCount * 1.5
  if (seconds < 60) return `~${Math.ceil(seconds)}${s}`
  const minutes = Math.ceil(seconds / 60)
  return `~${minutes}${m}`
})

const formatQuality = (value: number): string => {
  return `${(value * 100).toFixed(0)}%`
}

const formatMaxSize = (value: number): string => {
  return `${value} MB`
}

const formatMaxDimension = (value: number): string => {
  return `${value} px`
}

const onConfirm = () => {
  emit("confirm", options.value)
}

const onCancel = () => {
  emit("cancel")
}
</script>

<style scoped lang="scss">
@use "../styles/CompressDialog.scss" as *;
</style>
