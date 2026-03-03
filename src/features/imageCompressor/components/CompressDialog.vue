<template>
  <div class="compress-dialog-overlay" @click="onCancel">
    <div class="compress-dialog" @click.stop>
      <div class="dialog-header">
        <h3>{{ i18n.compress }}</h3>
        <button class="close-btn" @click="onCancel">
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
            hint="建议: 80% 可获得良好的压缩率和质量平衡"
            @update:model-value="(v) => options.quality = v"
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
            hint="超过此大小的图片将被压缩"
            @update:model-value="(v) => options.maxSizeMB = v"
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
            hint="超过此尺寸的图片将被等比缩放"
            @update:model-value="(v) => options.maxWidthOrHeight = v"
          />
        </div>

        <div class="setting-item">
          <SiSwitch
            v-model="options.useWebWorker"
            label="使用 Web Worker (推荐)"
          />
          <div class="hint-text">在后台线程处理，不阻塞界面</div>
        </div>

        <div class="statistics-preview" v-if="selectedCount > 0">
          <div class="stat-row">
            <span>已选择图片:</span>
            <span class="stat-value">{{ selectedCount }} 张</span>
          </div>
          <div class="stat-row">
            <span>预计压缩时间:</span>
            <span class="stat-value">{{ estimatedTime }}</span>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <SiButton variant="secondary" @click="onCancel">
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
import { ref, computed } from 'vue'
import type { CompressOptions } from '../types'
import { DEFAULT_COMPRESS_OPTIONS } from '../services/compressor'
import SiButton from '@/components/Button.vue'
import SiSlider from '@/components/Slider.vue'
import SiSwitch from '@/components/Switch.vue'

interface Props {
  i18n: any
  selectedCount: number
}

interface Emits {
  (e: 'confirm', options: CompressOptions): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const options = ref<CompressOptions>({
  ...DEFAULT_COMPRESS_OPTIONS
})

const estimatedTime = computed(() => {
  if (props.selectedCount === 0) return '0秒'
  const seconds = props.selectedCount * 1.5
  if (seconds < 60) return `约 ${Math.ceil(seconds)} 秒`
  const minutes = Math.ceil(seconds / 60)
  return `约 ${minutes} 分钟`
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
  emit('confirm', options.value)
}

const onCancel = () => {
  emit('cancel')
}
</script>

<style scoped lang="scss">
@use '../styles/index.scss' as *;

.compress-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  pointer-events: auto;
}

.compress-dialog {
  width: 90%;
  max-width: 500px;
  background: var(--b3-theme-background);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  pointer-events: auto;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color);

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--b3-theme-on-background);
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }

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
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--b3-theme-on-background);

    &:last-child {
      margin-bottom: 0;
    }

    .stat-value {
      font-weight: 600;
      color: var(--b3-theme-primary);
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--b3-border-color);
}
</style>
