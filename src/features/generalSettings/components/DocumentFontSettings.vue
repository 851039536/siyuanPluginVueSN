<!-- 文档字体设置面板：字体族/字号/行高/字间距/段落间距/字重 + 实时预览 -->
<template>
  <div class="document-font-settings">
    <div class="settings-container">
      <!-- 标题与说明 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="format"
              :size="14"
              class="label-icon"
            />
            <!-- 标题："文档字体设置" -->
            {{ i18n.documentFont }}
          </label>
          <!-- 描述："设置文档内容的字体、字号、行距等样式" -->
          <p class="setting-description">
            {{ i18n.documentFontDesc }}
          </p>
        </div>
      </div>

      <!-- 启用开关 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <!-- 标签："启用文档字体设置" -->
            {{ i18n.enableDocumentFont }}
          </label>
          <div class="toggle-container">
            <SiSwitch v-model="settings.enabled" />
            <!-- 状态文案："已启用" / "已禁用" -->
            <span class="toggle-description">
              {{ settings.enabled ? i18n.enabled : i18n.disabled }}
            </span>
          </div>
        </div>
      </div>

      <template v-if="settings.enabled">
        <!-- 字体族 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <IconWrapper
                name="formatFont"
                :size="13"
                class="label-icon"
              />
              <!-- 标签："字体族" -->
              {{ i18n.fontFamily }}
            </label>
            <div class="input-group">
              <!-- 占位符："输入字体名称，如: Microsoft YaHei, Arial" -->
              <input
                v-model="settings.fontFamily"
                type="text"
                class="text-input font-input"
                :placeholder="i18n.fontFamilyPlaceholder"
              />
              <!-- 占位符："选择字体" -->
              <SiSelect
                v-model="presetFont"
                class="font-select"
                :options="PRESET_FONTS"
                size="small"
                :placeholder="i18n.selectFont"
                @change="applyPresetFont"
              />
            </div>
          </div>
        </div>

        <!-- 数值滑块（字号/行高/字间距/段落间距，元数据驱动） -->
        <div
          v-for="field in SLIDER_FIELDS"
          :key="field.key"
          class="setting-row"
        >
          <div class="setting-item">
            <label class="setting-label">
              <IconWrapper
                :name="field.icon"
                :size="13"
                class="label-icon"
              />
              <!-- 标签："字体大小" / "行高" / "字间距" / "段落间距" -->
              {{ i18n[field.labelKey] }}
            </label>
            <SettingSlider
              v-model="settings[field.key]"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              :format-value="(v: number) => `${v}${field.unit}`"
            />
            <div
              v-if="field.presets"
              class="preset-buttons"
            >
              <button
                v-for="preset in field.presets"
                :key="preset"
                class="preset-btn"
                :class="[{ active: Math.abs(settings[field.key] - preset) < 0.01 }]"
                @click="settings[field.key] = preset"
              >
                {{ preset }}{{ field.unit }}
              </button>
            </div>
          </div>
        </div>

        <!-- 字重 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <IconWrapper
                name="formatBold"
                :size="13"
                class="label-icon"
              />
              <!-- 标签："字体粗细" -->
              {{ i18n.fontWeight }}
            </label>
            <div class="font-weight-options">
              <!-- 按钮："细体" / "正常" / "粗体" -->
              <button
                v-for="weight in FONT_WEIGHTS"
                :key="weight.value"
                class="weight-btn"
                :class="[{ active: settings.fontWeight === weight.value }]"
                @click="settings.fontWeight = weight.value"
              >
                {{ i18n[weight.labelKey] }}
              </button>
            </div>
          </div>
        </div>

        <!-- 预览区域 -->
        <div class="preview-section">
          <div
            class="preview-toggle"
            @click="showPreview = !showPreview"
          >
            <IconWrapper
              class="preview-icon"
              :name="showPreview ? 'eye' : 'eyeOff'"
            />
            <!-- 折叠标题："预览效果" -->
            <span>{{ i18n.preview }}</span>
            <span
              class="toggle-arrow"
              :class="{ expanded: showPreview }"
            >▼</span>
          </div>
          <transition name="preview-expand">
            <div
              v-show="showPreview"
              class="preview-content"
              :style="previewStyle"
            >
              <!-- 预览示例："示例标题" + 三段示例文本 -->
              <h2>{{ i18n.previewSampleTitle }}</h2>
              <p>{{ i18n.previewSampleText1 }}</p>
              <p>{{ i18n.previewSampleText2 }}</p>
              <p>{{ i18n.previewSampleText3 }}</p>
            </div>
          </transition>
        </div>
      </template>

      <!-- 重置按钮 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 按钮："恢复默认设置" -->
          <button
            class="reset-btn"
            @click="resetSettings"
          >
            <IconWrapper
              class="btn-icon"
              name="refresh"
            />
            {{ i18n.resetToDefault }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import type { SelectOption } from "@/components/Select.vue"
import { Plugin } from "siyuan"
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue"

import IconWrapper from "@/components/IconWrapper.vue"
import SiSelect from "@/components/Select.vue"
import SiSwitch from "@/components/Switch.vue"
import {
  DEFAULT_DOCUMENT_FONT_SETTINGS,
  DocumentFontSettings,
  GeneralSettingsStorage,
} from "../types/storage"
import SettingSlider from "./SettingSlider.vue"

interface Props {
  i18n?: Record<string, string>
  plugin?: Plugin
}

interface Emits {
  (e: "change", settings: DocumentFontSettings): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: undefined,
})

const emit = defineEmits<Emits>()

/** 数值型设置字段（对应 SettingSlider 可绑定的键） */
type NumericFontKey = "fontSize" | "lineHeight" | "letterSpacing" | "paragraphSpacing"

interface SliderField {
  key: NumericFontKey
  icon: IconKey
  labelKey: string
  min: number
  max: number
  step: number
  unit: string
  /** 有预设值时渲染快捷按钮组 */
  presets?: number[]
}

/** 滑块行元数据：新增数值设置项时在此单点登记 */
const SLIDER_FIELDS: SliderField[] = [
  { key: "fontSize", icon: "formatSize", labelKey: "fontSize", min: 10, max: 24, step: 1, unit: "px", presets: [12, 14, 16, 18] },
  { key: "lineHeight", icon: "formatLineSpacing", labelKey: "lineHeight", min: 1.2, max: 2.4, step: 0.1, unit: "", presets: [1.4, 1.6, 1.8, 2.0] },
  { key: "letterSpacing", icon: "formatLetterSpacing", labelKey: "letterSpacing", min: 0, max: 5, step: 0.5, unit: "px" },
  { key: "paragraphSpacing", icon: "formatParagraph", labelKey: "paragraphSpacing", min: 0, max: 30, step: 2, unit: "px" },
]

/** 预设字体列表（字体名为专有名词，label 保留原生名称不走 i18n） */
const PRESET_FONTS: SelectOption[] = [
  { value: "Microsoft YaHei", label: "微软雅黑" },
  { value: "Microsoft YaHei Light", label: "微软雅黑 Light" },
  { value: "Segoe UI", label: "Segoe UI" },
  { value: "等线", label: "等线 (DengXian)" },
  { value: "仿宋", label: "仿宋" },
  { value: "华文细黑", label: "华文细黑" },
  { value: "华文黑体", label: "华文黑体" },
  { value: "华文楷体", label: "华文楷体" },
  { value: "华文宋体", label: "华文宋体" },
  { value: "黑体", label: "黑体" },
  { value: "system-ui", label: "system-ui" },
]

/** 字重选项元数据（label 走 i18n 键） */
const FONT_WEIGHTS = [
  { value: "lighter", labelKey: "fontWeightLight" },
  { value: "normal", labelKey: "fontWeightNormal" },
  { value: "bold", labelKey: "fontWeightBold" },
]

const settings = ref<DocumentFontSettings>({ ...DEFAULT_DOCUMENT_FONT_SETTINGS })
const showPreview = ref(true)
const presetFont = ref("")
/** 加载守卫：存储数据回填期间跳过 watch 的 emit/save */
const isLoading = ref(false)

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

const previewStyle = computed(() => ({
  fontFamily: settings.value.fontFamily || "inherit",
  fontSize: `${settings.value.fontSize}px`,
  lineHeight: settings.value.lineHeight,
  letterSpacing: `${settings.value.letterSpacing}px`,
  fontWeight: settings.value.fontWeight,
}))

// 唯一变更出口：emit 交由 GeneralSettings 统一应用样式，本地仅负责持久化
watch(
  settings,
  (newSettings) => {
    if (isLoading.value) {
      return
    }
    emit("change", newSettings)
    saveSettings()
  },
  { deep: true },
)

function applyPresetFont(value: string | number | boolean | null) {
  if (typeof value === "string" && value) {
    settings.value.fontFamily = value
  }
}

function resetSettings() {
  settings.value = { ...DEFAULT_DOCUMENT_FONT_SETTINGS }
  presetFont.value = ""
}

async function loadSettings() {
  if (!gsStorage.value) {
    return
  }

  isLoading.value = true
  try {
    const data = await gsStorage.value.documentFont.load()
    if (data) {
      settings.value = {
        ...DEFAULT_DOCUMENT_FONT_SETTINGS,
        ...data,
      }
    }
  } catch (error) {
    console.error("加载文档字体设置失败:", error)
  } finally {
    // 等待 deep watch 消化回填赋值后再解除守卫
    await nextTick()
    isLoading.value = false
  }
}

async function saveSettings() {
  if (!gsStorage.value) {
    return
  }

  try {
    await gsStorage.value.documentFont.save(settings.value)
  } catch (error) {
    console.error("保存文档字体设置失败:", error)
  }
}

onMounted(async () => {
  await loadSettings()
})
</script>

<style scoped lang="scss">
@use "../styles/DocumentFontSettings.scss";
</style>
