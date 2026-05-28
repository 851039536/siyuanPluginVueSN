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
            :hint="i18n.qualityHint || '建议: 80% 可获得良好的压缩率和质量平衡'"
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
            :hint="i18n.maxSizeHint || '超过此大小的图片将被压缩'"
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
            :hint="i18n.maxDimensionHint || '超过此尺寸的图片将被等比缩放'"
            @update:model-value="(v) => { if (v !== null) options.maxWidthOrHeight = v }"
          />
        </div>

        <div class="setting-item">
          <SiSwitch
            v-model="options.useWebWorker"
            :label="i18n.webWorkerLabel || '使用 Web Worker (推荐)'"
          />
          <div class="hint-text">
            {{ i18n.webWorkerHint || "在后台线程处理，不阻塞界面" }}
          </div>
        </div>

        <div
          v-if="selectedCount > 0"
          class="statistics-preview"
        >
          <div class="stat-row">
            <span>{{ i18n.selectedImagesLabel || "已选择图片:" }}</span>
            <span class="stat-value">{{ selectedCount }} 张</span>
          </div>
          <div class="stat-row">
            <span>{{ i18n.estimatedTimeLabel || "预计压缩时间:" }}</span>
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
  const s = props.i18n.second || "秒"
  const m = props.i18n.minute || "分钟"
  if (props.selectedCount === 0) return `0${s}`
  const seconds = props.selectedCount * 1.5
  if (seconds < 60) return `约 ${Math.ceil(seconds)} ${s}`
  const minutes = Math.ceil(seconds / 60)
  return `约 ${minutes} ${m}`
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
@use '../styles/index.scss' as *;

.compress-dialog-overlay {
  @include flex-center;
  @include overlay-base;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10000;
}

.compress-dialog {
  width: 90%;
  max-width: 500px;
  @include dialog-base;
}

.dialog-header {
  @include header-base;

  h3 {
    font-size: 18px;
  }

  .close-btn {
    @include button-base;
    padding: 4px;

    .icon {
      width: 20px;
      height: 20px;
    }
  }
}

.dialog-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.setting-item {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.hint-text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  opacity: 0.7;
}

.statistics-preview {
  margin-top: 20px;
  padding: 16px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  border-left: 3px solid var(--b3-theme-primary);

  .stat-row {
    @include stat-row-base;
  }
}

.dialog-footer {
  @include footer-base;
}
</style>
