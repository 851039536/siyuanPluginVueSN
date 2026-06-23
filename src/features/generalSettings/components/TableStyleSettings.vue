<template>
  <div class="table-style-settings">
    <label class="setting-label">
      <span class="label-icon"><IconWrapper
        name="tableBorder"
        :size="14"
      /></span>
      {{ i18n.tableStyleSettings || '表格样式设置' }}
    </label>
    <SiSwitch
      v-model="settings.enabled"
      @change="handleToggleChange"
    />
    <p class="toggle-description">
      {{ i18n.tableStyleSettingsDesc || '自定义表格的边框、背景、颜色等样式' }}
    </p>

    <template v-if="settings.enabled">
      <!-- 颜色设置 -->
      <div class="style-card">
        <div class="card-title">
          <span class="title-icon"><IconWrapper
            name="codeBlockColor"
            :size="14"
          /></span>
          {{ i18n.tableStyleSettings || '表格样式' }}
        </div>

        <div
          v-for="field in colorFields"
          :key="field.key"
          class="style-row"
        >
          <label class="style-label">{{ i18n[field.labelKey] || field.fallback }}</label>
          <div class="color-input-group">
            <input
              v-model="settings[field.key]"
              type="color"
              class="color-picker"
              @input="handleColorChange"
            />
            <input
              v-model="settings[field.key]"
              type="text"
              class="color-text"
              :placeholder="field.placeholder"
              @change="handleColorChange"
            />
          </div>
        </div>

        <!-- 圆角大小 -->
        <div class="style-row">
          <label class="style-label">
            {{ i18n.tableBorderRadius || '圆角大小' }}
            <span class="slider-value">{{ settings.borderRadius }}px</span>
          </label>
          <input
            v-model.number="settings.borderRadius"
            type="range"
            min="0"
            max="20"
            step="1"
            class="range-slider"
          />
        </div>
      </div>

      <!-- 预览区域 -->
      <div class="preview-card">
        <div
          class="preview-header"
          @click="togglePreview"
        >
          <span class="preview-header-icon"><IconWrapper
            :name="showPreview ? 'eye' : 'eyeOff'"
            :size="14"
          /></span>
          <span>{{ i18n.preview || '预览效果' }}</span>
          <span class="preview-arrow"><IconWrapper
            name="chevronDown"
            :size="10"
          /></span>
        </div>
        <div
          v-show="showPreview"
          class="preview-body"
        >
          <table
            class="preview-table"
            :style="previewTableStyle"
          >
            <thead>
              <tr>
                <th>标题 1</th>
                <th>标题 2</th>
                <th>标题 3</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>数据 1-1</td>
                <td>数据 1-2</td>
                <td>数据 1-3</td>
              </tr>
              <tr>
                <td>数据 2-1</td>
                <td>数据 2-2</td>
                <td>数据 2-3</td>
              </tr>
              <tr>
                <td>数据 3-1</td>
                <td>数据 3-2</td>
                <td>数据 3-3</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- 重置按钮 -->
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
</template>

<script setup lang="ts">
import type { TableStyleSettings as TableStyleSettingsData } from "../types/storage"
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
  (e: "change", settings: TableStyleSettingsData): void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: undefined,
})

const emit = defineEmits<Emits>()

const STYLE_ID = "table-style-settings"

const DEFAULT_SETTINGS: TableStyleSettingsData = {
  enabled: false,
  cellBorderColor: "rgba(0, 0, 0, 0.171)",
  headerBackground: "#e0ffd6",
  oddRowBackground: "#ffffff",
  evenRowBackground: "#f8f8f8",
  textColor: "#000000",
  borderRadius: 6,
}

/** 颜色字段配置——数据驱动 */
const colorFields: {
  key: keyof Pick<TableStyleSettingsData, "cellBorderColor" | "headerBackground" | "oddRowBackground" | "evenRowBackground" | "textColor">
  labelKey: string
  fallback: string
  placeholder: string
}[] = [
  {
    key: "cellBorderColor",
    labelKey: "tableCellBorder",
    fallback: "单元格边框",
    placeholder: "#000000",
  },
  {
    key: "headerBackground",
    labelKey: "tableHeaderBackground",
    fallback: "表头背景",
    placeholder: "#e0ffd6",
  },
  {
    key: "oddRowBackground",
    labelKey: "tableOddRowBackground",
    fallback: "奇数行背景",
    placeholder: "#ffffff",
  },
  {
    key: "evenRowBackground",
    labelKey: "tableEvenRowBackground",
    fallback: "偶数行背景",
    placeholder: "#f8f8f8",
  },
  {
    key: "textColor",
    labelKey: "tableTextColor",
    fallback: "文本颜色",
    placeholder: "#000000",
  },
]

const settings = ref<TableStyleSettingsData>({ ...DEFAULT_SETTINGS })
const showPreview = ref(true)

const previewTableStyle = computed(() => ({
  "borderRadius": `${settings.value.borderRadius}px`,
  "--preview-cell-border": settings.value.cellBorderColor,
  "--preview-header-bg": settings.value.headerBackground,
  "--preview-odd-bg": settings.value.oddRowBackground,
  "--preview-even-bg": settings.value.evenRowBackground,
  "--preview-text-color": settings.value.textColor,
}))

/** 防抖保存 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  settings,
  (newSettings) => {
    emit("change", newSettings)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => saveSettings(), 100)
    applyTableStyles(newSettings)
  },
  { deep: true },
)

function togglePreview() {
  showPreview.value = !showPreview.value
}

function handleToggleChange() {
  saveSettings()
  applyTableStyles(settings.value)
  showMessage(
    settings.value.enabled ? "表格样式已启用" : "表格样式已禁用",
    2000,
    "info",
  )
}

function handleColorChange() {
  // watch(deep) 自动处理保存和样式应用
}

function resetSettings() {
  settings.value = { ...DEFAULT_SETTINGS }
  showMessage("已恢复默认设置", 2000, "info")
}

function applyTableStyles(tableSettings: TableStyleSettingsData) {
  try {
    removeStyle(STYLE_ID)
    if (!tableSettings.enabled) return

    const css = `
      .protyle-wysiwyg table {
        border-collapse: collapse;
        border-radius: ${tableSettings.borderRadius}px;
        overflow: hidden;
      }
      .protyle-wysiwyg table th,
      .protyle-wysiwyg table td {
        border: 1px solid ${tableSettings.cellBorderColor};
      }
      .protyle-wysiwyg table th {
        background-color: ${tableSettings.headerBackground};
        color: ${tableSettings.textColor};
      }
      .protyle-wysiwyg table tr:nth-child(odd) {
        background-color: ${tableSettings.oddRowBackground};
      }
      .protyle-wysiwyg table tr:nth-child(even) {
        background-color: ${tableSettings.evenRowBackground};
      }
      .protyle-wysiwyg table td {
        color: ${tableSettings.textColor};
      }
    `
    injectStyle(STYLE_ID, css)
  } catch (error) {
    console.error("应用表格样式失败:", error)
  }
}

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

async function loadSettings() {
  if (!gsStorage.value) return
  try {
    const data = await gsStorage.value.tableStyle.load()
    if (data) {
      settings.value = {
        ...DEFAULT_SETTINGS,
        ...data,
      }
      applyTableStyles(settings.value)
    }
  } catch (error) {
    console.error("加载表格样式设置失败:", error)
  }
}

async function saveSettings() {
  if (!gsStorage.value) return
  try { await gsStorage.value.tableStyle.save(settings.value) } catch (error) {
    console.error("保存表格样式设置失败:", error)
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
@use "../styles/TableStyleSettings.scss";
</style>
