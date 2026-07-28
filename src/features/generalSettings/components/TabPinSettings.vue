<!-- 钉住页签设置子组件：启用开关 + 显示模式（图标+标题/仅标题）+ 页签背景颜色，自动保存并实时注入样式 -->
<template>
  <div class="tab-pin-settings">
    <div class="settings-container">
      <!-- 启用开关行 -->
      <div class="setting-row">
        <label class="setting-label">
          <IconWrapper
            name="starOutline"
            :size="13"
            class="label-icon"
          />
          <!-- 开关标签："钉住页签优化" -->
          {{ i18n.enableTabPinOptimization }}
        </label>
        <div class="toggle-container">
          <input
            v-model="enabled"
            type="checkbox"
            class="toggle-checkbox"
          />
          <!-- 开关状态文案："已启用" / "已禁用" -->
          <span class="toggle-label">{{ enabled ? i18n.enabled : i18n.disabled }}</span>
        </div>
      </div>

      <template v-if="enabled">
        <!-- 显示模式单选行 -->
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
          <div class="display-mode-options">
            <label class="radio-item">
              <input
                v-model="displayMode"
                type="radio"
                value="iconAndText"
              />
              <!-- 选项："图标 + 标题" -->
              <span class="radio-label">{{ i18n.iconAndText }}</span>
            </label>
            <label class="radio-item">
              <input
                v-model="displayMode"
                type="radio"
                value="textOnly"
              />
              <!-- 选项："仅标题" -->
              <span class="radio-label">{{ i18n.textOnly }}</span>
            </label>
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
              @click="resetBackgroundColor"
            >
              <!-- 按钮："重置" -->
              {{ i18n.resetColor }}
            </button>
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
import {
  DEFAULT_TABPIN_SETTINGS,
  GeneralSettingsStorage,
  type TabPinSettings,
} from "@/features/generalSettings/types/storage"
import {
  generateTabPinCSS,
  TAB_PIN_STYLE_ID,
} from "@/features/generalSettings/utils/styles"
import {
  injectStyle,
  removeStyle,
} from "@/utils/domUtils"

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

// 统一监听所有响应式变化，自动应用样式并保存（初始加载期间跳过保存）
watch([enabled, displayMode, backgroundColor], () => {
  applyToDocument()
  if (initialized) {
    autoSave()
  }
})

// 应用到文档：与 GeneralSettings.applyTabPinStyles 使用同一注入点与禁用语义
function applyToDocument() {
  if (enabled.value) {
    injectStyle(TAB_PIN_STYLE_ID, generateTabPinCSS(currentSettings()))
  } else {
    removeStyle(TAB_PIN_STYLE_ID)
  }
}

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

// 自动保存设置
async function autoSave() {
  if (!props.plugin || !storage.value) return

  try {
    const settingsToSave = currentSettings()
    await storage.value.tabPin.save(settingsToSave)
    emit("change", settingsToSave)
  } catch (error) {
    console.error("保存钉住页签设置失败:", error)
  }
}

// 加载保存的设置
async function loadSettings() {
  if (!props.plugin || !storage.value) {
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
  // 显式应用一次：加载结果与初始默认值相同时 watch 不触发，需保证样式生效
  applyToDocument()
  initialized = true
})
</script>

<style scoped lang="scss">
@use "../styles/TabPinSettings.scss";
</style>
