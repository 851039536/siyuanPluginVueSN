<template>
  <div class="list-style-settings">
    <div class="settings-container">
      <!-- 列表样式设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">📝</span>
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
            <span class="label-icon">✨</span>
            {{ i18n.enableListStyle || '启用列表样式设置' }}
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

      <template v-if="settings.enabled">
        <!-- 有序列表颜色设置 -->
        <div class="setting-section">
          <div class="section-header">
            <span class="section-icon">🔢</span>
            <span class="section-title">{{ i18n.orderedListColors || '有序列表颜色' }}</span>
          </div>

          <div class="color-grid">
            <div
              v-for="(color, index) in settings.orderedListColors"
              :key="`o-${index}`"
              class="color-item"
            >
              <label class="color-label">层级 {{ index + 1 }}</label>
              <div class="color-input-group">
                <input
                  v-model="settings.orderedListColors[index]"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.orderedListColors[index]"
                  type="text"
                  class="color-text"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 无序列表颜色设置 -->
        <div class="setting-section">
          <div class="section-header">
            <span class="section-icon">•</span>
            <span class="section-title">{{ i18n.unorderedListColors || '无序列表颜色' }}</span>
          </div>

          <div class="color-grid">
            <div
              v-for="(color, index) in settings.unorderedListColors"
              :key="`u-${index}`"
              class="color-item"
            >
              <label class="color-label">层级 {{ index + 1 }}</label>
              <div class="color-input-group">
                <input
                  v-model="settings.unorderedListColors[index]"
                  type="color"
                  class="color-picker"
                />
                <input
                  v-model="settings.unorderedListColors[index]"
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
              <span class="label-icon">⭕</span>
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
            <span class="preview-icon">{{ showPreview ? '👁️' : '👁️‍🗨️' }}</span>
            <span>{{ i18n.preview || '预览效果' }}</span>
            <span
              class="toggle-arrow"
              :class="{ expanded: showPreview }"
            >▼</span>
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
            <span class="btn-icon">🔄</span>
            {{ i18n.resetToDefault || '恢复默认设置' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plugin } from "siyuan"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"

import { GeneralSettingsStorage } from "../types/storage"

export interface ListStyleSettingsData {
  enabled: boolean
  orderedListColors: string[]
  unorderedListColors: string[]
  symbolSize: number
}

interface Props {
  i18n?: any
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

const DEFAULT_SETTINGS: ListStyleSettingsData = {
  enabled: false,
  orderedListColors: [
    "#000000",
    "#0080ff",
    "#00b600",
    "#fd8700",
    "#be6fff",
    "#888888",
  ],
  unorderedListColors: [
    "#000000",
    "#0080ff",
    "#00b600",
    "#fd8700",
    "#be6fff",
    "#888888",
  ],
  symbolSize: 1.6,
}

const settings = ref<ListStyleSettingsData>({ ...DEFAULT_SETTINGS })
const showPreview = ref(true)

watch(
  settings,
  (newSettings) => {
    emit("change", newSettings)
    saveSettings()
    applySettings()
  },
  { deep: true },
)

function togglePreview() {
  showPreview.value = !showPreview.value
}

function resetSettings() {
  settings.value = { ...DEFAULT_SETTINGS }
  applySettings()
}

function applySettings() {
  applyListStyles(settings.value)
}

function applyListStyles(listSettings: ListStyleSettingsData) {
  try {
    // 移除现有样式
    const existingStyle = document.getElementById("list-style-settings")
    if (existingStyle) {
      existingStyle.remove()
    }

    if (!listSettings.enabled) {
      return
    }

    // 创建新的样式元素
    const style = document.createElement("style")
    style.id = "list-style-settings"

    // 有序列表颜色
    const orderedListCss = listSettings.orderedListColors
      .map((color, index) => {
        const depth = '.li[data-subtype="o"] '.repeat(index)
        return `
        ${depth}.li[data-subtype="o"] > .protyle-action--order {
          color: ${color} !important;
          font-weight: bold !important;
        }
      `
      })
      .join("\n")

    // 无序列表颜色和符号
    const unorderedListCss = listSettings.unorderedListColors
      .map((color, index) => {
        const depth = '[data-subtype="u"] > '.repeat(index)
        const symbol = index % 2 === 0 ? "•" : "▪"
        return `
        ${depth}.li[data-subtype="u"] > .protyle-action::before {
          content: "${symbol}";
          font-size: ${listSettings.symbolSize}em;
          font-weight: bold;
          font-family: Arial;
          position: absolute;
          color: ${color} !important;
        }
      `
      })
      .join("\n")

    style.textContent = `
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

    document.head.appendChild(style)
  } catch (error) {
    console.error("应用列表样式失败:", error)
  }
}

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

async function loadSettings() {
  if (!gsStorage.value) {
    return
  }

  try {
    const data = await gsStorage.value.listStyle.load()
    if (data) {
      settings.value = {
        ...DEFAULT_SETTINGS,
        ...data,
      }
      applySettings()
    }
  } catch (error) {
    console.error("加载列表样式设置失败:", error)
  }
}

async function saveSettings() {
  if (!gsStorage.value) {
    return
  }

  try {
    await gsStorage.value.listStyle.save(settings.value)
  } catch (error) {
    console.error("保存列表样式设置失败:", error)
  }
}

onMounted(async () => {
  await loadSettings()
})

defineExpose({
  settings,
  loadSettings,
})
</script>

<style scoped lang="scss">
@use "../styles/ListStyleSettings.scss";
</style>
