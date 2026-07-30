<template>
  <!-- 单条书签标记规则编辑卡片 -->
  <div class="rule-item">
    <!-- 卡片头部：序号 + 删除按钮 -->
    <div class="rule-header">
      <span class="rule-index">#{{ index + 1 }}</span>
      <button
        class="rule-remove-btn"
        @click="emit('remove')"
      >
        <IconWrapper
          name="close"
          :size="12"
        />
      </button>
    </div>
    <div class="rule-fields">
      <!-- 书签名称标签输入 -->
      <div class="rule-row">
        <!-- 标签："书签名称" -->
        <label class="rule-label">
          {{ i18n.bookmarkName }}
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
              @click="removeTag(tagIndex)"
            >×</span>
          </div>
          <!-- 占位符："输入书签名，回车添加" -->
          <input
            type="text"
            class="tag-input"
            :placeholder="i18n.bookmarkNamePlaceholder"
            @keydown.enter.prevent="addTag($event)"
            @keydown.,.prevent="addTag($event)"
            @keydown.backspace="handleTagBackspace($event)"
          />
        </div>
      </div>
      <!-- 图标输入 -->
      <div class="rule-row">
        <!-- 标签："图标" -->
        <label class="rule-label">
          {{ i18n.markerIcon }}
        </label>
        <div class="icon-input-wrapper">
          <!-- 占位符："🔖 输入 emoji" -->
          <input
            v-model="rule.icon"
            type="text"
            class="rule-input icon-input"
            :placeholder="i18n.markerIconPlaceholder"
            maxlength="2"
            @change="emit('change')"
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
        <!-- 标签："预设图标" -->
        <label class="rule-label">
          {{ i18n.presetIcons }}
        </label>
        <div class="icon-picker-grid">
          <span
            v-for="icon in PRESET_ICONS"
            :key="icon"
            class="icon-option"
            :class="{ selected: rule.icon === icon }"
            @click="selectIcon(icon)"
          >{{ icon }}</span>
        </div>
      </div>
      <!-- 文字颜色 -->
      <div class="rule-row">
        <!-- 标签："文字颜色" -->
        <label class="rule-label">
          {{ i18n.markerTextColor }}
        </label>
        <div class="color-input-wrapper">
          <input
            v-model="rule.color"
            type="color"
            class="color-picker"
            @input="emit('change')"
          />
          <input
            v-model="rule.color"
            type="text"
            class="color-text"
            placeholder="#ffffff"
            @change="emit('change')"
          />
        </div>
      </div>
      <!-- 背景颜色 -->
      <div class="rule-row">
        <!-- 标签："背景颜色" -->
        <label class="rule-label">
          {{ i18n.markerBgColor }}
        </label>
        <div class="color-input-wrapper">
          <input
            v-model="rule.backgroundColor"
            type="color"
            class="color-picker"
            @input="emit('change')"
          />
          <input
            v-model="rule.backgroundColor"
            type="text"
            class="color-text"
            placeholder="#52c41a"
            @change="emit('change')"
          />
        </div>
      </div>
      <!-- 显示模式 -->
      <div class="rule-row">
        <!-- 标签："显示模式" -->
        <label class="rule-label">
          {{ i18n.displayMode }}
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
              @change="emit('change')"
            />
            <IconWrapper
              name="file"
              :size="14"
            />
            <!-- 选项："文字标签" -->
            {{ i18n.modeTextLabel }}
          </label>
          <label
            class="mode-option"
            :class="{ active: rule.displayMode === 'icon' }"
          >
            <input
              v-model="rule.displayMode"
              type="radio"
              value="icon"
              @change="emit('change')"
            />
            <IconWrapper
              name="image"
              :size="14"
            />
            <!-- 选项："仅图标" -->
            {{ i18n.modeIconOnly }}
          </label>
          <label
            class="mode-option"
            :class="{ active: rule.displayMode === 'icon-bg' }"
          >
            <input
              v-model="rule.displayMode"
              type="radio"
              value="icon-bg"
              @change="emit('change')"
            />
            <IconWrapper
              name="image"
              :size="14"
            />
            <!-- 选项："图标+背景" -->
            {{ i18n.modeIconBg }}
          </label>
          <label
            class="mode-option"
            :class="{ active: rule.displayMode === 'row' }"
          >
            <input
              v-model="rule.displayMode"
              type="radio"
              value="row"
              @change="emit('change')"
            />
            <IconWrapper
              name="format"
              :size="14"
            />
            <!-- 选项："字体背景" -->
            {{ i18n.modeRow }}
          </label>
        </div>
      </div>
      <!-- 背景透明度滑块 -->
      <div class="rule-row">
        <!-- 标签："背景透明度" -->
        <label class="rule-label">
          {{ i18n.bgAlpha }}
        </label>
        <div class="slider-container">
          <input
            v-model.number="rule.alpha"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="alpha-slider"
            @input="emit('change')"
          />
          <span class="alpha-value">{{ (resolveAlpha(rule) * 100).toFixed(0) }}%</span>
        </div>
      </div>
      <!-- 匹配模式 -->
      <div class="rule-row">
        <!-- 标签："匹配模式" -->
        <label class="rule-label">
          {{ i18n.matchMode }}
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
              @change="emit('change')"
            />
            <!-- 选项："精确" -->
            {{ i18n.matchExact }}
          </label>
          <label
            class="mode-option"
            :class="{ active: rule.matchMode === 'prefix' }"
          >
            <input
              v-model="rule.matchMode"
              type="radio"
              value="prefix"
              @change="emit('change')"
            />
            <!-- 选项："前缀" -->
            {{ i18n.matchPrefix }}
          </label>
          <label
            class="mode-option"
            :class="{ active: rule.matchMode === 'contains' }"
          >
            <input
              v-model="rule.matchMode"
              type="radio"
              value="contains"
              @change="emit('change')"
            />
            <!-- 选项："包含" -->
            {{ i18n.matchContains }}
          </label>
        </div>
      </div>
    </div>
    <!-- 效果预览 -->
    <div class="rule-preview">
      <!-- 文案："预览：" -->
      <span class="preview-label-text">{{ i18n.previewLabel }}</span>
      <span
        class="preview-tag"
        :style="previewStyle"
      >{{ previewText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 书签标记 — 单条规则编辑器
 * 直接编辑父级传入的 rule 对象（嵌套字段），修改后 emit change 通知父级持久化
 */
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { BookmarkRule } from "../types"
import {
  hexToRgba,
  resolveAlpha,
  resolveMode,
} from "../utils"

const props = defineProps<{
  rule: BookmarkRule
  index: number
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  change: []
  remove: []
}>()

/** 预设 emoji 图标（供快速选择） */
const PRESET_ICONS = [
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

const previewStyle = computed(() => {
  const mode = resolveMode(props.rule)
  if (mode === "icon" && props.rule.icon) {
    return {
      color: props.rule.color,
      backgroundColor: "transparent",
    }
  }
  const base = {
    color: props.rule.color,
    backgroundColor: hexToRgba(props.rule.backgroundColor, resolveAlpha(props.rule)),
  }
  if (mode === "row") {
    return {
      ...base,
      padding: "6px 12px",
      borderRadius: "4px",
    }
  }
  return base
})

const previewText = computed(() => {
  const mode = resolveMode(props.rule)
  // 文案："未命名"
  const name = props.rule.bookmarkNames?.[0] || props.i18n.unnamed
  if ((mode === "icon" || mode === "icon-bg") && props.rule.icon) return props.rule.icon
  return props.rule.icon ? `${props.rule.icon} ${name}` : name
})

const addTag = (event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement
  const value = input.value.trim()
  if (!value) return
  if (!props.rule.bookmarkNames.includes(value)) {
    props.rule.bookmarkNames.push(value)
    input.value = ""
    emit("change")
  }
}

const removeTag = (tagIndex: number) => {
  props.rule.bookmarkNames.splice(tagIndex, 1)
  emit("change")
}

const handleTagBackspace = (event: KeyboardEvent) => {
  const input = event.target as HTMLInputElement
  if (input.value === "") {
    if (props.rule.bookmarkNames.length > 0) {
      props.rule.bookmarkNames.pop()
      emit("change")
    }
  }
}

const selectIcon = (icon: string) => {
  props.rule.icon = props.rule.icon === icon ? "" : icon
  emit("change")
}
</script>

<style scoped lang="scss">
@use "../styles/RuleItem.scss";
@use "../styles/index.scss";
</style>
