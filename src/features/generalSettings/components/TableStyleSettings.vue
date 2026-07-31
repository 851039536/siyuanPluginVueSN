<!-- 表格样式设置：单元格边框/表头/斑马纹/文本颜色与圆角配置，样式经共享工具函数注入编辑器 -->
<template>
  <div class="table-style-settings">
    <!-- 标题："表格样式" -->
    <SettingLabel
      icon="tableBorder"
      :text="i18n.tableStyleSettings"
    />
    <SiSwitch
      v-model="settings.enabled"
      @change="handleToggleChange"
    />
    <!-- 描述："自定义表格的边框、背景、颜色等样式" -->
    <p class="toggle-description">
      {{ i18n.tableStyleSettingsDesc }}
    </p>

    <template v-if="settings.enabled">
      <!-- 颜色设置卡片 -->
      <div class="style-card">
        <div class="card-title">
          <span class="title-icon"><IconWrapper
            name="codeBlockColor"
            :size="14"
          /></span>
          <!-- 卡片标题："表格样式" -->
          {{ i18n.tableStyleSettings }}
        </div>

        <div
          v-for="field in colorFields"
          :key="field.key"
          class="style-row"
        >
          <!-- 字段标签："单元格边框" / "表头背景" / "奇数行背景" / "偶数行背景" / "文本颜色" -->
          <label class="style-label">{{ i18n[field.labelKey] }}</label>
          <ColorField
            v-model="settings[field.key]"
            :placeholder="field.placeholder"
          />
        </div>

        <!-- 圆角大小 -->
        <div class="style-row">
          <label class="style-label">
            <!-- 字段标签："圆角大小" + 当前值徽标 -->
            {{ i18n.tableBorderRadius }}
            <span class="slider-value">{{ settings.borderRadius }}px</span>
          </label>
          <SettingSlider
            v-model="settings.borderRadius"
            :min="BORDER_RADIUS_MIN"
            :max="BORDER_RADIUS_MAX"
            :step="BORDER_RADIUS_STEP"
            :show-value="false"
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
          <!-- 折叠标题："预览效果" -->
          <span>{{ i18n.preview }}</span>
          <span class="preview-arrow"><IconWrapper
            name="chevronDown"
            :size="10"
          /></span>
        </div>
        <div
          v-show="showPreview"
          class="preview-body"
        >
          <!-- 预览表格：表头"标题 N" + 单元格"数据 R-C" -->
          <table
            class="preview-table"
            :style="previewTableStyle"
          >
            <thead>
              <tr>
                <th
                  v-for="col in PREVIEW_COLS"
                  :key="`h-${col}`"
                >
                  {{ previewHeader(col) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in PREVIEW_ROWS"
                :key="`r-${row}`"
              >
                <td
                  v-for="col in PREVIEW_COLS"
                  :key="`c-${row}-${col}`"
                >
                  {{ previewCell(row, col) }}
                </td>
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
      <!-- 按钮文案："恢复默认设置" -->
      <span>{{ i18n.resetToDefault }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { TableStyleSettings as TableStyleSettingsData } from "../types/storage"

import { showMessage } from "siyuan"
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
  DEFAULT_TABLE_STYLE_SETTINGS,
  GeneralSettingsStorage,
} from "../types/storage"
import ColorField from "./ColorField.vue"
import SettingLabel from "./SettingLabel.vue"
import SettingSlider from "./SettingSlider.vue"

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

/** 修改后延迟保存的防抖时长（毫秒） */
const SAVE_DEBOUNCE_MS = 100
/** showMessage 提示的展示时长（毫秒） */
const MESSAGE_DURATION_MS = 2000
/** 圆角大小范围（px） */
const BORDER_RADIUS_MIN = 0
const BORDER_RADIUS_MAX = 20
const BORDER_RADIUS_STEP = 1
/** 预览表格行列数 */
const PREVIEW_ROWS = 3
const PREVIEW_COLS = 3

/** 颜色字段配置——数据驱动 */
const colorFields: {
  key: keyof Pick<TableStyleSettingsData, "cellBorderColor" | "headerBackground" | "oddRowBackground" | "evenRowBackground" | "textColor">
  labelKey: string
  placeholder: string
}[] = [
  {
    key: "cellBorderColor",
    labelKey: "tableCellBorder",
    placeholder: "#000000",
  },
  {
    key: "headerBackground",
    labelKey: "tableHeaderBackground",
    placeholder: "#e0ffd6",
  },
  {
    key: "oddRowBackground",
    labelKey: "tableOddRowBackground",
    placeholder: "#ffffff",
  },
  {
    key: "evenRowBackground",
    labelKey: "tableEvenRowBackground",
    placeholder: "#f8f8f8",
  },
  {
    key: "textColor",
    labelKey: "tableTextColor",
    placeholder: "#000000",
  },
]

const settings = ref<TableStyleSettingsData>({ ...DEFAULT_TABLE_STYLE_SETTINGS })
const showPreview = ref(true)

const previewTableStyle = computed(() => ({
  "borderRadius": `${settings.value.borderRadius}px`,
  "--preview-cell-border": settings.value.cellBorderColor,
  "--preview-header-bg": settings.value.headerBackground,
  "--preview-odd-bg": settings.value.oddRowBackground,
  "--preview-even-bg": settings.value.evenRowBackground,
  "--preview-text-color": settings.value.textColor,
}))

/** 防抖保存定时器 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null
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
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      saveSettings()
    }, SAVE_DEBOUNCE_MS)
  },
  { deep: true },
)

/** 预览表头："标题 N" */
function previewHeader(col: number): string {
  return (props.i18n.tablePreviewHeader || "").replace("{n}", String(col))
}

/** 预览单元格："数据 R-C" */
function previewCell(row: number, col: number): string {
  return (props.i18n.tablePreviewCell || "")
    .replace("{r}", String(row))
    .replace("{c}", String(col))
}

function togglePreview() {
  showPreview.value = !showPreview.value
}

function handleToggleChange() {
  // 保存与样式应用由 watch(deep) 统一处理，此处仅提示
  showMessage(
    settings.value.enabled ? props.i18n.tableStyleEnabledMsg : props.i18n.tableStyleDisabledMsg,
    MESSAGE_DURATION_MS,
    "info",
  )
}

function resetSettings() {
  settings.value = { ...DEFAULT_TABLE_STYLE_SETTINGS }
  showMessage(props.i18n.resetDoneMsg, MESSAGE_DURATION_MS, "info")
}

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

async function loadSettings() {
  if (!gsStorage.value) return
  try {
    const data = await gsStorage.value.tableStyle.load()
    if (data) {
      skipWatchOnce = true
      settings.value = {
        ...DEFAULT_TABLE_STYLE_SETTINGS,
        ...data,
      }
      // 样式无需在此应用：启动链路 GeneralSettings.init() 已应用过
    }
  } catch (error) {
    console.error("加载表格样式设置失败:", error)
  }
}

async function saveSettings() {
  if (!gsStorage.value) return
  try {
    await gsStorage.value.tableStyle.save(settings.value)
  } catch (error) {
    console.error("保存表格样式设置失败:", error)
  }
}

onMounted(loadSettings)

// 卸载时清理防抖定时器，并立即落盘待保存的修改，避免关闭面板丢失最后一次变更
onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
    saveSettings()
  }
})
</script>

<style scoped lang="scss">
@use "../styles/TableStyleSettings.scss";
</style>
