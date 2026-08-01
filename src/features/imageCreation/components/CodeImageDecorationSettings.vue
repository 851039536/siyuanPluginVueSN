<!-- 代码图片装饰选项（水印/作者/时间戳 + 高级样式），自包含读写 service.state -->
<template>
  <div class="config-section">
    <div
      class="decoration-header"
      @click="s.showDecorations = !s.showDecorations"
    >
      <!-- 折叠标题："装饰选项" -->
      <span class="decoration-title-text">{{ t.decorationsLabel }}</span>
      <IconWrapper
        :name="s.showDecorations ? 'chevronUp' : 'chevronDown'"
        :size="14"
        class="decoration-chevron"
        :class="{ expanded: s.showDecorations }"
      />
    </div>

    <div
      v-if="s.showDecorations"
      class="decoration-body"
    >
      <!-- 水印 -->
      <div class="deco-row">
        <Switch
          :model-value="s.enableWatermark"
          :label="t.showWatermark"
          size="xsmall"
          @update:model-value="s.enableWatermark = $event"
        />
        <input
          v-if="s.enableWatermark"
          v-model="s.watermarkText"
          class="deco-input"
          :placeholder="t.watermarkTextPlaceholder"
        />
      </div>
      <!-- 作者 -->
      <div class="deco-row">
        <Switch
          :model-value="s.enableAuthor"
          :label="t.showAuthor"
          size="xsmall"
          @update:model-value="s.enableAuthor = $event"
        />
        <input
          v-if="s.enableAuthor"
          v-model="s.authorName"
          class="deco-input"
          :placeholder="t.authorPlaceholder"
        />
      </div>
      <!-- 时间戳 -->
      <div class="deco-row">
        <Switch
          :model-value="s.enableTimestamp"
          :label="t.showTimestamp"
          size="xsmall"
          @update:model-value="s.enableTimestamp = $event"
        />
      </div>

      <!-- 高级样式 -->
      <div class="deco-group-title">
        <!-- 分组标题："高级样式" -->
        {{ t.advancedStyles }}
      </div>
      <div class="deco-slider-row">
        <!-- 滑块标签："边框宽度" -->
        <span class="deco-slider-label">{{ t.borderWidth }}</span>
        <input
          :value="s.borderWidth"
          type="range"
          min="0"
          max="10"
          step="1"
          class="mini-slider"
          @input="s.borderWidth = Number(($event.target as HTMLInputElement).value)"
        />
        <span class="deco-slider-val">{{ s.borderWidth }}px</span>
      </div>
      <div class="deco-slider-row">
        <!-- 滑块标签："圆角" -->
        <span class="deco-slider-label">{{ t.borderRadius }}</span>
        <input
          :value="s.borderRadius"
          type="range"
          min="0"
          max="32"
          step="2"
          class="mini-slider"
          @input="s.borderRadius = Number(($event.target as HTMLInputElement).value)"
        />
        <span class="deco-slider-val">{{ s.borderRadius }}px</span>
      </div>
      <div class="deco-slider-row">
        <!-- 滑块标签："内边距" -->
        <span class="deco-slider-label">{{ t.paddingSize }}</span>
        <input
          :value="s.paddingSize"
          type="range"
          min="0"
          max="48"
          step="4"
          class="mini-slider"
          @input="s.paddingSize = Number(($event.target as HTMLInputElement).value)"
        />
        <span class="deco-slider-val">{{ s.paddingSize }}px</span>
      </div>
      <div class="deco-slider-row">
        <!-- 滑块标签："背景透明度" -->
        <span class="deco-slider-label">{{ t.backgroundOpacity }}</span>
        <input
          :value="s.backgroundOpacity"
          type="range"
          min="0"
          max="100"
          step="5"
          class="mini-slider"
          @input="s.backgroundOpacity = Number(($event.target as HTMLInputElement).value)"
        />
        <span class="deco-slider-val">{{ s.backgroundOpacity }}%</span>
      </div>
      <div class="deco-slider-row">
        <!-- 滑块标签："阴影强度" -->
        <span class="deco-slider-label">{{ t.shadowIntensity }}</span>
        <input
          :value="s.shadowIntensity"
          type="range"
          min="0"
          max="100"
          step="10"
          class="mini-slider"
          @input="s.shadowIntensity = Number(($event.target as HTMLInputElement).value)"
        />
        <span class="deco-slider-val">{{ s.shadowIntensity }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 代码图片装饰选项：水印/作者/时间戳 + 高级样式（自包含读写 service.state）
 */
import type { ImageCreationI18n } from "../types"
import type { useCodeImageGenerator } from "../composables/useCodeImageGenerator"
import IconWrapper from "@/components/IconWrapper.vue"
import Switch from "@/components/Switch.vue"
import { usePlugin } from "@/main"

interface Props {
  service: ReturnType<typeof useCodeImageGenerator>
}

const props = defineProps<Props>()

const s = props.service.state

const plugin = usePlugin()
const t = (plugin.i18n as Record<string, any>).imageCreation as ImageCreationI18n
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
