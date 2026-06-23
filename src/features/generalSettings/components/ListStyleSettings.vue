<template>
  <div class="list-style-settings">
    <div class="settings-container">
      <!-- 列表样式设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon"><IconWrapper
              name="listBulleted"
              :size="14"
            /></span>
            {{ i18n.listStyleSettings || '列表样式设置' }}
          </label>
          <p class="setting-description">
            {{ i18n.listStyleSettingsDesc || '自定义有序列表和无序列表的颜色和样式' }}
          </p>
        </div>
      </div>

      <!-- 启用列表样式设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon"><IconWrapper
              name="sparkles"
              :size="14"
            /></span>
            {{ i18n.enableListStyle || '启用列表样式设置' }}
          </label>
          <div class="toggle-container">
            <SiSwitch
              v-model="settings.enabled"
              @change="handleToggleChange"
            />
            <span class="toggle-description">
              {{ settings.enabled ? (i18n.enabled || '已启用') : (i18n.disabled || '已禁用') }}
            </span>
          </div>
        </div>
      </div>

      <template v-if="settings.enabled">
        <!-- 颜色设置区块（有序 / 无序共享同一模板） -->
        <div
          v-for="section in colorSections"
          :key="section.key"
          class="setting-section"
        >
          <div class="section-header">
            <span class="section-icon"><IconWrapper
              :name="section.icon"
              :size="14"
            /></span>
            <span class="section-title">{{ i18n[section.titleKey] || section.fallback }}</span>
          </div>

          <div class="color-grid">
            <div
              v-for="(_, index) in settings[section.key]"
              :key="`${section.key}-${index}`"
              class="color-item"
            >
              <label class="color-label">层级 {{ index + 1 }}</label>
              <div class="color-input-group">
                <input
                  v-model="settings[section.key][index]"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings[section.key][index]"
                  type="text"
                  class="color-text"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 无序列表符号大小 -->
        <div class="setting-row">
          <div class="setting-item">
            <label class="setting-label">
              <span class="label-icon"><IconWrapper
                name="formatSize"
                :size="14"
              /></span>
              {{ i18n.listSymbolSize || '无序列表符号大小' }}
              <span class="setting-value">{{ settings.symbolSize }}em</span>
            </label>
            <div class="slider-container">
              <input
                v-model.number="settings.symbolSize"
                type="range"
                min="1.0"
                max="2.5"
                step="0.1"
                class="range-slider"
              />
              <div class="slider-labels">
                <span>1.0em</span>
                <span>2.5em</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 预览区域 -->
        <div class="preview-section">
          <div
            class="preview-toggle"
            @click="togglePreview"
          >
            <span class="preview-icon"><IconWrapper
              name="eye"
              :size="14"
            /></span>
            <span>{{ i18n.preview || '预览效果' }}</span>
            <span
              class="toggle-arrow"
              :class="{ expanded: showPreview }"
            >
              <IconWrapper
                name="chevronDown"
                :size="10"
              />
            </span>
          </div>
          <transition name="preview-expand">
            <div
              v-show="showPreview"
              class="preview-content"
            >
              <div class="preview-section-title">
                {{ i18n.orderedList || '有序列表' }}
              </div>
              <ol class="preview-list">
                <li>
                  第一层级项目
                  <ol>
                    <li>
                      第二层级项目
                      <ol>
                        <li>第三层级项目</li>
                      </ol>
                    </li>
                  </ol>
                </li>
              </ol>

              <div class="preview-section-title">
                {{ i18n.unorderedList || '无序列表' }}
              </div>
              <ul class="preview-list">
                <li>
                  第一层级项目
                  <ul>
                    <li>
                      第二层级项目
                      <ul>
                        <li>第三层级项目</li>
                      </ul>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </transition>
        </div>
      </template>

      <!-- 重置按钮 -->
      <div class="setting-row">
        <div class="setting-item">
          <button
            class="reset-btn"
            @click="resetSettings"
          >
            <IconWrapper
              name="refresh"
              :size="14"
            />
            <span>{{ i18n.resetToDefault || '恢复默认设置' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ListStyleSettings as ListStyleSettingsData } from "../types/storage"
import type { IconKey } from "@/config/icons"

import {
  Plugin,
  showMessage,
} from "siyuan"
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import SiSwitch from "@/components/Switch.vue"
import {
  injectStyle,
  removeStyle,
} from "@/utils/domUtils"
import { GeneralSettingsStorage } from "../types/storage"

interface Props {
  i18n?: Record<string, string>
  plugin?: Plugin
}

interface Emits {
  (e: "change", settings: ListStyleSettingsData): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: undefined,
})

const emit = defineEmits<Emits>()

const STYLE_ID = "list-style-settings"

/** 默认列表层级配色（有序 / 无序共享） */
const DEFAULT_LIST_COLORS: readonly string[] = [
  "#000000",
  "#0080ff",
  "#00b600",
  "#fd8700",
  "#be6fff",
  "#888888",
]

const DEFAULT_SETTINGS: ListStyleSettingsData = {
  enabled: false,
  orderedListColors: [...DEFAULT_LIST_COLORS],
  unorderedListColors: [...DEFAULT_LIST_COLORS],
  symbolSize: 1.6,
}

/** 颜色区块配置——数据驱动，消除有序 / 无序两段重复模板 */
type ColorArrayKey = "orderedListColors" | "unorderedListColors"

const colorSections: {
  key: ColorArrayKey
  titleKey: string
  fallback: string
  icon: IconKey
}[] = [
  {
    key: "orderedListColors",
    titleKey: "orderedListColors",
    fallback: "有序列表颜色",
    icon: "listOrdered",
  },
  {
    key: "unorderedListColors",
    titleKey: "unorderedListColors",
    fallback: "无序列表颜色",
    icon: "list",
  },
]

/** 创建一份与 DEFAULT_SETTINGS 无引用共享的设置副本 */
function createDefaultSettings(): ListStyleSettingsData {
  return {
    ...DEFAULT_SETTINGS,
    orderedListColors: [...DEFAULT_LIST_COLORS],
    unorderedListColors: [...DEFAULT_LIST_COLORS],
  }
}

const settings = ref<ListStyleSettingsData>(createDefaultSettings())
const showPreview = ref(true)

/** 防抖保存定时器 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  settings,
  (newSettings) => {
    emit("change", newSettings)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => saveSettings(), 100)
    applyListStyles(newSettings)
  },
  { deep: true },
)

function togglePreview() {
  showPreview.value = !showPreview.value
}

function handleToggleChange() {
  showMessage(
    settings.value.enabled ? "列表样式已启用" : "列表样式已禁用",
    2000,
    "info",
  )
}

function resetSettings() {
  settings.value = createDefaultSettings()
  showMessage("已恢复默认设置", 2000, "info")
}

/** 构建列表样式 CSS（纯函数） */
function buildListStyleCss(s: ListStyleSettingsData): string {
  const orderedListCss = s.orderedListColors
    .map((color, index) => {
      const depth = '.li[data-subtype="o"] '.repeat(index)
      return `${depth}.li[data-subtype="o"] > .protyle-action--order {
        color: ${color} !important;
        font-weight: bold !important;
      }`
    })
    .join("\n")

  const unorderedListCss = s.unorderedListColors
    .map((color, index) => {
      const depth = '[data-subtype="u"] > '.repeat(index)
      const symbol = index % 2 === 0 ? "•" : "▪"
      return `${depth}.li[data-subtype="u"] > .protyle-action::before {
        content: "${symbol}";
        font-size: ${s.symbolSize}em;
        font-weight: bold;
        font-family: Arial;
        position: absolute;
        color: ${color} !important;
      }`
    })
    .join("\n")

  return `
    /* 有序列表样式 */
    ${orderedListCss}

    /* 无序列表样式 - 隐藏原始符号 */
    [data-subtype="u"] > .li[data-subtype="u"] > .protyle-action svg {
      color: transparent;
    }

    /* 无序列表符号 */
    ${unorderedListCss}

    /* 暗色主题适配 */
    :root[data-theme-mode="dark"] .li[data-subtype="o"] > .protyle-action--order,
    :root[data-theme-mode="dark"] .li[data-subtype="u"] > .protyle-action::before {
      opacity: 0.9;
    }
  `
}

function applyListStyles(listSettings: ListStyleSettingsData) {
  try {
    if (!listSettings.enabled) {
      removeStyle(STYLE_ID)
      return
    }
    injectStyle(STYLE_ID, buildListStyleCss(listSettings))
  } catch (error) {
    console.error("应用列表样式失败:", error)
  }
}

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

async function loadSettings() {
  if (!gsStorage.value) return
  try {
    const data = await gsStorage.value.listStyle.load()
    if (data) {
      settings.value = {
        ...DEFAULT_SETTINGS,
        ...data,
      }
      applyListStyles(settings.value)
    }
  } catch (error) {
    console.error("加载列表样式设置失败:", error)
  }
}

async function saveSettings() {
  if (!gsStorage.value) return
  try {
    await gsStorage.value.listStyle.save(settings.value)
  } catch (error) {
    console.error("保存列表样式设置失败:", error)
  }
}

onMounted(async () => {
  await loadSettings()
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

defineExpose({
  settings,
  loadSettings,
})
</script>

<style scoped lang="scss">
@use "../styles/ListStyleSettings.scss";
</style>
