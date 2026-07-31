<!-- 列表样式设置：有序/无序列表层级颜色与无序符号大小配置，样式经共享工具函数注入编辑器 -->
<template>
  <div class="list-style-settings">
    <div class="settings-container">
      <!-- 模块标题与描述 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标题："列表样式" -->
          <SettingLabel
            icon="listBulleted"
            :text="i18n.listStyleSettings"
          />
          <!-- 描述："自定义有序列表和无序列表的颜色和样式" -->
          <p class="setting-description">
            {{ i18n.listStyleSettingsDesc }}
          </p>
        </div>
      </div>

      <!-- 启用开关 -->
      <div class="setting-row">
        <div class="setting-item">
          <!-- 标签："启用列表样式设置" -->
          <SettingLabel
            icon="sparkles"
            :text="i18n.enableListStyle"
          />
          <div class="toggle-container">
            <SiSwitch
              v-model="settings.enabled"
              @change="handleToggleChange"
            />
            <!-- 开关状态："已启用" / "已禁用" -->
            <span class="toggle-description">
              {{ settings.enabled ? i18n.enabled : i18n.disabled }}
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
            <!-- 区块标题："有序列表颜色" / "无序列表颜色" -->
            <span class="section-title">{{ i18n[section.titleKey] }}</span>
          </div>

          <div class="color-grid">
            <div
              v-for="(_, index) in settings[section.key]"
              :key="`${section.key}-${index}`"
              class="color-item"
            >
              <!-- 层级标签："层级 N" -->
              <label class="color-label">{{ levelLabel(index) }}</label>
              <ColorField v-model="settings[section.key][index]" />
            </div>
          </div>
        </div>

        <!-- 无序列表符号大小 -->
        <div class="setting-row">
          <div class="setting-item">
            <!-- 标签："无序列表符号大小" + 当前值徽标 -->
            <SettingLabel
              icon="formatSize"
              :text="i18n.listSymbolSize"
              :value="`${settings.symbolSize}em`"
            />
            <SettingSlider
              v-model="settings.symbolSize"
              :min="SYMBOL_SIZE_MIN"
              :max="SYMBOL_SIZE_MAX"
              :step="SYMBOL_SIZE_STEP"
              :show-value="false"
            />
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
            <!-- 折叠标题："预览效果" -->
            <span>{{ i18n.preview }}</span>
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
              :style="previewStyle"
            >
              <!-- 预览小节标题："有序列表" -->
              <div class="preview-section-title">
                {{ i18n.orderedList }}
              </div>
              <!-- 预览示例："第一/二/三层级项目" -->
              <ol class="preview-list preview-ordered">
                <li>
                  {{ i18n.listPreviewLevel1 }}
                  <ol>
                    <li>
                      {{ i18n.listPreviewLevel2 }}
                      <ol>
                        <li>{{ i18n.listPreviewLevel3 }}</li>
                      </ol>
                    </li>
                  </ol>
                </li>
              </ol>

              <!-- 预览小节标题："无序列表" -->
              <div class="preview-section-title">
                {{ i18n.unorderedList }}
              </div>
              <!-- 预览示例："第一/二/三层级项目" -->
              <ul class="preview-list preview-unordered">
                <li>
                  {{ i18n.listPreviewLevel1 }}
                  <ul>
                    <li>
                      {{ i18n.listPreviewLevel2 }}
                      <ul>
                        <li>{{ i18n.listPreviewLevel3 }}</li>
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
            <!-- 按钮文案："恢复默认设置" -->
            <span>{{ i18n.resetToDefault }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { ListStyleSettings as ListStyleSettingsData } from "../types/storage"
import type { IconKey } from "@/config/icons"

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
  createDefaultListStyleSettings,
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
  (e: "change", settings: ListStyleSettingsData): void
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
/** 无序列表符号大小范围（em） */
const SYMBOL_SIZE_MIN = 1.0
const SYMBOL_SIZE_MAX = 2.5
const SYMBOL_SIZE_STEP = 0.1

/** 颜色区块配置——数据驱动，消除有序 / 无序两段重复模板 */
type ColorArrayKey = "orderedListColors" | "unorderedListColors"

const colorSections: {
  key: ColorArrayKey
  titleKey: string
  icon: IconKey
}[] = [
  {
    key: "orderedListColors",
    titleKey: "orderedListColors",
    icon: "listOrdered",
  },
  {
    key: "unorderedListColors",
    titleKey: "unorderedListColors",
    icon: "list",
  },
]

const settings = ref<ListStyleSettingsData>(createDefaultListStyleSettings())
const showPreview = ref(true)

/** 预览用 CSS 变量：与 buildListStyleEnhancedCss 的层级取色/符号大小规则保持一致（预览仅展示前 3 层） */
const previewStyle = computed(() => {
  const vars: Record<string, string> = {
    "--preview-symbol-size": `${settings.value.symbolSize}em`,
  }
  for (let i = 0; i < 3; i++) {
    vars[`--preview-ordered-${i + 1}`] = settings.value.orderedListColors[i] ?? "inherit"
    vars[`--preview-unordered-${i + 1}`] = settings.value.unorderedListColors[i] ?? "inherit"
  }
  return vars
})

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

/** 层级标签："层级 N" */
function levelLabel(index: number): string {
  return (props.i18n.listLevelLabel || "").replace("{n}", String(index + 1))
}

function togglePreview() {
  showPreview.value = !showPreview.value
}

function handleToggleChange() {
  showMessage(
    settings.value.enabled ? props.i18n.listStyleEnabledMsg : props.i18n.listStyleDisabledMsg,
    MESSAGE_DURATION_MS,
    "info",
  )
}

function resetSettings() {
  settings.value = createDefaultListStyleSettings()
  showMessage(props.i18n.resetDoneMsg, MESSAGE_DURATION_MS, "info")
}

const gsStorage = computed(() => props.plugin ? new GeneralSettingsStorage(props.plugin) : null)

async function loadSettings() {
  if (!gsStorage.value) return
  try {
    const data = await gsStorage.value.listStyle.load()
    if (data) {
      skipWatchOnce = true
      settings.value = {
        ...createDefaultListStyleSettings(),
        ...data,
      }
      // 样式无需在此应用：启动链路 GeneralSettings.init() 已应用过
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
@use "../styles/ListStyleSettings.scss";
</style>
