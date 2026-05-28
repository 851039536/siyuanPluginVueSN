<template>
  <div class="bookmark-marker-panel">
    <div class="panel-header">
      <h3 class="panel-title">🔖 {{ i18n?.title || '书签标记' }}</h3>
    </div>

    <div class="panel-content">
      <!-- 功能开关 -->
      <label class="setting-label">
        <span class="label-icon">🔖</span>
        {{ i18n?.enableBookmarkMarker || '书签标记' }}
      </label>
      <SiSwitch
        v-model="enableBookmarkMarker"
        @change="handleToggleChange"
      />
      <p class="toggle-description">
        {{ i18n?.bookmarkMarkerDescription || '根据文档书签内容在文件树中显示颜色标记' }}
      </p>

      <!-- 功能说明 -->
      <div class="feature-description">
        <div class="description-title">
          <span class="title-icon">💡</span>
          {{ i18n?.featureDescription || '功能说明' }}
        </div>
        <ul class="description-list">
          <li>{{ i18n?.bookmarkFeature1 || '在文件树中为有书签的文档显示颜色标签' }}</li>
          <li>{{ i18n?.bookmarkFeature2 || '书签为空则不显示标记' }}</li>
          <li>{{ i18n?.bookmarkFeature3 || '可自定义书签名称与对应颜色' }}</li>
          <li>{{ i18n?.bookmarkFeature4 || '支持手机端和桌面端' }}</li>
        </ul>
      </div>

      <!-- 标记规则设置 -->
      <template v-if="enableBookmarkMarker">
        <div class="rules-settings">
          <div class="settings-title">
            <span class="title-icon">🏷️</span>
            {{ i18n?.bookmarkRules || '标记规则' }}
            <button
              class="refresh-btn"
              @click="handleRefresh"
            >
              🔄 {{ i18n?.refreshNow || '立即刷新' }}
            </button>
          </div>

          <div
            v-for="(rule, index) in rules"
            :key="index"
            class="rule-item"
          >
            <div class="rule-header">
              <span class="rule-index">#{{ index + 1 }}</span>
              <button
                class="rule-remove-btn"
                @click="removeRule(index)"
              >
                ✕
              </button>
            </div>
            <div class="rule-fields">
              <div class="rule-row">
                <label class="rule-label">
                  {{ i18n?.bookmarkName || '书签名称' }}
                </label>
                <div class="tags-input-wrapper">
                  <div
                    v-for="(tag, tagIndex) in rule.bookmarkNames"
                    :key="tagIndex"
                    class="tag-chip"
                  >
                    <span class="tag-text">{{ tag }}</span>
                    <span
                      class="tag-remove"
                      @click="removeTag(index, tagIndex)"
                    >×</span>
                  </div>
                  <input
                    :ref="(el) => { if (el) tagInputRefs[index] = el as HTMLInputElement }"
                    type="text"
                    class="tag-input"
                    :placeholder="i18n?.bookmarkNamePlaceholder || '输入书签名，回车添加'"
                    @keydown.enter.prevent="addTag(index, $event)"
                    @keydown.,.prevent="addTag(index, $event)"
                    @keydown.backspace="handleTagBackspace(index, $event)"
                    @change="handleRulesChange"
                  />
                </div>
              </div>
              <div class="rule-row">
                <label class="rule-label">
                  {{ i18n?.markerIcon || '图标' }}
                </label>
                <div class="icon-input-wrapper">
                  <input
                    v-model="rule.icon"
                    type="text"
                    class="rule-input icon-input"
                    :placeholder="i18n?.markerIconPlaceholder || '🔖 输入 emoji'"
                    maxlength="2"
                    @change="handleRulesChange"
                  />
                  <span
                    v-if="rule.icon"
                    class="icon-preview-tag"
                    :style="{
                      color: rule.color,
                      backgroundColor: rule.backgroundColor,
                    }"
                  >{{ rule.icon }}</span>
                </div>
              </div>
              <!-- 预设图标选择器 -->
              <div
                v-if="rule.displayMode && rule.displayMode !== 'bg'"
                class="rule-row icon-picker-row"
              >
                <label class="rule-label">
                  {{ i18n?.presetIcons || '预设图标' }}
                </label>
                <div class="icon-picker-grid">
                  <span
                    v-for="icon in presetIcons"
                    :key="icon"
                    class="icon-option"
                    :class="{ selected: rule.icon === icon }"
                    @click="selectIcon(index, icon)"
                  >{{ icon }}</span>
                </div>
              </div>
              <div class="rule-row">
                <label class="rule-label">
                  {{ i18n?.markerTextColor || '文字颜色' }}
                </label>
                <div class="color-input-wrapper">
                  <input
                    v-model="rule.color"
                    type="color"
                    class="color-picker"
                    @input="handleRulesChange"
                  />
                  <input
                    v-model="rule.color"
                    type="text"
                    class="color-text"
                    placeholder="#ffffff"
                    @change="handleRulesChange"
                  />
                </div>
              </div>
              <div class="rule-row">
                <label class="rule-label">
                  {{ i18n?.markerBgColor || '背景颜色' }}
                </label>
                <div class="color-input-wrapper">
                  <input
                    v-model="rule.backgroundColor"
                    type="color"
                    class="color-picker"
                    @input="handleRulesChange"
                  />
                  <input
                    v-model="rule.backgroundColor"
                    type="text"
                    class="color-text"
                    placeholder="#52c41a"
                    @change="handleRulesChange"
                  />
                </div>
              </div>
              <!-- 显示模式 -->
              <div class="rule-row">
                <label class="rule-label">
                  {{ i18n?.displayMode || '显示模式' }}
                </label>
                <div class="display-mode-group">
                  <label
                    class="mode-option"
                    :class="{ active: rule.displayMode === 'bg' || !rule.displayMode }"
                  >
                    <input
                      v-model="rule.displayMode"
                      type="radio"
                      value="bg"
                      @change="handleRulesChange"
                    />
                    📄 {{ i18n?.modeTextLabel || '文字标签' }}
                  </label>
                  <label
                    class="mode-option"
                    :class="{ active: rule.displayMode === 'icon' }"
                  >
                    <input
                      v-model="rule.displayMode"
                      type="radio"
                      value="icon"
                      @change="handleRulesChange"
                    />
                    🎨 {{ i18n?.modeIconOnly || '仅图标' }}
                  </label>
                  <label
                    class="mode-option"
                    :class="{ active: rule.displayMode === 'icon-bg' }"
                  >
                    <input
                      v-model="rule.displayMode"
                      type="radio"
                      value="icon-bg"
                      @change="handleRulesChange"
                    />
                    🖼️ {{ i18n?.modeIconBg || '图标+背景' }}
                  </label>
                  <label
                    class="mode-option"
                    :class="{ active: rule.displayMode === 'row' }"
                  >
                    <input
                      v-model="rule.displayMode"
                      type="radio"
                      value="row"
                      @change="handleRulesChange"
                    />
                    🎯 {{ i18n?.modeRow || '字体背景' }}
                  </label>
                </div>
              </div>
              <!-- 透明度 -->
              <div class="rule-row">
                <label class="rule-label">
                  {{ i18n?.bgAlpha || '背景透明度' }}
                </label>
                <div class="slider-container">
                  <input
                    v-model.number="rule.alpha"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    class="alpha-slider"
                    @input="handleRulesChange"
                  />
                  <span class="alpha-value">{{ ((rule.alpha ?? 0.25) * 100).toFixed(0) }}%</span>
                </div>
              </div>
              <!-- 匹配模式 -->
              <div class="rule-row">
                <label class="rule-label">
                  {{ i18n?.matchMode || '匹配模式' }}
                </label>
                <div class="match-mode-group">
                  <label
                    class="mode-option"
                    :class="{ active: !rule.matchMode || rule.matchMode === 'exact' }"
                  >
                    <input
                      v-model="rule.matchMode"
                      type="radio"
                      value="exact"
                      @change="handleRulesChange"
                    />
                    🎯 {{ i18n?.matchExact || '精确' }}
                  </label>
                  <label
                    class="mode-option"
                    :class="{ active: rule.matchMode === 'prefix' }"
                  >
                    <input
                      v-model="rule.matchMode"
                      type="radio"
                      value="prefix"
                      @change="handleRulesChange"
                    />
                    🔤 {{ i18n?.matchPrefix || '前缀' }}
                  </label>
                  <label
                    class="mode-option"
                    :class="{ active: rule.matchMode === 'contains' }"
                  >
                    <input
                      v-model="rule.matchMode"
                      type="radio"
                      value="contains"
                      @change="handleRulesChange"
                    />
                    🔍 {{ i18n?.matchContains || '包含' }}
                  </label>
                </div>
              </div>
            </div>
            <!-- 预览 -->
            <div class="rule-preview">
              <span class="preview-label-text">预览：</span>
              <span
                class="preview-tag"
                :style="getPreviewStyle(rule)"
              >{{ getPreviewText(rule) }}</span>
            </div>
          </div>

          <button
            class="add-rule-btn"
            @click="addRule"
          >
            + {{ i18n?.addRule || '添加规则' }}
          </button>
        </div>

        <!-- 更新间隔设置 -->
        <div class="update-interval">
          <label class="interval-label">
            {{ i18n?.updateInterval || '更新间隔' }}
          </label>
          <select
            v-model="updateInterval"
            class="interval-select"
            @change="handleIntervalChange"
          >
            <option value="1800000">
              {{ i18n?.interval30min || '30分钟' }}
            </option>
            <option value="3600000">
              {{ i18n?.interval1hour || '1小时' }}
            </option>
            <option value="7200000">
              {{ i18n?.interval2hour || '2小时' }}
            </option>
            <option value="14400000">
              {{ i18n?.interval4hour || '4小时' }}
            </option>
          </select>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BookmarkRule } from "./modules/BookmarkMarker"
import { showMessage } from "siyuan"
import {
  onMounted,
  ref,
} from "vue"
import SiSwitch from "@/components/Switch.vue"
import { BookmarkMarker } from "./modules/BookmarkMarker"
import { BookmarkMarkerStorage } from "./types/storage"

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
  bookmarkMarker?: BookmarkMarker
  onBookmarkMarkerChange?: (action: string, data?: any) => void
}>()

const enableBookmarkMarker = ref(true)
const rules = ref<BookmarkRule[]>([
  {
    bookmarkNames: ["已发布"],
    color: "#ffffff",
    backgroundColor: "#52c41a",
    alpha: 0.25,
    matchMode: "exact",
  },
  {
    bookmarkNames: ["待发布"],
    color: "#ffffff",
    backgroundColor: "#faad14",
    alpha: 0.25,
    matchMode: "exact",
  },
])
const updateInterval = ref("3600000")
const tagInputRefs = ref<Record<number, HTMLInputElement | null>>({})

const presetIcons = [
  "🔖", "🏷️", "📑", "📌", "📍",
  "✅", "❌", "⚠️", "🔄", "📝",
  "⭐", "🌟", "💎", "🏆", "🎯",
  "🚀", "🔥", "⚡", "🎉", "💡",
  "📋", "📄", "📊", "📈", "📁",
  "🖊️", "✏️", "📝", "📎", "🔗",
  "🎨", "🌈", "✨", "💫", "🪄",
  "💬", "💭", "🗨️", "💡", "🔔",
  "🔐", "🔒", "🔑", "🛡️", "🔍",
  "📂", "🗂️", "📚", "📦", "🧩",
]

const getStorage = () => props.plugin ? new BookmarkMarkerStorage(props.plugin) : null

const ensureStorage = (): BookmarkMarkerStorage => {
  const storage = getStorage()
  if (!storage) throw new Error("插件实例不可用")
  return storage
}

const saveAndNotify = async () => {
  try {
    await ensureStorage().settings.save({
      enableBookmarkMarker: enableBookmarkMarker.value,
      rules: rules.value,
      updateInterval: Number(updateInterval.value),
    })
    props.onBookmarkMarkerChange?.("settingsChanged", {
      enableBookmarkMarker: enableBookmarkMarker.value,
      rules: rules.value,
      updateInterval: updateInterval.value,
    })
  } catch (e) {
    console.error("保存书签标记设置失败:", e)
  }
}

const loadSettings = async () => {
  try {
    const storage = getStorage()
    const data = storage ? await storage.settings.loadOrDefault() : null
    if (data) {
      enableBookmarkMarker.value = data.enableBookmarkMarker ?? true
      rules.value = data.rules?.length
        ? data.rules.map((r: any) => ({
            ...r,
            bookmarkNames: r.bookmarkNames || (r.bookmarkName ? [r.bookmarkName] : []),
          }))
        : [
            {
              bookmarkNames: ["已发布"],
              color: "#ffffff",
              backgroundColor: "#52c41a",
              alpha: 0.25,
              matchMode: "exact",
            },
            {
              bookmarkNames: ["待发布"],
              color: "#ffffff",
              backgroundColor: "#faad14",
              alpha: 0.25,
              matchMode: "exact",
            },
          ]
      updateInterval.value = data.updateInterval?.toString() || "3600000"
    }
  } catch (e) {
    console.error("加载书签标记设置失败:", e)
  }
}

const handleToggleChange = async () => {
  await saveAndNotify()
  props.onBookmarkMarkerChange?.("toggle", {
    enabled: enableBookmarkMarker.value,
    rules: rules.value,
    updateInterval: Number(updateInterval.value),
  })
  showMessage(
    enableBookmarkMarker.value
      ? "书签标记已启用"
      : "书签标记已禁用",
    2000,
    "info",
  )
}

const handleRulesChange = async () => {
  await saveAndNotify()
  props.onBookmarkMarkerChange?.("rulesChanged", { rules: rules.value })
  showMessage("标记规则已更新", 2000, "info")
}

const handleIntervalChange = async () => {
  await saveAndNotify()
  props.onBookmarkMarkerChange?.("intervalChanged", { updateInterval: Number(updateInterval.value) })
  showMessage("更新间隔已修改", 2000, "info")
}

const addRule = () => {
  rules.value.push({
    bookmarkNames: [],
    color: "#ffffff",
    backgroundColor: "#1890ff",
    icon: "",
    displayMode: "bg",
    alpha: 0.25,
    matchMode: "exact",
  })
}

const removeRule = (index: number) => {
  rules.value.splice(index, 1)
  handleRulesChange()
}

const selectIcon = (index: number, icon: string) => {
  const rule = rules.value[index]
  if (rule.icon === icon) {
    rule.icon = ""
  } else {
    rule.icon = icon
  }
  handleRulesChange()
}

function previewHexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const getPreviewStyle = (rule: BookmarkRule) => {
  const mode = rule.displayMode || "bg"
  const alpha = rule.alpha ?? 0.25
  if (mode === "icon" && rule.icon) {
    return {
      color: rule.color,
      backgroundColor: "transparent",
    }
  }
  if (mode === "row") {
    return {
      color: rule.color,
      backgroundColor: previewHexToRgba(rule.backgroundColor, alpha),
      padding: "6px 12px",
      borderRadius: "4px",
    }
  }
  return {
    color: rule.color,
    backgroundColor: previewHexToRgba(rule.backgroundColor, alpha),
  }
}

const getPreviewText = (rule: BookmarkRule) => {
  const mode = rule.displayMode || "bg"
  const name = rule.bookmarkNames?.[0] || "未命名"
  if (mode === "icon" && rule.icon) {
    return rule.icon
  }
  if (mode === "icon-bg" && rule.icon) {
    return rule.icon
  }
  if (mode === "row") {
    return rule.icon ? `${rule.icon} ${name}` : name
  }
  return rule.icon ? `${rule.icon} ${name}` : name
}

const addTag = (ruleIndex: number, event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement
  const value = input.value.trim()
  if (!value) return
  const rule = rules.value[ruleIndex]
  if (!rule.bookmarkNames.includes(value)) {
    rule.bookmarkNames.push(value)
    input.value = ""
    handleRulesChange()
  }
}

const removeTag = (ruleIndex: number, tagIndex: number) => {
  rules.value[ruleIndex].bookmarkNames.splice(tagIndex, 1)
  handleRulesChange()
}

const handleTagBackspace = (ruleIndex: number, event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement
  if (input.value === "") {
    const tags = rules.value[ruleIndex].bookmarkNames
    if (tags.length > 0) {
      tags.pop()
      handleRulesChange()
    }
  }
}

const handleRefresh = () => {
  props.onBookmarkMarkerChange?.("refresh")
  showMessage("书签标记已刷新", 2000, "info")
}

onMounted(async () => {
  await loadSettings()
})

defineExpose({
  loadSettings,
  enableBookmarkMarker,
})
</script>

<style scoped>
.bookmark-marker-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
}

.label-icon {
  font-size: 14px;
  opacity: 0.8;
}

.toggle-description {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  margin-top: 8px;
  line-height: 1.4;
}

.feature-description {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.description-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 10px;
}

.title-icon {
  font-size: 14px;
}

.description-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
  line-height: 1.8;
}

.description-list li {
  margin-bottom: 4px;
}

.description-list li:last-child {
  margin-bottom: 0;
}

.rules-settings {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 14px;
}

.refresh-btn {
  margin-left: auto;
  padding: 3px 10px;
  font-size: 11px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.refresh-btn:hover {
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb), 0.05);
}

.rule-item {
  padding: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  margin-bottom: 10px;
}

.rule-item:last-of-type {
  margin-bottom: 14px;
}

.rule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.rule-index {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface-variant);
}

.rule-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-variant);
  cursor: pointer;
  font-size: 12px;
  opacity: 0.6;
  transition: all 0.2s;
}

.rule-remove-btn:hover {
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
  opacity: 1;
}

.rule-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-label {
  flex-shrink: 0;
  width: 70px;
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.rule-input {
  flex: 1;
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
}

.tags-input-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  flex: 1;
  padding: 3px 6px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  min-height: 32px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  font-size: 11px;
  background: rgba(var(--b3-theme-primary-rgb), 0.12);
  color: var(--b3-theme-primary);
  border-radius: 4px;
  white-space: nowrap;
  line-height: 1.4;
}

.tag-text {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 10px;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.15s;
  flex-shrink: 0;
}

.tag-remove:hover {
  opacity: 1;
  background: rgba(var(--b3-theme-primary-rgb), 0.2);
}

.tag-input {
  flex: 1;
  min-width: 80px;
  padding: 3px 4px;
  font-size: 12px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--b3-theme-on-background);
}

.tag-input::placeholder {
  color: var(--b3-theme-on-surface-variant);
  opacity: 0.5;
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.color-picker {
  width: 40px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  cursor: pointer;
  background: var(--b3-theme-background);
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-text {
  flex: 1;
  padding: 6px 10px;
  font-size: 13px;
  font-family: monospace;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
}

.icon-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 1;
}

.icon-input {
  flex: 1;
  min-width: 0;
}

.icon-preview-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 18px;
  border-radius: 6px;
  flex-shrink: 0;
}

.icon-picker-row {
  margin-top: 4px;
}

.icon-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.icon-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 17px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--b3-theme-background);
  user-select: none;
}

.icon-option:hover {
  border-color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb), 0.08);
  transform: scale(1.15);
}

.icon-option.selected {
  border-color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb), 0.15);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.2);
}

.display-mode-group {
  display: flex;
  gap: 6px;
  flex: 1;
  flex-wrap: wrap;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface-variant);
  user-select: none;
  white-space: nowrap;
}

.mode-option input {
  display: none;
}

.mode-option:hover {
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary);
}

.mode-option.active {
  border-color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb), 0.1);
  color: var(--b3-theme-primary);
  font-weight: 600;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.alpha-slider {
  flex: 1;
  height: 4px;
  cursor: pointer;
  accent-color: var(--b3-theme-primary);
}

.alpha-value {
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 600;
  min-width: 36px;
  text-align: right;
}

.match-mode-group {
  display: flex;
  gap: 6px;
  flex: 1;
  flex-wrap: wrap;
}

.rule-input:hover,
.color-text:hover,
.interval-select:hover {
  border-color: var(--b3-theme-primary);
}

.rule-input:focus,
.color-text:focus,
.interval-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}

.rule-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.preview-label-text {
  font-size: 12px;
  color: var(--b3-theme-on-surface-variant);
}

.preview-tag {
  display: inline-block;
  font-size: 10px;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 3px;
  font-weight: 500;
}

.add-rule-btn {
  display: block;
  width: 100%;
  padding: 8px;
  font-size: 13px;
  border: 1px dashed var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.add-rule-btn:hover {
  border-color: var(--b3-theme-primary);
  background: rgba(var(--b3-theme-primary-rgb), 0.05);
}

.update-interval {
  margin-top: 20px;
  padding: 12px 14px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
}

.interval-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
}

.interval-select {
  width: 100%;
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
}

.interval-select:hover {
  border-color: var(--b3-theme-primary);
}

.interval-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
  box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
}
</style>
