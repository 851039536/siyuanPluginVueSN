<!-- 封面装饰设置：自定义主题色 + 水印 + Logo 角标（自包含，直接读写共享设置服务） -->
<template>
  <div class="config-section">
    <div
      class="decoration-header"
      @click="expanded = !expanded"
    >
      <!-- 折叠标题："封面装饰设置" -->
      <span class="decoration-title-text">{{ t.decorationSettings }}</span>
      <IconWrapper
        :name="expanded ? 'chevronUp' : 'chevronDown'"
        :size="14"
        class="decoration-chevron"
        :class="{ expanded }"
      />
    </div>

    <div
      v-if="expanded"
      class="decoration-body"
    >
      <!-- 自定义主题色 -->
      <div class="deco-group-title">
        <!-- 分组标题："自定义主题色" -->
        {{ t.colorGroup }}
      </div>
      <div class="deco-row">
        <Switch
          :model-value="s.colors.enabled"
          :label="t.colorEnable"
          size="xsmall"
          @update:model-value="s.colors.enabled = $event"
        />
        <Button
          variant="ghost"
          size="xsmall"
          :disabled="!s.colors.enabled"
          @click="resetColors"
        >
          <!-- 按钮文案："恢复默认" -->
          {{ t.colorReset }}
        </Button>
      </div>
      <div
        v-if="s.colors.enabled"
        class="color-rows"
      >
        <label class="color-row">
          <!-- 颜色项："背景色" -->
          <span>{{ t.colorBg }}</span>
          <input
            v-model="s.colors.bg"
            type="color"
          />
        </label>
        <label class="color-row">
          <!-- 颜色项："标题色" -->
          <span>{{ t.colorTitle }}</span>
          <input
            v-model="s.colors.titleColor"
            type="color"
          />
        </label>
        <label class="color-row">
          <!-- 颜色项："强调色" -->
          <span>{{ t.colorAccent }}</span>
          <input
            v-model="s.colors.accent"
            type="color"
          />
        </label>
      </div>

      <!-- 水印 -->
      <div class="deco-group-title">
        <!-- 分组标题："水印" -->
        {{ t.watermarkGroup }}
      </div>
      <div class="deco-row">
        <Switch
          :model-value="s.watermark.enabled"
          :label="t.showWatermark"
          size="xsmall"
          @update:model-value="s.watermark.enabled = $event"
        />
        <input
          v-if="s.watermark.enabled"
          v-model="s.watermark.text"
          class="deco-input"
          :placeholder="t.watermarkTextPlaceholder"
        />
      </div>
      <div
        v-if="s.watermark.enabled"
        class="deco-slider-row"
      >
        <!-- 位置标签："位置" -->
        <span class="deco-slider-label">{{ t.positionLabel }}</span>
        <Select
          v-model="s.watermark.position"
          :options="watermarkPositionOptions"
          size="xsmall"
        />
      </div>
      <div
        v-if="s.watermark.enabled"
        class="deco-slider-row"
      >
        <Slider
          v-model="s.watermark.opacity"
          :label="t.opacityLabel"
          :min="0"
          :max="100"
          :step="5"
          size="xsmall"
          :show-value="true"
          :format-value="percentFormat"
        />
      </div>

      <!-- Logo 角标 -->
      <div class="deco-group-title">
        <!-- 分组标题："Logo 角标" -->
        {{ t.logoGroup }}
      </div>
      <div class="deco-row">
        <Switch
          :model-value="s.logo.enabled"
          :label="t.logoEnable"
          size="xsmall"
          @update:model-value="onLogoEnableToggle"
        />
        <Button
          variant="ghost"
          size="xsmall"
          icon="upload"
          :title="t.logoUpload"
          @click="triggerFileInput"
        />
        <Button
          v-if="s.logo.path"
          variant="ghost"
          size="xsmall"
          icon="delete"
          :title="t.logoRemove"
          @click="removeLogo"
        />
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        @change="onFileChange"
      />
      <img
        v-if="logoDataUrl"
        class="logo-thumb"
        :src="logoDataUrl"
        alt="logo"
      />
      <div
        v-if="s.logo.enabled && !s.logo.path"
        class="logo-empty-hint"
      >
        <!-- 空提示："未设置 Logo" -->
        {{ t.logoEmptyHint }}
      </div>
      <div
        v-if="s.logo.enabled && s.logo.path"
        class="deco-slider-row"
      >
        <!-- 位置标签："位置" -->
        <span class="deco-slider-label">{{ t.positionLabel }}</span>
        <Select
          v-model="s.logo.position"
          :options="logoPositionOptions"
          size="xsmall"
        />
      </div>
      <div
        v-if="s.logo.enabled && s.logo.path"
        class="deco-slider-row"
      >
        <Slider
          v-model="s.logo.size"
          :label="t.logoSize"
          :min="16"
          :max="200"
          :step="4"
          size="xsmall"
          :show-value="true"
          :format-value="sizeFormat"
        />
      </div>
      <div
        v-if="s.logo.enabled && s.logo.path"
        class="deco-slider-row"
      >
        <Slider
          v-model="s.logo.opacity"
          :label="t.opacityLabel"
          :min="0"
          :max="100"
          :step="5"
          size="xsmall"
          :show-value="true"
          :format-value="percentFormat"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 封面装饰设置：自定义主题色 + 水印 + Logo 角标
 * 自包含：直接读写共享的 CoverSettingsService，无中间人 emit
 */
import type { SelectOption } from "@/components/Select.vue"
import type { ImageCreationI18n, WatermarkPosition } from "../types"
import type { CoverSettingsService } from "../composables/useCoverSettings"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Select from "@/components/Select.vue"
import Slider from "@/components/Slider.vue"
import Switch from "@/components/Switch.vue"
import { usePlugin } from "@/main"
import { LOGO_POSITIONS, WATERMARK_POSITIONS } from "../types"
import { DEFAULT_COVER_SETTINGS } from "../types/storage"

interface Props {
  /** 封面设置服务（CoverTab 创建的同一实例） */
  service: CoverSettingsService
}

const props = defineProps<Props>()

const s = props.service.settings
const logoDataUrl = props.service.logoDataUrl
const {
  uploadLogo,
  removeLogo,
} = props.service

const plugin = usePlugin()
const t = (plugin.i18n as Record<string, any>).imageCreation as ImageCreationI18n

const expanded = ref(false)
const fileInput = ref<HTMLInputElement>()

// 位置选项单一数据源：类型常量 WATERMARK_POSITIONS / LOGO_POSITIONS + i18n 标签映射
const positionLabelMap: Record<WatermarkPosition, string> = {
  bottomLeft: t.positionBottomLeft,
  bottomRight: t.positionBottomRight,
  topLeft: t.positionTopLeft,
  topRight: t.positionTopRight,
  center: t.positionCenter,
}
const watermarkPositionOptions: SelectOption[] = WATERMARK_POSITIONS.map((p) => ({
  value: p,
  label: positionLabelMap[p],
}))
const logoPositionOptions: SelectOption[] = LOGO_POSITIONS.map((p) => ({
  value: p,
  label: positionLabelMap[p],
}))

/** 恢复主题色为默认调色板（保留启用状态） */
function resetColors() {
  s.value.colors.bg = DEFAULT_COVER_SETTINGS.colors.bg
  s.value.colors.titleColor = DEFAULT_COVER_SETTINGS.colors.titleColor
  s.value.colors.accent = DEFAULT_COVER_SETTINGS.colors.accent
}

function onLogoEnableToggle(value: boolean) {
  s.value.logo.enabled = value
  // 启用但尚未设置图片时直接弹出文件选择
  if (value && !s.value.logo.path) {
    triggerFileInput()
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    void uploadLogo(file)
  }
  // 清空以允许再次选择同一文件
  input.value = ""
}

const percentFormat = (v: number) => `${v}%`
const sizeFormat = (v: number) => `${v}px`
</script>

<style scoped lang="scss">
@use "../styles/CoverDecorationSettings.scss";
@use "../styles/index.scss";
</style>
