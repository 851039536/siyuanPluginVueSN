<!-- 钉住页签设置子组件：Switch 开关 + 显示模式卡片 + 预设色板/自定义颜色 + 实时预览，自动保存并实时注入样式 -->
<template>
  <div class="tab-pin-settings">
    <div class="settings-container">
      <!-- 启用开关行 -->
      <div class="setting-row setting-row--inline">
        <label class="setting-label">
          <IconWrapper
            name="starOutline"
            :size="13"
            class="label-icon"
          />
          <!-- 开关标签："钉住页签优化" -->
          {{ i18n.enableTabPinOptimization }}
        </label>
        <Switch
          v-model="enabled"
          size="xsmall"
        >
          <!-- 开关状态文案："已启用" / "已禁用" -->
          {{ enabled ? i18n.enabled : i18n.disabled }}
        </Switch>
      </div>

      <template v-if="enabled">
        <!-- 显示模式卡片行 -->
        <div class="setting-row">
          <label class="setting-label">
            <IconWrapper
              name="eye"
              :size="13"
              class="label-icon"
            />
            <!-- 分组标签："显示模式" -->
            {{ i18n.tabPinDisplayMode }}
          </label>
          <div class="mode-cards">
            <button
              v-for="meta in TAB_PIN_MODE_META"
              :key="meta.mode"
              class="mode-card"
              :class="{ 'mode-card--active': displayMode === meta.mode }"
              type="button"
              @click="displayMode = meta.mode"
            >
              <IconWrapper
                :name="meta.iconKey"
                :size="16"
                class="mode-card-icon"
              />
              <!-- 模式名："图标 + 标题" / "仅标题" -->
              <span class="mode-card-label">{{ i18n[meta.labelKey] }}</span>
              <IconWrapper
                v-if="displayMode === meta.mode"
                name="check"
                :size="12"
                class="mode-card-check"
              />
            </button>
          </div>
        </div>

        <!-- 页签背景颜色行 -->
        <div class="setting-row">
          <label class="setting-label">
            <IconWrapper
              name="image"
              :size="13"
              class="label-icon"
            />
            <!-- 分组标签："页签背景颜色" -->
            {{ i18n.tabPinBackground }}
          </label>
          <!-- 预设色板：点击直接应用，title 提示："预设颜色" -->
          <div class="preset-swatches">
            <button
              v-for="color in PRESET_COLORS"
              :key="color"
              class="preset-swatch"
              :class="{ 'preset-swatch--active': backgroundColor === color }"
              type="button"
              :style="{ background: color }"
              :title="i18n.tabPinPresetColors"
              @click="backgroundColor = color"
            ></button>
          </div>
          <div class="color-input-group">
            <input
              :value="toPickerHex(backgroundColor)"
              type="color"
              class="color-picker"
              @input="onColorPickerInput($event)"
            />
            <!-- 文本框用 .lazy：失焦/回车才提交，避免每敲一个字符触发保存与样式注入 -->
            <input
              v-model.lazy="backgroundColor"
              type="text"
              class="color-text"
            />
            <button
              v-if="backgroundColor !== defaultBackgroundColor"
              class="reset-color-btn"
              type="button"
              @click="resetBackgroundColor"
            >
              <!-- 按钮："重置" -->
              {{ i18n.resetColor }}
            </button>
          </div>
        </div>

        <!-- 实时预览行 -->
        <div class="setting-row">
          <label class="setting-label">
            <IconWrapper
              name="eye"
              :size="13"
              class="label-icon"
            />
            <!-- 分组标签："效果预览" -->
            {{ i18n.tabPinPreview }}
          </label>
          <div class="preview-tabbar">
            <!-- 钉住页签（应用当前设置） -->
            <div
              class="preview-tab preview-tab--pinned"
              :style="{ background: backgroundColor }"
            >
              <IconWrapper
                v-if="displayMode === 'iconAndText'"
                name="file"
                :size="12"
                class="preview-tab-icon"
              />
              <!-- 预览页签标题："示例文档" -->
              <span class="preview-tab-text">{{ i18n.tabPinPreviewSample }}</span>
              <IconWrapper
                name="star"
                :size="10"
                class="preview-tab-pin"
              />
            </div>
            <!-- 普通页签（对比参照） -->
            <div class="preview-tab preview-tab--normal">
              <IconWrapper
                name="file"
                :size="12"
                class="preview-tab-icon"
              />
              <!-- 预览页签标题："示例文档" -->
              <span class="preview-tab-text">{{ i18n.tabPinPreviewSample }}</span>
            </div>
          </div>
        </div>

        <!-- 说明提示 -->
        <div class="setting-row">
          <div class="tab-pin-hint">
            <IconWrapper
              name="info"
              :size="14"
              class="hint-icon"
            />
            <!-- 提示文案："钉住的页签将展开显示标题，方便快速识别" -->
            <span class="hint-text">{{ i18n.tabPinHint }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import {
  onMounted,
  ref,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Switch from "@/components/Switch.vue"
import {
  DEFAULT_TABPIN_SETTINGS,
  GeneralSettingsStorage,
  type TabPinSettings,
} from "@/features/generalSettings/types/storage"
import { TAB_PIN_MODE_META } from "@/features/generalSettings/utils/styles"

interface Props {
  i18n?: any
  plugin?: Plugin | null
}

interface Emits {
  (e: "change", settings: TabPinSettings): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
})

const emit = defineEmits<Emits>()

// 默认背景色统一引用存储层默认值，避免多处重复定义
const defaultBackgroundColor = DEFAULT_TABPIN_SETTINGS.backgroundColor

// 预设色板（首项为默认主题色；其余为低透明度柔和色，适配明暗主题）
const PRESET_COLORS: string[] = [
  defaultBackgroundColor,
  "rgba(250, 200, 60, 0.18)",
  "rgba(80, 200, 120, 0.18)",
  "rgba(240, 100, 130, 0.18)",
  "rgba(150, 120, 240, 0.18)",
  "rgba(60, 160, 240, 0.18)",
]

// 将颜色值归一化为拾取器可用的 6 位 hex；非 hex 值（如默认 rgba(var(...))）回退黑色仅作展示
function toPickerHex(value: string): string {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value.slice(1).split("").map((c) => c + c).join("")}`
  }
  return "#000000"
}

// 拾取器始终产出合法的 #rrggbb，可直接回写
function onColorPickerInput(event: Event) {
  backgroundColor.value = (event.target as HTMLInputElement).value
}

// 状态
const enabled = ref(DEFAULT_TABPIN_SETTINGS.enabled)
const displayMode = ref<TabPinSettings["displayMode"]>(DEFAULT_TABPIN_SETTINGS.displayMode)
const backgroundColor = ref(defaultBackgroundColor)
let initialized = false
const storage = ref<GeneralSettingsStorage | null>(null)

// 统一监听所有响应式变化：样式应用由父链路 GeneralSettings.handleSettingsChange 承担，
// 面板只负责通知 + 保存（初始加载期间跳过）
watch([enabled, displayMode, backgroundColor], () => {
  if (initialized) {
    emit("change", currentSettings())
    autoSave()
  }
})

// 重置背景颜色：仅改值，保存由 watch 统一触发，避免双重保存
function resetBackgroundColor() {
  backgroundColor.value = defaultBackgroundColor
}

// 当前设置快照
function currentSettings(): TabPinSettings {
  return {
    enabled: enabled.value,
    displayMode: displayMode.value,
    backgroundColor: backgroundColor.value,
  }
}

// 自动保存设置（仅负责持久化，通知由 watch 统一 emit，避免保存失败时样式不生效）
async function autoSave() {
  if (!storage.value) return

  try {
    await storage.value.tabPin.save(currentSettings())
  } catch (error) {
    console.error("保存钉住页签设置失败:", error)
  }
}

// 加载保存的设置（仅填充表单，样式由 GeneralSettings.init() 在启动时应用）
async function loadSettings() {
  if (!storage.value) {
    console.warn("插件实例不可用，使用默认设置")
    return
  }

  try {
    const settings = await storage.value.tabPin.loadOrDefault()

    enabled.value = settings.enabled ?? DEFAULT_TABPIN_SETTINGS.enabled
    displayMode.value = settings.displayMode || DEFAULT_TABPIN_SETTINGS.displayMode
    backgroundColor.value = settings.backgroundColor || defaultBackgroundColor
  } catch (error) {
    console.error("加载钉住页签设置失败:", error)
  }
}

// 初始化 - 在组件挂载后执行
onMounted(async () => {
  if (props.plugin) {
    storage.value = new GeneralSettingsStorage(props.plugin)
  }
  await loadSettings()
  initialized = true
})
</script>

<style scoped lang="scss">
@use "../styles/TabPinSettings.scss";
</style>
