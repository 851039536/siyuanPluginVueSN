<template>
  <div class="document-font-settings">
    <div class="settings-container">
      <!-- 文档字体设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="code"
              :size="13"
              class="label-icon"
            />
            {{ i18n.documentFont || '文档字体设置' }}
          </label>
          <p class="setting-description">
            {{ i18n.documentFontDesc || '设置文档内容的字体、字号、行距等样式' }}
          </p>
        </div>
      </div>

      <!-- 启用文档字体设置 -->
      <div class="setting-row">
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="sparkles"
              :size="13"
              class="label-icon"
            />
            {{ i18n.enableDocumentFont || '启用文档字体设置' }}
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

      <!-- 字体族 -->
      <div
        v-if="settings.enabled"
        class="setting-row"
      >
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">Aa</span>
            {{ i18n.fontFamily || '字体族' }}
          </label>
          <div class="input-group">
            <input
              v-model="settings.fontFamily"
              type="text"
              class="text-input font-input"
              :placeholder="i18n.fontFamilyPlaceholder || '输入字体名称，如: Microsoft YaHei, Arial'"
              @input="applySettings"
            />
            <select
              v-model="presetFont"
              class="font-select"
              @change="applyPresetFont"
            >
              <option value="">
                {{ i18n.selectFont || '选择字体' }}
              </option>
              <option value="Microsoft YaHei">
                微软雅黑
              </option>
              <option value="Microsoft YaHei Light">
                微软雅黑 Light
              </option>
              <option value="Segoe UI">
                Segoe UI
              </option>
              <option value="等线">
                等线 (DengXian)
              </option>
              <option value="仿宋">
                仿宋
              </option>
              <option value="华文细黑">
                华文细黑
              </option>
              <option value="华文黑体">
                华文黑体
              </option>
              <option value="华文楷体">
                华文楷体
              </option>
              <option value="华文宋体">
                华文宋体
              </option>
              <option value="黑体">
                黑体
              </option>
              <option value="system-ui">
                系统默认
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- 字体大小 -->
      <div
        v-if="settings.enabled"
        class="setting-row"
      >
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="formatSize"
              :size="13"
              class="label-icon"
            />
            {{ i18n.fontSize || '字体大小' }}
            <span class="setting-value">{{ settings.fontSize }}px</span>
          </label>
          <div class="slider-container">
            <input
              v-model.number="settings.fontSize"
              type="range"
              min="10"
              max="24"
              step="1"
              class="range-slider"
              @input="applySettings"
            />
            <div class="slider-labels">
              <span>10px</span>
              <span>24px</span>
            </div>
          </div>
          <div class="preset-buttons">
            <button
              v-for="size in presetFontSizes"
              :key="size"
              class="preset-btn"
              :class="[{ active: settings.fontSize === size }]"
              @click="setFontSize(size)"
            >
              {{ size }}px
            </button>
          </div>
        </div>
      </div>

      <!-- 行高 -->
      <div
        v-if="settings.enabled"
        class="setting-row"
      >
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="chevronDown"
              :size="13"
              class="label-icon"
            />
            {{ i18n.lineHeight || '行高' }}
            <span class="setting-value">{{ settings.lineHeight }}</span>
          </label>
          <div class="slider-container">
            <input
              v-model.number="settings.lineHeight"
              type="range"
              min="1.2"
              max="2.4"
              step="0.1"
              class="range-slider"
              @input="applySettings"
            />
            <div class="slider-labels">
              <span>1.2</span>
              <span>2.4</span>
            </div>
          </div>
          <div class="preset-buttons">
            <button
              v-for="lh in presetLineHeights"
              :key="lh"
              class="preset-btn"
              :class="[{ active: Math.abs(settings.lineHeight - lh) < 0.01 }]"
              @click="setLineHeight(lh)"
            >
              {{ lh }}
            </button>
          </div>
        </div>
      </div>

      <!-- 字间距 -->
      <div
        v-if="settings.enabled"
        class="setting-row"
      >
        <div class="setting-item">
          <label class="setting-label">
            <IconWrapper
              name="chevronRight"
              :size="13"
              class="label-icon"
            />
            {{ i18n.letterSpacing || '字间距' }}
            <span class="setting-value">{{ settings.letterSpacing }}px</span>
          </label>
          <div class="slider-container">
            <input
              v-model.number="settings.letterSpacing"
              type="range"
              min="0"
              max="5"
              step="0.5"
              class="range-slider"
              @input="applySettings"
            />
            <div class="slider-labels">
              <span>0px</span>
              <span>5px</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 段落间距 -->
      <div
        v-if="settings.enabled"
        class="setting-row"
      >
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">¶</span>
            {{ i18n.paragraphSpacing || '段落间距' }}
            <span class="setting-value">{{ settings.paragraphSpacing }}px</span>
          </label>
          <div class="slider-container">
            <input
              v-model.number="settings.paragraphSpacing"
              type="range"
              min="0"
              max="30"
              step="2"
              class="range-slider"
              @input="applySettings"
            />
            <div class="slider-labels">
              <span>0px</span>
              <span>30px</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 字重 -->
      <div
        v-if="settings.enabled"
        class="setting-row"
      >
        <div class="setting-item">
          <label class="setting-label">
            <span class="label-icon">𝐁</span>
            {{ i18n.fontWeight || '字体粗细' }}
          </label>
          <div class="font-weight-options">
            <button
              v-for="weight in fontWeights"
              :key="weight.value"
              class="weight-btn"
              :class="[{ active: settings.fontWeight === weight.value }]"
              @click="setFontWeight(weight.value)"
            >
              {{ weight.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 预览区域 -->
      <div
        v-if="settings.enabled"
        class="preview-section"
      >
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
            :style="previewStyle"
          >
            <h2>示例标题</h2>
            <p>这是一段示例文本,用于预览文档字体设置效果。The quick brown fox jumps over the lazy dog.</p>
            <p>思源笔记是一款本地优先的个人知识管理系统,支持块级引用和双向链接。它可以帮助您构建个人知识图谱,让知识之间的关联更加清晰。</p>
            <p>支持 Markdown 语法,让您专注于内容创作。丰富的功能特性,满足各种知识管理需求。</p>
          </div>
        </transition>
      </div>

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

import IconWrapper from "@/components/IconWrapper.vue"
import { DocumentFontSettings, GeneralSettingsStorage } from "../types/storage"
import { applyDocumentFontStyles } from "../utils/styles"

interface Props {
  i18n?: any
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

const DEFAULT_SETTINGS: DocumentFontSettings = {
  enabled: false,
  fontFamily: "",
  fontSize: 12,
  lineHeight: 1.6,
  letterSpacing: 0,
  paragraphSpacing: 8,
  fontWeight: "normal",
}

const settings = ref<DocumentFontSettings>({ ...DEFAULT_SETTINGS })
const showPreview = ref(true)
const presetFont = ref("")

const presetFontSizes = [12, 14, 16, 18]
const presetLineHeights = [1.4, 1.6, 1.8, 2.0]

const fontWeights = [
  {
    label: "细体",
    value: "lighter",
  },
  {
    label: "正常",
    value: "normal",
  },
  {
    label: "粗体",
    value: "bold",
  },
]

const previewStyle = computed(() => ({
  fontFamily: settings.value.fontFamily || "inherit",
  fontSize: `${settings.value.fontSize}px`,
  lineHeight: settings.value.lineHeight,
  letterSpacing: `${settings.value.letterSpacing}px`,
  fontWeight: settings.value.fontWeight,
}))

watch(
  settings,
  (newSettings) => {
    emit("change", newSettings)
    saveSettings()
  },
  { deep: true },
)

function applySettings() {
  applyDocumentFontStyles(settings.value)
}

function applyPresetFont() {
  if (presetFont.value) {
    settings.value.fontFamily = presetFont.value
    applySettings()
  }
}

function setFontSize(size: number) {
  settings.value.fontSize = size
  applySettings()
}

function setLineHeight(lh: number) {
  settings.value.lineHeight = lh
  applySettings()
}

function setFontWeight(weight: string) {
  settings.value.fontWeight = weight
  applySettings()
}

function togglePreview() {
  showPreview.value = !showPreview.value
}

function resetSettings() {
  settings.value = { ...DEFAULT_SETTINGS }
  presetFont.value = ""
  applySettings()
}

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

async function loadSettings() {
  if (!gsStorage.value) {
    return
  }

  try {
    const data = await gsStorage.value.documentFont.load()
    if (data) {
      settings.value = {
        ...DEFAULT_SETTINGS,
        ...data,
      }
      applySettings()
    }
  } catch (error) {
    console.error("加载文档字体设置失败:", error)
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

defineExpose({
  settings,
  loadSettings,
})
</script>

<style scoped lang="scss">
@use "../styles/DocumentFontSettings.scss";
</style>
