<!-- 单条书签标记规则编辑卡片：字段编辑只上报 patch（内存）+ commit（落盘），不直接改写父级对象 -->
<template>
  <div class="rule-item">
    <!-- 卡片头部：序号 + 删除按钮（ariaLabel："删除此规则"） -->
    <div class="rule-header">
      <span class="rule-index">#{{ index + 1 }}</span>
      <Button
        variant="ghost"
        text
        size="xsmall"
        icon="close"
        :aria-label="i18n.ruleRemoveLabel"
        @click="$emit('remove')"
      />
    </div>

    <div class="rule-fields">
      <!-- 书签名称标签输入 -->
      <div class="rule-row">
        <!-- 标签："书签名称" -->
        <Label
          size="small"
          width="70px"
        >{{ i18n.bookmarkName }}</Label>
        <TagInputField
          :i18n="i18n"
          :names="rule.bookmarkNames"
          @add="applyNames([...rule.bookmarkNames, $event])"
          @remove="applyNames(rule.bookmarkNames.filter((_, i) => i !== $event))"
        />
      </div>

      <!-- 图标名输入 + 预设字形网格 -->
      <IconSelectField
        :i18n="i18n"
        :icon="rule.icon ?? ''"
        :color="rule.color"
        :background-color="rule.backgroundColor"
        :show-preset="mode !== 'bg'"
        @update:icon="applyIcon"
        @commit="commit"
      />

      <!-- 文字颜色 -->
      <div class="rule-row">
        <!-- 标签："文字颜色" -->
        <Label
          size="small"
          width="70px"
        >{{ i18n.markerTextColor }}</Label>
        <ColorField
          :model-value="rule.color"
          placeholder="#ffffff"
          @update:model-value="patch({ color: $event })"
          @change="commit"
        />
      </div>

      <!-- 背景颜色 -->
      <div class="rule-row">
        <!-- 标签："背景颜色" -->
        <Label
          size="small"
          width="70px"
        >{{ i18n.markerBgColor }}</Label>
        <ColorField
          :model-value="rule.backgroundColor"
          placeholder="#52c41a"
          @update:model-value="patch({ backgroundColor: $event })"
          @change="commit"
        />
      </div>

      <!-- 显示模式：文字标签 / 仅图标 / 图标+背景 / 字体背景 -->
      <ModeGroupField
        :label="i18n.markerDisplayMode"
        :model-value="mode"
        :options="displayModeOptions"
        @select="applyDisplayMode"
      />

      <!-- 背景透明度（拖动只更新内存，松手才落盘） -->
      <div class="rule-row">
        <!-- 标签："背景透明度" -->
        <Label
          size="small"
          width="70px"
        >{{ i18n.bgAlpha }}</Label>
        <Slider
          class="alpha-slider"
          :model-value="alpha"
          :min="0"
          :max="1"
          :step="0.05"
          show-value
          :format-value="formatAlpha"
          @update:model-value="applyAlpha"
          @change="commit"
        />
      </div>

      <!-- 匹配模式：精确 / 前缀 / 包含 -->
      <ModeGroupField
        :label="i18n.matchMode"
        :model-value="rule.matchMode ?? 'exact'"
        :options="matchModeOptions"
        @select="applyMatchMode"
      />
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
import type { IconKey } from "@/config/icons"
import type { BookmarkMarkerI18n, BookmarkRule, DisplayMode, MatchMode, RulePatch } from "../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import ColorField from "@/components/ColorField.vue"
import Label from "@/components/Label.vue"
import Slider from "@/components/Slider.vue"
import IconSelectField from "./ruleItem/IconSelectField.vue"
import ModeGroupField from "./ruleItem/ModeGroupField.vue"
import TagInputField from "./ruleItem/TagInputField.vue"
import { DEFAULT_ALPHA } from "../types"
import {
  hexToRgba,
  resolveAlpha,
  resolveMode,
} from "../utils"

const props = defineProps<{
  /** 规则对象（只读：编辑一律经 patch 上报，禁止直接改写） */
  rule: BookmarkRule
  index: number
  i18n: BookmarkMarkerI18n
}>()

const emit = defineEmits<{
  /** 单字段补丁：父级在自己拥有的规则对象上合并（仅内存生效） */
  patch: [patch: RulePatch]
  /** 提交信号：父级落盘 + 通知 Manager + 提示 */
  commit: []
  /** 删除本规则：父级按对象身份定位 */
  remove: []
}>()

const mode = computed(() => resolveMode(props.rule))
const alpha = computed(() => resolveAlpha(props.rule))

/** 提交补丁（默认同时触发落盘；持续型交互可只 patch，由 change 时机 commit） */
const patch = (payload: RulePatch, persist = true) => {
  emit("patch", payload)
  if (persist) emit("commit")
}

const commit = () => emit("commit")

const applyNames = (names: string[]) => patch({ bookmarkNames: names })

/** 字形变更：预设网格点击即时落盘，手输字符由输入框 change 触发落盘 */
const applyIcon = (icon: string) => patch({ icon })

/** 透明度拖动：只更新内存（百分比实时跟随），松手时由 change 触发落盘 */
const applyAlpha = (value: number | null) => patch({ alpha: value ?? DEFAULT_ALPHA }, false)

const applyDisplayMode = (value: string) => patch({ displayMode: value as DisplayMode })
const applyMatchMode = (value: string) => patch({ matchMode: value as MatchMode })

const formatAlpha = (value: number): string => `${(value * 100).toFixed(0)}%`

const displayModeOptions = computed<Array<{ value: DisplayMode, label: string, icon: IconKey }>>(() => [
  { value: "bg", label: props.i18n.modeTextLabel, icon: "file" },
  { value: "icon", label: props.i18n.modeIconOnly, icon: "image" },
  { value: "icon-bg", label: props.i18n.modeIconBg, icon: "image" },
  { value: "row", label: props.i18n.modeRow, icon: "format" },
])

const matchModeOptions = computed<Array<{ value: MatchMode, label: string }>>(() => [
  { value: "exact", label: props.i18n.matchExact },
  { value: "prefix", label: props.i18n.matchPrefix },
  { value: "contains", label: props.i18n.matchContains },
])

const previewStyle = computed(() => {
  if (mode.value === "icon" && props.rule.icon) {
    return {
      color: props.rule.color,
      backgroundColor: "transparent",
    }
  }
  const base = {
    color: props.rule.color,
    backgroundColor: hexToRgba(props.rule.backgroundColor, alpha.value),
  }
  if (mode.value === "row") {
    return {
      ...base,
      padding: "6px 12px",
      borderRadius: "4px",
    }
  }
  return base
})

const previewText = computed(() => {
  // 文案："未命名"
  const name = props.rule.bookmarkNames?.[0] || props.i18n.unnamed
  if ((mode.value === "icon" || mode.value === "icon-bg") && props.rule.icon) return props.rule.icon
  return props.rule.icon ? `${props.rule.icon} ${name}` : name
})
</script>

<style scoped lang="scss">
@use "../styles/fieldRow.scss" as *;
@use "../styles/RuleItem.scss";
</style>
