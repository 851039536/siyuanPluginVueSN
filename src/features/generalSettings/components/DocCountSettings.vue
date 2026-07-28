<!-- 文档数统计设置：开关、更新间隔、字体样式与显示格式配置；Manager 生命周期经 GeneralSettings 公开方法统一管理 -->
<template>
  <div class="doc-count-settings">
    <!-- 功能开关标题："笔记本文档数统计" -->
    <SettingLabel
      icon="statistics"
      :text="t.title"
      class="panel-title"
    />
    <SiSwitch
      v-model="enableDocCount"
      @change="handleToggleChange"
    />
    <!-- 开关描述："在笔记本名称后显示文档数量" -->
    <p class="toggle-description">
      {{ t.description }}
    </p>

    <!-- 功能说明卡片 -->
    <div class="feature-description">
      <!-- 卡片标题："功能说明" -->
      <SettingLabel
        icon="lightbulb"
        :text="t.featureTitle"
        class="panel-title"
      />
      <!-- 功能点列表 -->
      <ul class="description-list">
        <li>{{ t.feature1 }}</li>
        <li>{{ t.feature2 }}</li>
        <li>{{ t.feature3 }}</li>
      </ul>
    </div>

    <!-- 更新间隔卡片 -->
    <div class="update-interval">
      <!-- 标签："更新间隔" -->
      <label class="interval-label">
        {{ t.updateInterval }}
      </label>
      <!-- 间隔选项："30分钟" / "1小时" / "2小时" / "4小时" -->
      <select
        v-model="updateInterval"
        class="style-select"
        @change="handleIntervalChange"
      >
        <option
          v-for="opt in intervalOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ t[opt.labelKey] }}
        </option>
      </select>
    </div>

    <!-- 字体样式设置卡片 -->
    <div class="font-style-settings">
      <!-- 卡片标题："字体样式设置" -->
      <SettingLabel
        icon="codeBlockColor"
        :text="t.fontStyleSettings"
        class="panel-title"
      />

      <div class="style-row">
        <!-- 标签："字体大小" -->
        <label class="style-label">
          {{ i18n?.fontSize }}
        </label>
        <select
          v-model="fontSize"
          class="style-select"
          @change="handleFontStyleChange"
        >
          <option
            v-for="size in fontSizeOptions"
            :key="size"
            :value="size"
          >
            {{ size }}
          </option>
        </select>
      </div>

      <div class="style-row">
        <!-- 标签："字体颜色" -->
        <label class="style-label">
          {{ t.fontColor }}
        </label>
        <ColorField
          v-model="fontColor"
          placeholder="#8c8c8c"
          @update:model-value="handleFontStyleChange"
        />
      </div>

      <div class="style-row">
        <!-- 标签："字体粗细" -->
        <label class="style-label">
          {{ i18n?.fontWeight }}
        </label>
        <!-- 粗细选项："正常" / "粗体" / "细体" -->
        <select
          v-model="fontWeight"
          class="style-select"
          @change="handleFontStyleChange"
        >
          <option
            v-for="opt in weightOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ t[opt.labelKey] }}
          </option>
        </select>
      </div>

      <div class="style-row">
        <!-- 标签："显示格式" -->
        <label class="style-label">
          {{ i18n?.displayFormat }}
        </label>
        <select
          v-model="displayFormat"
          class="style-select"
          @change="handleDisplayFormatChange"
        >
          <option
            v-for="opt in formatOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="style-row">
        <!-- 标签："透明度" -->
        <label class="style-label">
          {{ i18n?.opacity }}
        </label>
        <SettingSlider
          v-model="opacity"
          :min="0.1"
          :max="1"
          :step="0.05"
          :format-value="formatPercent"
          @update:model-value="handleFontStyleChange"
        />
      </div>

      <!-- 样式预览 -->
      <div class="style-preview">
        <!-- 标签："样式预览" -->
        <label class="style-label">
          {{ t.stylePreview }}
        </label>
        <div class="preview-box">
          <!-- 预览示例文案："我的笔记本" -->
          <span class="preview-text">{{ t.previewSample }}</span>
          <span
            class="preview-count"
            :style="{
              fontSize,
              color: fontColor,
              fontWeight,
              opacity,
            }"
          >{{ previewFormatted }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { GeneralSettings } from "../GeneralSettings"
import type {
  DocCountFormat,
  DocCountSettings,
} from "../types/storage"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import SiSwitch from "@/components/Switch.vue"
import {
  DEFAULT_DOC_COUNT_SETTINGS,
  DOC_COUNT_FORMATTERS,
  GeneralSettingsStorage,
} from "../types/storage"
import ColorField from "./ColorField.vue"
import SettingLabel from "./SettingLabel.vue"
import SettingSlider from "./SettingSlider.vue"

const props = defineProps<{
  i18n?: Record<string, any>
  plugin?: Plugin
}>()

const emit = defineEmits<{
  change: [settings: DocCountSettings]
}>()

// docCount 键组文案
const t = computed(() => props.i18n?.docCount ?? {})

const enableDocCount = ref(DEFAULT_DOC_COUNT_SETTINGS.enableDocCount)
const updateInterval = ref(DEFAULT_DOC_COUNT_SETTINGS.updateInterval)
const displayFormat = ref<DocCountFormat>(DEFAULT_DOC_COUNT_SETTINGS.displayFormat)
const fontSize = ref(DEFAULT_DOC_COUNT_SETTINGS.fontSize)
const fontColor = ref(DEFAULT_DOC_COUNT_SETTINGS.fontColor)
const fontWeight = ref(DEFAULT_DOC_COUNT_SETTINGS.fontWeight)
const opacity = ref(DEFAULT_DOC_COUNT_SETTINGS.opacity)

// ============================================================
// 数据驱动选项列表
// ============================================================
const fontSizeOptions = ["10px", "11px", "12px", "13px", "14px", "15px", "16px"] as const

const intervalOptions = [
  {
    value: "1800000",
    labelKey: "interval30min",
  },
  {
    value: "3600000",
    labelKey: "interval1hour",
  },
  {
    value: "7200000",
    labelKey: "interval2hour",
  },
  {
    value: "14400000",
    labelKey: "interval4hour",
  },
] as const

const weightOptions = [
  {
    value: "normal" as const,
    labelKey: "fontWeightNormal",
  },
  {
    value: "bold" as const,
    labelKey: "fontWeightBold",
  },
  {
    value: "lighter" as const,
    labelKey: "fontWeightLighter",
  },
] as const

/** 显示格式选项——从 DOC_COUNT_FORMATTERS 映射派生示例文案，避免重复维护 */
const formatOptions = (Object.keys(DOC_COUNT_FORMATTERS) as DocCountFormat[]).map(
  (value) => ({
    value,
    label: DOC_COUNT_FORMATTERS[value](123).trim(),
  }),
)

/** 获取插件挂载的 GeneralSettings 实例（只调用其公开方法，不触碰内部字段） */
const getGeneralSettings = (): GeneralSettings | null =>
  (props.plugin as any)?.__generalSettings || null

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

const ensureStorage = (): GeneralSettingsStorage => {
  if (!gsStorage.value) throw new Error("插件实例不可用")
  return gsStorage.value
}

/** 预览用的格式化数字 */
const previewFormatted = computed(() => DOC_COUNT_FORMATTERS[displayFormat.value](123))

/** 透明度滑块数值显示为百分比 */
const formatPercent = (value: number) => `${Math.round(value * 100)}%`

/** 构建保存对象——4 个 handler 复用，消除重复 */
const buildSettings = (): DocCountSettings => ({
  enableDocCount: enableDocCount.value,
  updateInterval: updateInterval.value,
  displayFormat: displayFormat.value,
  fontSize: fontSize.value,
  fontColor: fontColor.value,
  fontWeight: fontWeight.value,
  opacity: opacity.value,
})

const loadSettings = async () => {
  if (!gsStorage.value) return
  try {
    const data = await gsStorage.value.docCount.loadOrDefault()
    enableDocCount.value = data.enableDocCount
    updateInterval.value = data.updateInterval
    displayFormat.value = data.displayFormat
    fontSize.value = data.fontSize
    fontColor.value = data.fontColor
    fontWeight.value = data.fontWeight
    opacity.value = data.opacity
  } catch (e) {
    console.error("加载文档数统计设置失败:", e)
  }
}

/** 保存设置并经 GeneralSettings 公开方法应用到 Manager */
const persistAndApply = async (message: string): Promise<DocCountSettings> => {
  const settings = buildSettings()
  await ensureStorage().docCount.save(settings)
  getGeneralSettings()?.updateDocCount(settings)
  showMessage(message, 2000, "info")
  return settings
}

const handleToggleChange = async () => {
  try {
    const settings = await persistAndApply(
      enableDocCount.value ? t.value.msgEnabled : t.value.msgDisabled,
    )
    emit("change", settings)
  } catch (e) {
    console.error("保存文档数统计设置失败:", e)
  }
}

const handleIntervalChange = async () => {
  try {
    await persistAndApply(t.value.msgIntervalChanged)
  } catch (e) {
    console.error("保存更新间隔失败:", e)
  }
}

const handleFontStyleChange = async () => {
  try {
    await persistAndApply(t.value.msgFontStyleChanged)
  } catch (e) {
    console.error("保存字体样式失败:", e)
  }
}

const handleDisplayFormatChange = async () => {
  try {
    await persistAndApply(t.value.msgFormatChanged)
  } catch (e) {
    console.error("保存显示格式失败:", e)
  }
}

onMounted(loadSettings)
</script>

<style scoped lang="scss">
@use "../styles/DocCountSettings.scss";
@use "../styles/index.scss";
</style>
