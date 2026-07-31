<!-- 标题设置面板：风格调色板 / 层级标记 / 标题居中 / 文档标题颜色字号 / H1-H6 颜色与字号 -->
<template>
  <div class="heading-settings">
    <div class="settings-container">
      <!-- 标题风格选择 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："标题风格" -->
          <SettingLabel
            icon="format"
            :text="i18n.headingStyle"
          />
          <select
            v-model="selectedStyle"
            class="style-select"
          >
            <option
              v-for="opt in HEADING_STYLE_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ i18n[opt.labelKey] }}
            </option>
          </select>
        </div>
      </div>

      <!-- 标题层级显示设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："标题层级显示" -->
          <SettingLabel
            icon="listOrdered"
            :text="i18n.headingLevelDisplay"
          />
          <select
            v-model="settings.levelDisplay"
            class="style-select"
          >
            <option
              v-for="opt in LEVEL_DISPLAY_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ i18n[opt.labelKey] }}
            </option>
          </select>
          <!-- 提示："注意:第三方主题可能会影响显示效果" -->
          <div
            v-if="settings.levelDisplay !== 'none'"
            class="level-display-hint"
          >
            <IconWrapper
              name="info"
              :size="14"
            />
            <span class="hint-text">{{ i18n.levelDisplayHint }}</span>
          </div>
        </div>
      </div>

      <!-- 自定义层级标记（仅自定义模式显示） -->
      <div
        v-if="settings.levelDisplay === 'custom'"
        class="setting-row"
      >
        <div class="setting-item">
          <!-- 标签："自定义标记" -->
          <SettingLabel
            icon="edit"
            :text="i18n.customLevelMarkers"
          />
          <div class="custom-level-inputs">
            <div
              v-for="level in HEADING_LEVELS"
              :key="level"
              class="custom-level-item"
            >
              <span class="heading-badge">H{{ level }}</span>
              <input
                v-model="settings.customMarkers[level - 1]"
                type="text"
                class="custom-level-input"
                :placeholder="`H${level}`"
                maxlength="10"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 标题居中显示 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："文档标题居中显示" -->
          <SettingLabel
            icon="chevronRight"
            :text="i18n.titleCenterAlign"
          />
          <!-- 开关 + 状态描述："已启用"/"已禁用" -->
          <div class="toggle-container">
            <Switch
              v-model="settings.titleCenterAlign"
              size="small"
            />
            <span class="toggle-description">
              {{ settings.titleCenterAlign ? i18n.enabled : i18n.disabled }}
            </span>
          </div>
        </div>
      </div>

      <!-- 文档标题颜色（居中开启时显示） -->
      <div
        v-if="settings.titleCenterAlign"
        class="setting-row"
      >
        <div class="setting-item">
          <!-- 标签："文档标题颜色" -->
          <SettingLabel
            icon="format"
            :text="i18n.titleColor"
          />
          <div class="title-color-group">
            <ColorField
              v-model="settings.titleColor"
              :placeholder="i18n.colorPlaceholder"
            />
            <!-- 重置按钮："重置" -->
            <button
              v-if="settings.titleColor !== defaultTitleColor"
              class="reset-color-btn"
              @click="resetTitleColor"
            >
              {{ i18n.resetColor }}
            </button>
          </div>
        </div>
      </div>

      <!-- 文档标题字体大小 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："文档标题字体大小" -->
          <SettingLabel
            icon="formatSize"
            :text="i18n.titleFontSize"
            :value="`${settings.titleFontSize}px`"
          />
          <SettingSlider
            v-model="settings.titleFontSize"
            :min="10"
            :max="64"
            :step="1"
            :format-value="formatPx"
          />
        </div>
      </div>

      <!-- H1-H6 字体大小 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："标题字体大小" -->
          <SettingLabel
            icon="formatSize"
            :text="i18n.headingFontSize"
          />
          <div class="heading-list">
            <div
              v-for="level in HEADING_LEVELS"
              :key="level"
              class="heading-row"
            >
              <span
                class="heading-badge"
                :class="`heading-badge-h${level}`"
              >H{{ level }}</span>
              <SettingSlider
                v-model="settings.fontSizes[levelKey(level)]"
                :min="10"
                :max="64"
                :step="1"
                :format-value="formatPx"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- H1-H6 颜色 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："标题颜色" -->
          <SettingLabel
            icon="format"
            :text="i18n.headingColors"
          />
          <div class="heading-list">
            <div
              v-for="level in HEADING_LEVELS"
              :key="level"
              class="heading-row"
            >
              <span
                class="heading-badge"
                :class="`heading-badge-h${level}`"
              >H{{ level }}</span>
              <ColorField
                v-model="settings.colors[levelKey(level)]"
                :placeholder="i18n.colorPlaceholder"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { HeadingColors, HeadingSettings } from "@/features/generalSettings/types/storage"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Switch from "@/components/Switch.vue"
import {
  DEFAULT_HEADING_SETTINGS,
  GeneralSettingsStorage,
} from "@/features/generalSettings/types/storage"
import { HEADING_COLOR_STYLES } from "../utils/styles"
import ColorField from "./ColorField.vue"
import SettingLabel from "./SettingLabel.vue"
import SettingSlider from "./SettingSlider.vue"

// ── Props & Emits ──
interface Props {
  i18n?: Record<string, string>
  plugin?: Plugin | null
}

interface Emits {
  (e: "change", settings: HeadingSettings): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
})

const emit = defineEmits<Emits>()

// ── 下拉选项元数据（value → i18n 键）──
const HEADING_STYLE_OPTIONS = [
  { value: "default", labelKey: "defaultHeadingStyle" },
  { value: "github", labelKey: "githubStyle" },
  { value: "mac", labelKey: "macStyle" },
  { value: "cartoon", labelKey: "cartoonStyle" },
  { value: "rainbow", labelKey: "rainbowStyle" },
  { value: "monochrome", labelKey: "monochromeStyle" },
  { value: "warm", labelKey: "warmStyle" },
  { value: "cool", labelKey: "coolStyle" },
  { value: "gradient", labelKey: "gradientStyle" },
  { value: "custom", labelKey: "customStyle" },
] as const

const LEVEL_DISPLAY_OPTIONS = [
  { value: "none", labelKey: "levelDisplayNone" },
  { value: "number", labelKey: "levelDisplayNumber" },
  { value: "roman", labelKey: "levelDisplayRoman" },
  { value: "chinese", labelKey: "levelDisplayChinese" },
  { value: "chineseUpper", labelKey: "levelDisplayChineseUpper" },
  { value: "dots", labelKey: "levelDisplayDots" },
  { value: "emoji", labelKey: "levelDisplayEmoji" },
  { value: "star", labelKey: "levelDisplayStar" },
  { value: "arrow", labelKey: "levelDisplayArrow" },
  { value: "tag", labelKey: "levelDisplayTag" },
  { value: "bracket", labelKey: "levelDisplayBracket" },
  { value: "custom", labelKey: "levelDisplayCustom" },
] as const

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const
const defaultTitleColor = DEFAULT_HEADING_SETTINGS.titleColor

// ── 状态 ──
const settings = ref<HeadingSettings>(cloneDefaultHeadingSettings())
const storage = ref<GeneralSettingsStorage | null>(null)

// ── 工具 ──
const formatPx = (v: number) => `${v}px`
const levelKey = (level: number) => `h${level}` as keyof HeadingColors

function cloneDefaultHeadingSettings(): HeadingSettings {
  return {
    colors: { ...DEFAULT_HEADING_SETTINGS.colors },
    fontSizes: { ...DEFAULT_HEADING_SETTINGS.fontSizes },
    levelDisplay: DEFAULT_HEADING_SETTINGS.levelDisplay,
    customMarkers: [...DEFAULT_HEADING_SETTINGS.customMarkers],
    titleCenterAlign: DEFAULT_HEADING_SETTINGS.titleCenterAlign,
    titleColor: DEFAULT_HEADING_SETTINGS.titleColor,
    titleFontSize: DEFAULT_HEADING_SETTINGS.titleFontSize,
  }
}

// 下拉风格：由当前颜色反推匹配的预设；选中预设后整体套用调色板
const selectedStyle = computed<string>({
  get() {
    for (const [name, palette] of Object.entries(HEADING_COLOR_STYLES)) {
      const matched = (Object.keys(palette) as (keyof HeadingColors)[]).every(
        k => settings.value.colors[k].toUpperCase() === palette[k].toUpperCase(),
      )
      if (matched) return name
    }
    return "custom"
  },
  set(val) {
    const palette = HEADING_COLOR_STYLES[val]
    if (val !== "custom" && palette) {
      settings.value.colors = { ...palette }
    }
  },
})

function resetTitleColor() {
  settings.value.titleColor = defaultTitleColor
}

// ── 防抖：仅负责持久化；DOM 样式由 GeneralSettings 监听 change 事件统一应用 ──
let saveTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSave(s: HeadingSettings) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    saveTimer = null
    if (storage.value) {
      try {
        await storage.value.heading.save(s)
      } catch (error) {
        console.error("保存标题设置失败:", error)
      }
    }
  }, 300)
}

// ── Watch：单一数据流，change 事件透传完整设置给父级应用 ──
/** 加载赋值触发的首次 watch 跳过标记，避免刚加载的数据被原样回写 */
let skipWatchOnce = false

watch(
  settings,
  (s) => {
    if (skipWatchOnce) {
      skipWatchOnce = false
      return
    }
    emit("change", { ...s })
    debouncedSave(s)
  },
  { deep: true },
)

// ── 加载保存的设置（仅填充表单，样式由 GeneralSettings.init() 在启动时应用）──
async function loadSettings() {
  // 无插件实例 / 加载失败时保持初始默认值，不重新赋值，避免触发 watch 把默认值回写存储
  if (!storage.value) {
    console.warn("插件实例不可用，使用默认设置")
    return
  }

  try {
    const loaded = await storage.value.loadHeadingOrDefault()
    skipWatchOnce = true
    settings.value = {
      colors: { ...DEFAULT_HEADING_SETTINGS.colors, ...loaded.colors },
      fontSizes: { ...DEFAULT_HEADING_SETTINGS.fontSizes, ...loaded.fontSizes },
      levelDisplay: loaded.levelDisplay || "none",
      customMarkers: loaded.customMarkers?.length
        ? [...loaded.customMarkers]
        : [...DEFAULT_HEADING_SETTINGS.customMarkers],
      titleCenterAlign: loaded.titleCenterAlign ?? false,
      titleColor: loaded.titleColor || defaultTitleColor,
      titleFontSize: loaded.titleFontSize || DEFAULT_HEADING_SETTINGS.titleFontSize,
    }
  } catch (error) {
    console.error("加载标题设置失败:", error)
  }
}

// ── 初始化 ──
onMounted(async () => {
  if (props.plugin) {
    storage.value = new GeneralSettingsStorage(props.plugin)
  }
  await loadSettings()
})

// 卸载时清理防抖定时器，并立即落盘待保存的修改，避免关闭面板丢失最后一次变更
onUnmounted(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
    storage.value?.heading.save(settings.value).catch((error) => {
      console.error("卸载前保存标题设置失败:", error)
    })
  }
})
</script>

<style scoped lang="scss">
@use "../styles/HeadingSettings.scss";
</style>
