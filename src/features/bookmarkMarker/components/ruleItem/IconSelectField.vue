<!-- 图标字段：图标名输入 + 当前字形预览，附预设字形网格（可点击选择/再次点击取消） -->
<template>
  <!-- 图标名输入 -->
  <div class="rule-row">
    <Label
      size="small"
      width="70px"
    >{{ i18n.markerIcon }}</Label>
    <div class="icon-input-wrapper">
      <!-- 占位符："🔖 输入 emoji" -->
      <Input
        class="icon-input"
        size="small"
        :model-value="icon"
        :placeholder="i18n.markerIconPlaceholder"
        :maxlength="2"
        @update:model-value="$emit('update:icon', String($event ?? ''))"
        @change="$emit('commit')"
      />
      <span
        v-if="icon"
        class="icon-preview-tag"
        :style="{ color, backgroundColor }"
      >{{ icon }}</span>
    </div>
  </div>
  <!-- 预设字形网格（仅非纯文字标签模式展示） -->
  <div
    v-if="showPreset"
    class="rule-row"
  >
    <Label
      size="small"
      width="70px"
    >{{ i18n.presetIcons }}</Label>
    <div class="icon-picker-grid">
      <!-- 字形是用户可选的标记内容（业务数据），故以按钮文本承载而非 icon prop -->
      <Button
        v-for="glyph in PRESET_ICONS"
        :key="glyph"
        :variant="icon === glyph ? 'primary' : 'ghost'"
        text
        size="xsmall"
        :title="glyph"
        :aria-pressed="icon === glyph"
        @click="$emit('update:icon', icon === glyph ? '' : glyph)"
      >
        {{ glyph }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BookmarkMarkerI18n } from "../../types"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Label from "@/components/Label.vue"

defineProps<{
  i18n: BookmarkMarkerI18n
  /** 当前字形（emoji 或任意 1~2 字符） */
  icon: string
  /** 预览字形文字色 */
  color: string
  /** 预览字形背景色 */
  backgroundColor: string
  /** 是否展示预设字形网格（纯文字标签模式无字形，不展示） */
  showPreset: boolean
}>()

defineEmits<{
  'update:icon': [icon: string]
  'commit': []
}>()

/**
 * 预设 emoji 字形（供快速选择）。
 * 合规例外：emoji 是用户可选的标记字形（业务数据），最终以 textContent 写入思源
 * 文件树/文档标题，不是插件 UI 图标；选择项本身仍由共享 Button 承载。
 */
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
] as const
</script>

<style scoped lang="scss">
@use "../../styles/fieldRow.scss" as *;
@use "../../styles/RuleItemIconField.scss" as *;
</style>
