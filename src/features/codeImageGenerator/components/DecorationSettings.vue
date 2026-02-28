<template>
  <div class="decoration-section">
    <div class="decoration-header" @click="emit('toggle')">
      <span class="decoration-title">{{ title }}</span>
      <IconWrapper
        :name="expanded ? 'chevronUp' : 'chevronDown'"
        :size="16"
        class="decoration-toggle"
        :class="{ expanded }"
      />
    </div>
    <div v-if="expanded" class="decoration-options">
      <!-- 水印、作者、时间 -->
      <div class="decoration-group">
        <div class="decoration-group-title">{{ metadataTitle }}</div>
        <div class="decoration-row">
          <Switch
            :model-value="enableWatermark"
            @update:model-value="onWatermarkEnableChange"
            :label="watermarkLabel"
            size="small"
          />
          <Input
            v-if="enableWatermark"
            :model-value="watermarkText"
            @update:model-value="onWatermarkTextChange"
            size="small"
            :placeholder="watermarkPlaceholder"
          />
        </div>
        <div class="decoration-row">
          <Switch
            :model-value="enableAuthor"
            @update:model-value="onAuthorEnableChange"
            :label="authorLabel"
            size="small"
          />
          <Input
            v-if="enableAuthor"
            :model-value="authorName"
            @update:model-value="onAuthorNameChange"
            size="small"
            :placeholder="authorPlaceholder"
          />
        </div>
        <div class="decoration-row">
          <Switch
            :model-value="enableTimestamp"
            @update:model-value="onTimestampEnableChange"
            :label="timestampLabel"
            size="small"
          />
        </div>
      </div>

      <!-- 高级样式 -->
      <div class="decoration-group">
        <div class="decoration-group-title">{{ advancedStyleTitle }}</div>

        <div class="decoration-slider-row">
          <label class="slider-label">{{ borderWidthLabel }}</label>
          <div class="slider-control">
            <input
              :value="borderWidth"
              @input="onBorderWidthChange"
              type="range"
              min="0"
              max="10"
              step="1"
              class="mini-slider"
            />
            <span class="slider-value">{{ borderWidth }}px</span>
          </div>
        </div>

        <div class="decoration-slider-row">
          <label class="slider-label">{{ borderRadiusLabel }}</label>
          <div class="slider-control">
            <input
              :value="borderRadius"
              @input="onBorderRadiusChange"
              type="range"
              min="0"
              max="32"
              step="2"
              class="mini-slider"
            />
            <span class="slider-value">{{ borderRadius }}px</span>
          </div>
        </div>

        <div class="decoration-slider-row">
          <label class="slider-label">{{ paddingLabel }}</label>
          <div class="slider-control">
            <input
              :value="paddingSize"
              @input="onPaddingSizeChange"
              type="range"
              min="0"
              max="48"
              step="4"
              class="mini-slider"
            />
            <span class="slider-value">{{ paddingSize }}px</span>
          </div>
        </div>

        <div class="decoration-slider-row">
          <label class="slider-label">{{ opacityLabel }}</label>
          <div class="slider-control">
            <input
              :value="backgroundOpacity"
              @input="onOpacityChange"
              type="range"
              min="0"
              max="100"
              step="5"
              class="mini-slider"
            />
            <span class="slider-value">{{ backgroundOpacity }}%</span>
          </div>
        </div>

        <div class="decoration-slider-row">
          <label class="slider-label">{{ shadowLabel }}</label>
          <div class="slider-control">
            <input
              :value="shadowIntensity"
              @input="onShadowChange"
              type="range"
              min="0"
              max="100"
              step="10"
              class="mini-slider"
            />
            <span class="slider-value">{{ shadowIntensity }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/Input.vue'
import Switch from '@/components/Switch.vue'
import IconWrapper from '@/components/IconWrapper.vue'

interface Props {
  expanded: boolean
  title: string
  metadataTitle: string
  advancedStyleTitle: string
  enableWatermark: boolean
  watermarkText: string
  watermarkLabel: string
  watermarkPlaceholder: string
  enableAuthor: boolean
  authorName: string
  authorLabel: string
  authorPlaceholder: string
  enableTimestamp: boolean
  timestampLabel: string
  borderWidth: number
  borderWidthLabel: string
  borderRadius: number
  borderRadiusLabel: string
  paddingSize: number
  paddingLabel: string
  backgroundOpacity: number
  opacityLabel: string
  shadowIntensity: number
  shadowLabel: string
}

defineProps<Props>()
const emit = defineEmits<{
  toggle: []
  'update:enableWatermark': [value: boolean]
  'update:watermarkText': [value: string]
  'update:enableAuthor': [value: boolean]
  'update:authorName': [value: string]
  'update:enableTimestamp': [value: boolean]
  'update:borderWidth': [value: number]
  'update:borderRadius': [value: number]
  'update:paddingSize': [value: number]
  'update:backgroundOpacity': [value: number]
  'update:shadowIntensity': [value: number]
}>()

// 事件处理函数
const onWatermarkEnableChange = (value: boolean) => emit('update:enableWatermark', value)
const onWatermarkTextChange = (value: string) => emit('update:watermarkText', value)
const onAuthorEnableChange = (value: boolean) => emit('update:enableAuthor', value)
const onAuthorNameChange = (value: string) => emit('update:authorName', value)
const onTimestampEnableChange = (value: boolean) => emit('update:enableTimestamp', value)
const onBorderWidthChange = (e: Event) => emit('update:borderWidth', Number((e.target as HTMLInputElement).value))
const onBorderRadiusChange = (e: Event) => emit('update:borderRadius', Number((e.target as HTMLInputElement).value))
const onPaddingSizeChange = (e: Event) => emit('update:paddingSize', Number((e.target as HTMLInputElement).value))
const onOpacityChange = (e: Event) => emit('update:backgroundOpacity', Number((e.target as HTMLInputElement).value))
const onShadowChange = (e: Event) => emit('update:shadowIntensity', Number((e.target as HTMLInputElement).value))
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
