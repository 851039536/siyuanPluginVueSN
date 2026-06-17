<template>
  <div class="doc-count-settings">
    <label class="setting-label">
      <span class="label-icon"><IconWrapper name="statistics" :size="14" /></span>
      {{ i18n?.enableDocCount || '笔记本文档数统计' }}
    </label>
    <SiSwitch
      v-model="enableDocCount"
      @change="handleToggleChange"
    />
    <p class="toggle-description">
      {{ i18n?.docCountDescription || '在笔记本名称后显示文档数量' }}
    </p>

    <!-- 功能说明 -->
    <div class="feature-description">
      <div class="description-title">
        <span class="title-icon"><IconWrapper name="lightbulb" :size="14" /></span>
        {{ i18n?.featureDescription || '功能说明' }}
      </div>
      <ul class="description-list">
        <li>{{ i18n?.docCountFeature1 || '在笔记本列表中显示每个笔记本的文档数量' }}</li>
        <li>{{ i18n?.docCountFeature3 || '支持手机端和桌面端' }}</li>
        <li>{{ i18n?.docCountFeature4 || '每小时自动更新笔记本文档数' }}</li>
      </ul>
    </div>

    <!-- 更新间隔设置 -->
    <div class="update-interval">
      <label class="interval-label">
        {{ i18n?.updateInterval || '更新间隔' }}
      </label>
      <select
        v-model="updateInterval"
        class="interval-select"
        @change="handleIntervalChange"
      >
        <option
          v-for="opt in intervalOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ i18n?.[opt.labelKey] || opt.fallback }}
        </option>
      </select>
    </div>

    <!-- 字体样式设置 -->
    <div class="font-style-settings">
      <div class="settings-title">
        <span class="title-icon"><IconWrapper name="codeBlockColor" :size="14" /></span>
        {{ i18n?.fontStyleSettings || '字体样式设置' }}
      </div>

      <div class="style-row">
        <label class="style-label">
          {{ i18n?.fontSize || '字体大小' }}
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
        <label class="style-label">
          {{ i18n?.fontColor || '字体颜色' }}
        </label>
        <div class="color-input-wrapper">
          <input
            v-model="fontColor"
            type="color"
            class="color-picker"
            @input="handleFontStyleChange"
          />
          <input
            v-model="fontColor"
            type="text"
            class="color-text"
            placeholder="#8c8c8c"
            @change="handleFontStyleChange"
          />
        </div>
      </div>

      <div class="style-row">
        <label class="style-label">
          {{ i18n?.fontWeight || '字体粗细' }}
        </label>
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
            {{ i18n?.[opt.labelKey] || opt.fallback }}
          </option>
        </select>
      </div>

      <div class="style-row">
        <label class="style-label">
          {{ i18n?.displayFormat || '显示格式' }}
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
        <label class="style-label">
          {{ i18n?.opacity || '透明度' }}
          <span class="opacity-value">{{ Math.round(opacity * 100) }}%</span>
        </label>
        <div class="opacity-slider-row">
          <input
            v-model.number="opacity"
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            class="opacity-slider"
            @input="handleFontStyleChange"
          />
        </div>
      </div>

      <!-- 样式预览 -->
      <div class="style-preview">
        <label class="preview-label">
          {{ i18n?.stylePreview || '样式预览' }}
        </label>
        <div class="preview-box">
          <span class="preview-text">我的笔记本</span>
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
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import SiSwitch from "@/components/Switch.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { DocCountManager } from "../modules/DocCountManager"
import { type DocCountFormat, DOC_COUNT_FORMATTERS, GeneralSettingsStorage } from "../types/storage"

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
}>()

const emit = defineEmits<{
  change: [settings: any]
}>()

const enableDocCount = ref(true)
const updateInterval = ref("3600000")
const displayFormat = ref<DocCountFormat>("bracket")
const fontSize = ref("12px")
const fontColor = ref("#8c8c8c")
const fontWeight = ref("normal")
const opacity = ref(0.8)

// ============================================================
// 数据驱动选项列表
// ============================================================
const fontSizeOptions = ["10px", "11px", "12px", "13px", "14px", "15px", "16px"] as const

const intervalOptions = [
  { value: "1800000", labelKey: "interval30min", fallback: "30分钟" },
  { value: "3600000", labelKey: "interval1hour", fallback: "1小时" },
  { value: "7200000", labelKey: "interval2hour", fallback: "2小时" },
  { value: "14400000", labelKey: "interval4hour", fallback: "4小时" },
] as const

const weightOptions = [
  { value: "normal" as const, labelKey: "fontWeightNormal", fallback: "正常" },
  { value: "bold" as const, labelKey: "fontWeightBold", fallback: "粗体" },
  { value: "lighter" as const, labelKey: "fontWeightLighter", fallback: "细体" },
] as const

const formatOptions: { value: DocCountFormat; label: string }[] = [
  { value: "bracket", label: "(123)" },
  { value: "square", label: "[123]" },
  { value: "plain", label: "123" },
  { value: "dot", label: "·123" },
]

/**
 * 获取 GeneralSettings 实例中的 DocCountManager
 */
const getDocCountManager = (): DocCountManager | null => {
  const generalSettings = props.plugin?.__generalSettings
  return generalSettings?.docCountManager || null
}

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

const ensureStorage = (): GeneralSettingsStorage => {
  if (!gsStorage.value) throw new Error("插件实例不可用")
  return gsStorage.value
}

/** 预览用的格式化数字 */
const previewFormatted = computed(() => DOC_COUNT_FORMATTERS[displayFormat.value](123))

/** 构建保存对象——4 个 handler 复用，消除重复 */
const buildSettings = () => ({
  enableDocCount: enableDocCount.value,
  updateInterval: updateInterval.value,
  displayFormat: displayFormat.value,
  fontSize: fontSize.value,
  fontColor: fontColor.value,
  fontWeight: fontWeight.value,
  opacity: opacity.value,
})

const loadSettings = async () => {
  try {
    const data = gsStorage.value ? await gsStorage.value.docCount.load() : null
    if (data) {
      enableDocCount.value = data.enableDocCount ?? true
      updateInterval.value = data.updateInterval || "3600000"
      displayFormat.value = data.displayFormat || "bracket"
      fontSize.value = data.fontSize || "12px"
      fontColor.value = data.fontColor || "#8c8c8c"
      fontWeight.value = data.fontWeight || "normal"
      opacity.value = data.opacity ?? 0.8
    }
  } catch (e) {
    console.error("加载文档数统计设置失败:", e)
  }
}

const handleToggleChange = async () => {
  try {
    const settings = buildSettings()
    await ensureStorage().docCount.save(settings)

    const manager = getDocCountManager()
    if (enableDocCount.value) {
      if (!manager && props.plugin?.__generalSettings) {
        props.plugin.__generalSettings.docCountManager = new DocCountManager()
        const newManager = getDocCountManager()
        newManager?.start()
        newManager?.setUpdateInterval(Number.parseInt(updateInterval.value))
        newManager?.setDisplayFormat(displayFormat.value)
        newManager?.setFontStyle({
          fontSize: fontSize.value,
          color: fontColor.value,
          fontWeight: fontWeight.value,
          opacity: opacity.value,
        })
      } else {
        manager?.start()
      }
    } else {
      manager?.stop()
    }

    showMessage(
      enableDocCount.value ? "笔记本文档数统计已启用" : "笔记本文档数统计已禁用",
      2000,
      "info",
    )

    emit("change", settings)
  } catch (e) {
    console.error("保存文档数统计设置失败:", e)
  }
}

const handleIntervalChange = async () => {
  try {
    await ensureStorage().docCount.save(buildSettings())
    getDocCountManager()?.setUpdateInterval(Number.parseInt(updateInterval.value))
    showMessage("更新间隔已修改", 2000, "info")
  } catch (e) {
    console.error("保存更新间隔失败:", e)
  }
}

const handleFontStyleChange = async () => {
  try {
    await ensureStorage().docCount.save(buildSettings())
    const manager = getDocCountManager()
    manager?.setFontStyle({
      fontSize: fontSize.value,
      color: fontColor.value,
      fontWeight: fontWeight.value,
      opacity: opacity.value,
    })
    manager?.setDisplayFormat(displayFormat.value)
    showMessage("字体样式已修改", 2000, "info")
  } catch (e) {
    console.error("保存字体样式失败:", e)
  }
}

const handleDisplayFormatChange = async () => {
  try {
    await ensureStorage().docCount.save(buildSettings())
    getDocCountManager()?.setDisplayFormat(displayFormat.value)
    showMessage("显示格式已修改", 2000, "info")
  } catch (e) {
    console.error("保存显示格式失败:", e)
  }
}

onMounted(async () => {
  await loadSettings()
  // 注意:不再在这里创建和启动 DocCountManager
  // 它由 GeneralSettings 在插件启动时统一管理
})

onUnmounted(() => {
  // 清理工作由 GeneralSettings 统一处理
})

defineExpose({
  loadSettings,
  enableDocCount,
})
</script>

<style scoped lang="scss">
@use "../styles/DocCountSettings.scss";
</style>
