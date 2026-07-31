<!-- 代码块样式增强设置面板：风格选择 + 背景/边框/阴影/字体/颜色/折叠等高级配置 -->
<template>
  <div class="codeblock-settings">
    <div class="settings-container">
      <!-- 启用代码块样式增强 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："启用代码块样式增强" -->
          <SettingLabel
            icon="codeBlockEnable"
            :text="i18n.enableCodeBlockStyle"
          />
          <!-- 开关 + 状态描述："已启用"/"已禁用" -->
          <div class="toggle-container">
            <Switch
              v-model="settings.enabled"
              size="small"
            />
            <span class="toggle-description">
              {{ settings.enabled ? i18n.enabled : i18n.disabled }}
            </span>
          </div>
        </div>
      </div>

      <!-- 代码块风格选择（不受增强开关控制，风格始终生效） -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："代码块风格" -->
          <SettingLabel
            icon="codeBlockStyle"
            :text="i18n.codeBlockStyle"
          />
          <!-- 风格卡片选择器 -->
          <div class="style-cards">
            <div
              v-for="item in CODEBLOCK_STYLE_META"
              :key="item.style"
              class="style-card"
              :class="{ active: settings.style === item.style }"
              @click="settings.style = item.style"
            >
              <div class="style-card-icon">
                <IconWrapper
                  :name="item.iconKey"
                  :size="22"
                />
              </div>
              <!-- 风格名称：“默认风格 / GitHub 风格 / Mac 风格” -->
              <div class="style-card-name">
                {{ i18n[item.nameKey] }}
              </div>
              <!-- 风格描述 -->
              <div class="style-card-desc">
                {{ i18n[item.descKey] }}
              </div>
              <!-- 选中标记 -->
              <div
                v-if="settings.style === item.style"
                class="style-card-check"
              >
                <IconWrapper
                  name="check"
                  :size="10"
                />
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
        <!-- 区块标题："高级设置" -->
        <div class="setting-header">
          <span class="label-icon">
            <IconWrapper
              name="codeBlockAdvanced"
              :size="14"
            />
          </span>
          <span>{{ i18n.advancedSettings }}</span>
        </div>

        <!-- 背景色 -->
        <div class="setting-item">
          <!-- 标签："背景色" + 当前透明度百分比 -->
          <SettingLabel
            icon="codeBlockBackground"
            :text="i18n.codeBlockBackground"
            :value="opacityPercent"
          />
          <ColorField
            v-model="settings.backgroundColor"
            :placeholder="i18n.colorPlaceholder"
          />
          <!-- 背景透明度滑块 -->
          <SettingSlider
            v-model="settings.backgroundColorOpacity"
            :min="0.1"
            :max="1"
            :step="0.05"
            :button-step="0.1"
            :format-value="formatPercent"
          />
        </div>

        <!-- 边框设置 -->
        <div class="setting-item">
          <!-- 标签："边框设置" -->
          <SettingLabel
            icon="codeBlockBorder"
            :text="i18n.codeBlockBorder"
          />
          <div class="border-settings">
            <!-- 边框颜色 -->
            <div class="border-row">
              <label>{{ i18n.borderColor }}</label>
              <ColorField v-model="settings.borderColor" />
            </div>
            <!-- 边框宽度 -->
            <div class="border-row">
              <label>{{ i18n.borderWidth }}</label>
              <SettingSlider
                v-model="settings.borderWidth"
                :min="0"
                :max="5"
                :step="0.5"
                :format-value="formatPx"
              />
            </div>
            <!-- 圆角 -->
            <div class="border-row">
              <label>{{ i18n.borderRadius }}</label>
              <SettingSlider
                v-model="settings.borderRadius"
                :min="0"
                :max="20"
                :step="1"
                :format-value="formatPx"
              />
            </div>
          </div>
        </div>

        <!-- 阴影 -->
        <div class="setting-item">
          <!-- 标签："阴影" -->
          <SettingLabel
            icon="codeBlockShadow"
            :text="i18n.codeBlockShadow"
          />
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
          <!-- 标签："代码字体" -->
          <SettingLabel
            icon="codeBlockFont"
            :text="i18n.codeFontSettings"
          />
          <div class="font-settings">
            <!-- 字体族 -->
            <div class="font-row">
              <label>{{ i18n.fontFamily }}</label>
              <div class="input-group">
                <input
                  v-model="settings.codeFontFamily"
                  type="text"
                  class="text-input font-input"
                  :placeholder="i18n.fontFamilyPlaceholder"
                />
                <select
                  v-model="presetCodeFont"
                  class="font-select"
                >
                  <!-- 占位项："选择字体" -->
                  <option value="">
                    {{ i18n.selectFont }}
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
            <!-- 字体大小 -->
            <div class="font-row">
              <label>{{ i18n.fontSize }}</label>
              <SettingSlider
                v-model="settings.codeFontSize"
                :min="10"
                :max="20"
                :step="1"
                :format-value="formatPx"
              />
            </div>
            <!-- 行高 -->
            <div class="font-row">
              <label>{{ i18n.lineHeight }}</label>
              <SettingSlider
                v-model="settings.codeLineHeight"
                :min="1.2"
                :max="2.0"
                :step="0.1"
              />
            </div>
          </div>
        </div>

        <!-- 代码颜色设置 -->
        <div class="setting-item">
          <!-- 标签："代码颜色" -->
          <SettingLabel
            icon="codeBlockColor"
            :text="i18n.codeColorSettings"
          />
          <div class="color-settings">
            <div
              v-for="key in colorFields"
              :key="key"
              class="color-row"
            >
              <label>{{ i18n[key] }}</label>
              <ColorField v-model="settings[key]" />
            </div>
          </div>
        </div>
      </div>

      <!-- 代码块折叠设置（不受增强开关控制，折叠始终生效） -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："代码块折叠" -->
          <SettingLabel
            icon="codeBlockCollapse"
            :text="i18n.codeBlockCollapse"
          />
          <!-- 折叠开关 + 状态描述："已启用"/"已禁用" -->
          <div class="toggle-container">
            <Switch
              v-model="settings.enableCollapse"
              size="small"
            />
            <span class="toggle-description">
              {{ settings.enableCollapse ? i18n.enabled : i18n.disabled }}
            </span>
          </div>
        </div>
      </div>
      <!-- 折叠高度设置 -->
      <div
        v-if="settings.enableCollapse"
        class="setting-row"
      >
        <div class="setting-item">
          <!-- 标签："折叠高度" + 当前值 -->
          <SettingLabel
            icon="codeBlockHeight"
            :text="i18n.collapseHeight"
            :value="`${settings.collapseHeight}px`"
          />
          <SettingSlider
            v-model="settings.collapseHeight"
            :min="200"
            :max="800"
            :step="50"
            :show-value="false"
          />
          <!-- 区间刻度标签 -->
          <div class="slider-labels">
            <span>200px</span>
            <span>800px</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { CodeBlockSettings } from "@/features/generalSettings/types/storage"
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
  DEFAULT_CODEBLOCK_SETTINGS,
  GeneralSettingsStorage,
} from "@/features/generalSettings/types/storage"
import { CODEBLOCK_STYLE_META } from "../utils/styles"
import ColorField from "./ColorField.vue"
import SettingLabel from "./SettingLabel.vue"
import SettingSlider from "./SettingSlider.vue"

// ── Props & Emits ──
interface Props {
  i18n?: Record<string, string>
  plugin?: Plugin | null
}

interface Emits {
  (e: "change", settings: CodeBlockSettings): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
})

const emit = defineEmits<Emits>()

// ── 常量 ──
const presetFonts = [
  "Consolas",
  "Courier New",
  "JetBrains Mono",
  "Cascadia Code",
  "Hack",
] as const

/** 代码语法着色字段（键名与 i18n 键一致） */
const colorFields = [
  "textColor",
  "keywordColor",
  "stringColor",
  "commentColor",
  "functionColor",
  "numberColor",
] as const

// ── 状态 ──
const settings = ref<CodeBlockSettings>({ ...DEFAULT_CODEBLOCK_SETTINGS })
const storage = ref<GeneralSettingsStorage | null>(null)

/** 预设字体下拉：命中预设时回显当前字体，手输非预设字体时自动复位为占位项 */
const presetCodeFont = computed({
  get: () => {
    const family = settings.value.codeFontFamily
    return (presetFonts as readonly string[]).includes(family) ? family : ""
  },
  set: (v: string) => {
    if (v) {
      settings.value.codeFontFamily = v
    }
  },
})

// ── 值格式化 ──
const formatPx = (v: number) => `${v}px`
const formatPercent = (v: number) => `${Math.round(v * 100)}%`
const opacityPercent = computed(() => formatPercent(settings.value.backgroundColorOpacity))

const shadowOptions = computed(() => [
  { label: props.i18n.noneShadow, value: "none" },
  { label: props.i18n.lightShadow, value: "0 2px 8px rgba(0, 0, 0, 0.1)" },
  { label: props.i18n.mediumShadow, value: "0 4px 12px rgba(0, 0, 0, 0.15)" },
  { label: props.i18n.heavyShadow, value: "0 8px 24px rgba(0, 0, 0, 0.2)" },
])

// ── 防抖：自动保存 ──
let saveTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSave(s: CodeBlockSettings) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    saveTimer = null
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
/** 加载赋值触发的首次 watch 跳过标记，避免刚加载的数据被原样回写 */
let skipWatchOnce = false

// 样式应用统一由父链路 GeneralSettings.handleSettingsChange 承担，面板只负责修改 + 保存 + 通知
watch(
  settings,
  (newSettings) => {
    if (skipWatchOnce) {
      skipWatchOnce = false
      return
    }
    emit("change", newSettings)
    debouncedSave(newSettings)
  },
  { deep: true },
)

// ── 加载保存的设置 ──
async function loadSettings() {
  // 无插件实例 / 加载失败时保持初始默认值，不重新赋值，避免触发 watch 把默认值回写存储
  if (!storage.value) {
    console.warn("插件实例不可用，使用默认设置")
    return
  }

  try {
    const loadedSettings = await storage.value.codeblock.loadOrDefault()
    skipWatchOnce = true
    settings.value = {
      ...DEFAULT_CODEBLOCK_SETTINGS,
      ...loadedSettings,
    }
  } catch (error) {
    console.error("加载设置失败:", error)
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
    storage.value?.codeblock.save(settings.value).catch((error) => {
      console.error("卸载前保存设置失败:", error)
    })
  }
})
</script>

<style scoped lang="scss">
@use "../styles/CodeBlockSettings.scss";
</style>
