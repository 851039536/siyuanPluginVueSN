<template>
  <div class="codeblock-settings">
    <div class="settings-container">
      <!-- 启用代码块样式增强 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">
              <IconWrapper name="codeBlockEnable" :size="14" />
            </span>
            {{ i18n.enableCodeBlockStyle || '启用代码块样式增强' }}
          </label>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input
                v-model="settings.enabled"
                type="checkbox"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-description">
              {{ settings.enabled ? (i18n.enabled || '已启用') : (i18n.disabled || '已禁用') }}
            </span>
          </div>
        </div>
      </div>

      <!-- 代码块风格选择 -->
      <div
        v-if="settings.enabled"
        class="setting-row"
      >
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">
              <IconWrapper name="codeBlockStyle" :size="14" />
            </span>
            {{ i18n.codeBlockStyle || '代码块风格' }}
          </label>
          <!-- 风格卡片选择器 -->
          <div class="style-cards">
            <div
              v-for="style in STYLE_OPTIONS"
              :key="style"
              class="style-card"
              :class="{ active: settings.style === style }"
              @click="settings.style = style"
            >
              <div class="style-card-icon">
                <IconWrapper :name="styleIcons[style]" :size="22" />
              </div>
              <div class="style-card-name">
                {{ styleNameMap[style] }}
              </div>
              <div class="style-card-desc">
                {{ styleDescMap[style] }}
              </div>
              <div
                v-if="settings.style === style"
                class="style-card-check"
              >
                ✓
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- 高级设置 -->
      <div
        v-if="settings.enabled"
        class="advanced-settings"
      >
        <div class="setting-header">
          <span class="label-icon">
            <IconWrapper name="codeBlockAdvanced" :size="14" />
          </span>
          <span>{{ i18n.advancedSettings || '高级设置' }}</span>
        </div>

        <!-- 背景色 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">
              <IconWrapper name="codeBlockBackground" :size="14" />
            </span>
            {{ i18n.codeBlockBackground || '背景色' }}
          </label>
          <div class="color-picker-container">
            <input
              v-model="settings.backgroundColor"
              type="color"
              class="color-picker"
            />
            <input
              v-model="settings.backgroundColor"
              type="text"
              class="color-input"
              :placeholder="i18n.colorPlaceholder || '输入颜色值'"
            />
          </div>
        </div>

        <!-- 边框设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">
              <IconWrapper name="codeBlockBorder" :size="14" />
            </span>
            {{ i18n.codeBlockBorder || '边框设置' }}
          </label>
          <div class="border-settings">
            <div class="border-row">
              <label>{{ i18n.borderColor || '边框颜色' }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings.borderColor"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.borderColor"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
            <div class="border-row">
              <label>{{ i18n.borderWidth || '边框宽度' }}</label>
              <div class="slider-container small">
                <button
                  class="slider-btn"
                  @click="adjustValue('borderWidth', -0.5, 0, 5)"
                >
                  −
                </button>
                <input
                  v-model.number="settings.borderWidth"
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  class="range-slider"
                />
                <button
                  class="slider-btn"
                  @click="adjustValue('borderWidth', 0.5, 0, 5)"
                >
                  +
                </button>
                <span class="slider-value">{{ settings.borderWidth }}px</span>
              </div>
            </div>
            <div class="border-row">
              <label>{{ i18n.borderRadius || '圆角' }}</label>
              <div class="slider-container small">
                <button
                  class="slider-btn"
                  @click="adjustValue('borderRadius', -1, 0, 20)"
                >
                  −
                </button>
                <input
                  v-model.number="settings.borderRadius"
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  class="range-slider"
                />
                <button
                  class="slider-btn"
                  @click="adjustValue('borderRadius', 1, 0, 20)"
                >
                  +
                </button>
                <span class="slider-value">{{ settings.borderRadius }}px</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 阴影 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">
              <IconWrapper name="codeBlockShadow" :size="14" />
            </span>
            {{ i18n.codeBlockShadow || '阴影' }}
          </label>
          <div class="shadow-options">
            <button
              v-for="shadow in shadowOptions"
              :key="shadow.value"
              class="shadow-btn"
              :class="{ active: settings.boxShadow === shadow.value }"
              @click="settings.boxShadow = shadow.value"
            >
              {{ shadow.label }}
            </button>
          </div>
        </div>

        <!-- 代码字体设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">
              <IconWrapper name="codeBlockFont" :size="14" />
            </span>
            {{ i18n.codeFontSettings || '代码字体' }}
          </label>
          <div class="font-settings">
            <div class="font-row">
              <label>{{ i18n.fontFamily || '字体族' }}</label>
              <div class="input-group">
                <input
                  v-model="settings.codeFontFamily"
                  type="text"
                  class="text-input font-input"
                  :placeholder="i18n.fontFamilyPlaceholder || '输入字体名称'"
                />
                <select
                  v-model="presetCodeFont"
                  class="font-select"
                  @change="applyPresetCodeFont"
                >
                  <option value="">
                    {{ i18n.selectFont || '选择字体' }}
                  </option>
                  <option
                    v-for="f in presetFonts"
                    :key="f"
                    :value="f"
                  >
                    {{ f }}
                  </option>
                </select>
              </div>
            </div>
            <div class="font-row">
              <label>{{ i18n.fontSize || '字体大小' }}</label>
              <div class="slider-container small">
                <button
                  class="slider-btn"
                  @click="adjustValue('codeFontSize', -1, 10, 20)"
                >
                  −
                </button>
                <input
                  v-model.number="settings.codeFontSize"
                  type="range"
                  min="10"
                  max="20"
                  step="1"
                  class="range-slider"
                />
                <button
                  class="slider-btn"
                  @click="adjustValue('codeFontSize', 1, 10, 20)"
                >
                  +
                </button>
                <span class="slider-value">{{ settings.codeFontSize }}px</span>
              </div>
            </div>
            <div class="font-row">
              <label>{{ i18n.lineHeight || '行高' }}</label>
              <div class="slider-container small">
                <button
                  class="slider-btn"
                  @click="adjustValue('codeLineHeight', -0.1, 1.2, 2.0)"
                >
                  −
                </button>
                <input
                  v-model.number="settings.codeLineHeight"
                  type="range"
                  min="1.2"
                  max="2.0"
                  step="0.1"
                  class="range-slider"
                />
                <button
                  class="slider-btn"
                  @click="adjustValue('codeLineHeight', 0.1, 1.2, 2.0)"
                >
                  +
                </button>
                <span class="slider-value">{{ settings.codeLineHeight }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 代码颜色设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">
              <IconWrapper name="codeBlockColor" :size="14" />
            </span>
            {{ i18n.codeColorSettings || '代码颜色' }}
          </label>
          <div class="color-settings">
            <div
              v-for="colorField in colorFields"
              :key="colorField.key"
              class="color-row"
            >
              <label>{{ i18n[colorField.i18nKey] || colorField.label }}</label>
              <div class="color-picker-container">
                <input
                  v-model="settings[colorField.key]"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings[colorField.key]"
                  type="text"
                  class="color-input"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 代码块折叠设置 -->
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">
              <IconWrapper name="codeBlockCollapse" :size="14" />
            </span>
            {{ i18n.codeBlockCollapse || '代码块折叠' }}
          </label>
          <div class="toggle-container">
            <label class="toggle-switch">
              <input
                v-model="settings.enableCollapse"
                type="checkbox"
                class="toggle-input"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-description">
              {{ settings.enableCollapse ? (i18n.collapseEnabled || '已启用') : (i18n.collapseDisabled || '已禁用') }}
            </span>
          </div>
        </div>
        <!-- 折叠高度设置 -->
        <div
          v-if="settings.enableCollapse"
          class="setting-item"
        >
          <label class="setting-label">
            <span class="label-icon">
              <IconWrapper name="codeBlockHeight" :size="14" />
            </span>
            {{ i18n.collapseHeight || '折叠高度' }}
            <span class="setting-value">{{ settings.collapseHeight }}px</span>
          </label>
          <div class="slider-container">
            <div class="slider-row">
              <button
                class="slider-btn"
                @click="adjustValue('collapseHeight', -50, 200, 800)"
              >
                −
              </button>
              <input
                v-model.number="settings.collapseHeight"
                type="range"
                min="200"
                max="800"
                step="50"
                class="range-slider"
              />
              <button
                class="slider-btn"
                @click="adjustValue('collapseHeight', 50, 200, 800)"
              >
                +
              </button>
            </div>
            <div class="slider-labels">
              <span>200px</span>
              <span>800px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import type { CodeBlockSettings } from "@/features/generalSettings/types/storage"
import {
  DEFAULT_CODEBLOCK_SETTINGS,
  GeneralSettingsStorage,
} from "@/features/generalSettings/types/storage"
import {
  applyCodeBlockCollapse,
  applyCodeBlockEnhancedStyles,
  applyCodeBlockStyle,
} from "../utils/styles"
import type { IconKey } from "@/config/icons"
import IconWrapper from "@/components/IconWrapper.vue"

// ── 常量 ──
const STYLE_OPTIONS: CodeBlockSettings["style"][] = ["default", "github", "mac"] as const

const styleIcons: Record<string, IconKey> = {
  default: "codeBlockDefault" as IconKey,
  github: "codeBlockGithub" as IconKey,
  mac: "codeBlockMac" as IconKey,
}

const presetFonts = [
  "Consolas",
  "Courier New",
  "JetBrains Mono",
  "Cascadia Code",
  "Hack",
] as const

// ── Props & Emits ──
interface Props {
  i18n?: Record<string, string>
  plugin?: any
  initialSettings?: CodeBlockSettings
}

interface Emits {
  (e: "change", settings: CodeBlockSettings): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
  initialSettings: () => ({ ...DEFAULT_CODEBLOCK_SETTINGS }),
})

const emit = defineEmits<Emits>()

// ── 状态 ──
const settings = ref<CodeBlockSettings>({ ...props.initialSettings })
const presetCodeFont = ref("")
const storage = ref<GeneralSettingsStorage | null>(null)

// ── 预计算映射（避免 v-for 内重复构建 Record） ──
const styleNameMap = computed<Record<string, string>>(() => ({
  default: props.i18n.defaultStyle || "默认风格",
  github: props.i18n.githubStyle || "GitHub 风格",
  mac: props.i18n.macStyle || "Mac 风格",
}))

const styleDescMap = computed<Record<string, string>>(() => ({
  default: props.i18n.defaultStyleDesc || "思源原生外观",
  github: props.i18n.githubStyleDesc || "GitHub 深色代码块",
  mac: props.i18n.macStyleDesc || "macOS 窗口样式",
}))

const shadowOptions = computed(() => [
  { label: props.i18n.noneShadow || "无阴影", value: "none" },
  { label: props.i18n.lightShadow || "轻阴影", value: "0 2px 8px rgba(0, 0, 0, 0.1)" },
  { label: props.i18n.mediumShadow || "中阴影", value: "0 4px 12px rgba(0, 0, 0, 0.15)" },
  { label: props.i18n.heavyShadow || "重阴影", value: "0 8px 24px rgba(0, 0, 0, 0.2)" },
])

const colorFields = [
  { key: "textColor" as const, i18nKey: "textColor", label: "文本颜色" },
  { key: "keywordColor" as const, i18nKey: "keywordColor", label: "关键字颜色" },
  { key: "stringColor" as const, i18nKey: "stringColor", label: "字符串颜色" },
  { key: "commentColor" as const, i18nKey: "commentColor", label: "注释颜色" },
  { key: "functionColor" as const, i18nKey: "functionColor", label: "函数颜色" },
  { key: "numberColor" as const, i18nKey: "numberColor", label: "数字颜色" },
]

// ── 防抖存储保存 ──
let saveTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSave(s: CodeBlockSettings) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    if (storage.value) {
      try {
        await storage.value.codeblock.save(s)
      } catch (error) {
        console.error("自动保存失败:", error)
      }
    }
  }, 300)
}

// ── Watch ──
watch(
  settings,
  (newSettings) => {
    emit("change", newSettings)
    applyCodeBlockStyle(newSettings.style)
    applyCodeBlockCollapse(
      newSettings.enableCollapse,
      newSettings.collapseHeight,
    )
    applyCodeBlockEnhancedStyles(newSettings)
    debouncedSave(newSettings)
  },
  { deep: true, immediate: false },
)

// ── 方法 ──
function applyPresetCodeFont() {
  if (presetCodeFont.value) {
    settings.value.codeFontFamily = presetCodeFont.value
  }
}

function adjustValue(
  key: keyof CodeBlockSettings,
  delta: number,
  min: number,
  max: number,
) {
  const current = settings.value[key] as number
  const clamped = Math.max(min, Math.min(max, current + delta))
  if (clamped !== current) {
    (settings.value as Record<string, unknown>)[key] = clamped
  }
}

// ── 加载保存的设置 ──
async function loadSettings() {
  if (!props.plugin) {
    console.warn("插件实例不可用，使用默认设置")
    settings.value = { ...DEFAULT_CODEBLOCK_SETTINGS }
    return
  }

  try {
    const loadedSettings = await storage.value!.codeblock.loadOrDefault()
    settings.value = {
      ...DEFAULT_CODEBLOCK_SETTINGS,
      ...loadedSettings,
    }
    applyCodeBlockStyle(settings.value.style)
    applyCodeBlockCollapse(
      settings.value.enableCollapse,
      settings.value.collapseHeight,
    )
    applyCodeBlockEnhancedStyles(settings.value)
  } catch (error) {
    console.error("加载设置失败:", error)
    settings.value = { ...DEFAULT_CODEBLOCK_SETTINGS }
  }
}

// ── 初始化 ──
onMounted(async () => {
  if (props.plugin) {
    storage.value = new GeneralSettingsStorage(props.plugin)
  }
  await loadSettings()
})

// ── 暴露 ──
defineExpose({
  loadSettings,
  settings,
})
</script>

<style scoped lang="scss">
@use "../styles/CodeBlockSettings.scss";
</style>
