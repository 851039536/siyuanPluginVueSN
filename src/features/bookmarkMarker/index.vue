<template>
  <div class="bookmark-marker-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        <IconWrapper
          name="bookmarkMarker"
          :size="18"
          class="panel-title__icon"
        />
        {{ i18n?.title || "书签标记" }}
      </h3>
      <button
        class="close-btn"
        @click="props.onClose?.()"
      >
        <IconWrapper
          name="close"
          :size="16"
        />
      </button>
    </div>

    <div class="panel-content">
      <!-- 功能开关 -->
      <label class="setting-label">
        <IconWrapper
          name="bookmarkMarker"
          :size="14"
        />
        {{ i18n?.enableBookmarkMarker || "书签标记" }}
      </label>
      <SiSwitch
        v-model="settings.enableBookmarkMarker.value"
        @change="handleToggleChange"
      />
      <p class="toggle-description">
        {{ i18n?.bookmarkMarkerDescription || "根据文档书签内容在文件树中显示颜色标记" }}
      </p>

      <!-- 功能说明 -->
      <div class="feature-description">
        <div class="description-title">
          <IconWrapper
            name="lightbulb"
            :size="14"
          />
          {{ i18n?.featureDescription || "功能说明" }}
        </div>
        <ul class="description-list">
          <li>{{ i18n?.bookmarkFeature1 || "在文件树中为有书签的文档显示颜色标签" }}</li>
          <li>{{ i18n?.bookmarkFeature2 || "书签为空则不显示标记" }}</li>
          <li>{{ i18n?.bookmarkFeature3 || "可自定义书签名称与对应颜色" }}</li>
          <li>{{ i18n?.bookmarkFeature4 || "支持手机端和桌面端" }}</li>
        </ul>
      </div>

      <!-- 标记规则设置 -->
      <template v-if="settings.enableBookmarkMarker.value">
        <div class="rules-settings">
          <div class="settings-title">
            <IconWrapper
              name="bookmarkMarker"
              :size="14"
            />
            {{ i18n?.bookmarkRules || "标记规则" }}
            <button
              class="refresh-btn"
              @click="handleRefresh"
            >
              <IconWrapper
                name="refresh"
                :size="12"
              />
              {{ i18n?.refreshNow || "立即刷新" }}
            </button>
          </div>

          <div
            v-for="(rule, index) in settings.rules.value"
            :key="index"
            class="rule-item"
          >
            <div class="rule-header">
              <span class="rule-index">#{{ index + 1 }}</span>
              <button
                class="rule-remove-btn"
                @click="removeRule(index)"
              >
                <IconWrapper
                  name="close"
                  :size="12"
                />
              </button>
            </div>
            <div class="rule-fields">
              <div class="rule-row">
                <label class="rule-label">
                  {{ i18n?.bookmarkName || "书签名称" }}
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
                  {{ i18n?.markerIcon || "图标" }}
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
                  {{ i18n?.presetIcons || "预设图标" }}
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
                  {{ i18n?.markerTextColor || "文字颜色" }}
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
                  {{ i18n?.markerBgColor || "背景颜色" }}
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
                  {{ i18n?.displayMode || "显示模式" }}
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
                    <IconWrapper
                      name="file"
                      :size="14"
                    />
                    {{ i18n?.modeTextLabel || "文字标签" }}
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
                    <IconWrapper
                      name="image"
                      :size="14"
                    />
                    {{ i18n?.modeIconOnly || "仅图标" }}
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
                    <IconWrapper
                      name="image"
                      :size="14"
                    />
                    {{ i18n?.modeIconBg || "图标+背景" }}
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
                    <IconWrapper
                      name="format"
                      :size="14"
                    />
                    {{ i18n?.modeRow || "字体背景" }}
                  </label>
                </div>
              </div>
              <!-- 透明度 -->
              <div class="rule-row">
                <label class="rule-label">
                  {{ i18n?.bgAlpha || "背景透明度" }}
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
                  {{ i18n?.matchMode || "匹配模式" }}
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
                    {{ i18n?.matchExact || "精确" }}
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
                    {{ i18n?.matchPrefix || "前缀" }}
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
                    {{ i18n?.matchContains || "包含" }}
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
            <IconWrapper
              name="plus"
              :size="14"
            />
            {{ i18n?.addRule || "添加规则" }}
          </button>
        </div>

        <!-- 更新间隔设置 -->
        <div class="update-interval">
          <label class="interval-label">
            {{ i18n?.updateInterval || "更新间隔" }}
          </label>
          <select
            v-model="settings.updateInterval.value"
            class="interval-select"
            @change="handleIntervalChange"
          >
            <option value="1800000">
              {{ i18n?.interval30min || "30分钟" }}
            </option>
            <option value="3600000">
              {{ i18n?.interval1hour || "1小时" }}
            </option>
            <option value="7200000">
              {{ i18n?.interval2hour || "2小时" }}
            </option>
            <option value="14400000">
              {{ i18n?.interval4hour || "4小时" }}
            </option>
          </select>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan"
import IconWrapper from "@/components/IconWrapper.vue"
import type { BookmarkRule } from "./types"
import SiSwitch from "@/components/Switch.vue"
import { hexToRgba } from "./utils"
import { useBookmarkMarkerSettings } from "./composables/useBookmarkMarkerSettings"

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
  onBookmarkMarkerChange?: (action: string, data?: any) => void
  onClose?: () => void
}>()

const settings = useBookmarkMarkerSettings(props.plugin)

const presetIcons = [
  "🔖",
  "🏷️",
  "📑",
  "📌",
  "📍",
  "✅",
  "❌",
  "⚠️",
  "🔄",
  "📝",
  "⭐",
  "🏆",
  "🚀",
  "🔥",
  "⚡",
  "🎉",
  "💡",
  "📄",
  "📁",
  "🖊️",
  "✏️",
  "📎",
  "🔗",
  "🌈",
  "✨",
  "💫",
  "🪄",
  "💬",
  "💭",
  "🗨️",
  "💡",
  "🔔",
  "🔐",
  "🔒",
  "🔑",
  "🛡️",
  "🔍",
  "🗂️",
  "📚",
  "📦",
]

const handleToggleChange = async () => {
  await settings.save()
  props.onBookmarkMarkerChange?.("toggle", {
    enabled: settings.enableBookmarkMarker.value,
    rules: settings.rules.value,
    updateInterval: Number(settings.updateInterval.value),
  })
  showMessage(
    settings.enableBookmarkMarker.value ? "书签标记已启用" : "书签标记已禁用",
    2000,
    "info",
  )
}

const handleRulesChange = async () => {
  await settings.save()
  props.onBookmarkMarkerChange?.("rulesChanged", { rules: settings.rules.value })
  showMessage("标记规则已更新", 2000, "info")
}

const handleIntervalChange = async () => {
  await settings.save()
  props.onBookmarkMarkerChange?.("intervalChanged", { updateInterval: Number(settings.updateInterval.value) })
  showMessage("更新间隔已修改", 2000, "info")
}

const addRule = () => {
  settings.rules.value.push({
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
  settings.rules.value.splice(index, 1)
  handleRulesChange()
}

const selectIcon = (index: number, icon: string) => {
  const rule = settings.rules.value[index]
  rule.icon = rule.icon === icon ? "" : icon
  handleRulesChange()
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
      backgroundColor: hexToRgba(rule.backgroundColor, alpha),
      padding: "6px 12px",
      borderRadius: "4px",
    }
  }
  return {
    color: rule.color,
    backgroundColor: hexToRgba(rule.backgroundColor, alpha),
  }
}

const getPreviewText = (rule: BookmarkRule) => {
  const mode = rule.displayMode || "bg"
  const name = rule.bookmarkNames?.[0] || "未命名"
  if ((mode === "icon" || mode === "icon-bg") && rule.icon) return rule.icon
  return rule.icon ? `${rule.icon} ${name}` : name
}

const addTag = (ruleIndex: number, event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement
  const value = input.value.trim()
  if (!value) return
  const rule = settings.rules.value[ruleIndex]
  if (!rule.bookmarkNames.includes(value)) {
    rule.bookmarkNames.push(value)
    input.value = ""
    handleRulesChange()
  }
}

const removeTag = (ruleIndex: number, tagIndex: number) => {
  settings.rules.value[ruleIndex].bookmarkNames.splice(tagIndex, 1)
  handleRulesChange()
}

const handleTagBackspace = (ruleIndex: number, event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement
  if (input.value === "") {
    const tags = settings.rules.value[ruleIndex].bookmarkNames
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
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
