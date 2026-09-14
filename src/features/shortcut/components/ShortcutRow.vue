<!-- 快捷键卡片：上行按键徽章 + 悬停浮出的操作按钮，下行名称 / 标签 / 描述 -->
<template>
  <div
    class="shortcut-row"
    :class="{
      'is-favorite': isFavorite,
      'is-recent': isRecent,
      'is-conflict': hasConflict,
    }"
  >
    <!-- 上行：按键徽章（点击复制）+ 行内操作（悬停 / 聚焦浮出） -->
    <div class="shortcut-row__top">
      <button
        type="button"
        class="shortcut-row__keys"
        :title="hasConflict ? conflictTitle : i18n.copy"
        @click="$emit('copy', shortcut)"
      >
        <span
          v-for="sequence in keySequences"
          :key="sequence"
          class="shortcut-row__key"
        >{{ sequence }}</span>
      </button>

      <div class="shortcut-row__actions">
        <Button
          variant="ghost"
          size="xsmall"
          :icon="isFavorite ? 'star' : 'starOutline'"
          :title="isFavorite ? i18n.unFavorite : i18n.favorite"
          @click="$emit('toggleFavorite', shortcut.id)"
        />
        <Button
          variant="ghost"
          size="xsmall"
          icon="contentCopy"
          :title="i18n.copy"
          @click="$emit('copy', shortcut)"
        />
        <Button
          v-if="!isPreset"
          variant="ghost"
          size="xsmall"
          icon="edit"
          :title="i18n.edit"
          @click="$emit('edit', shortcut)"
        />
        <Button
          v-if="!isPreset"
          variant="ghost"
          size="xsmall"
          icon="delete"
          :title="i18n.delete"
          @click="$emit('delete', shortcut.id)"
        />
      </div>
    </div>

    <!-- 下行：名称 + 平台 / 工具标签 + 冲突警示 + 描述 -->
    <div class="shortcut-row__meta">
      <span
        v-if="isRecent"
        class="shortcut-row__recent"
        aria-hidden="true"
      ></span>
      <span class="shortcut-row__name">{{ shortcut.name }}</span>
      <Tag
        v-if="shortcut.platform"
        variant="secondary"
        size="xsmall"
      >
        {{ shortcut.platform }}
      </Tag>
      <Tag
        v-if="showToolBadge"
        variant="info"
        size="xsmall"
      >
        {{ categoryLabel }}
      </Tag>
      <span
        v-if="hasConflict"
        class="shortcut-row__warning"
        :title="conflictTitle"
      >
        <IconWrapper
          name="warning"
          :size="12"
        />
      </span>
      <span
        v-if="shortcut.description"
        class="shortcut-row__desc"
      >{{ shortcut.description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ShortcutInfo } from "../types"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Tag from "@/components/Tag.vue"
import { splitKeySequences } from "../utils"

interface Props {
  shortcut: ShortcutInfo
  isFavorite: boolean
  isRecent: boolean
  isPreset: boolean
  /** 冲突条目名称列表（空数组表示无冲突） */
  conflictNames: string[]
  categoryLabel: string
  /** 是否显示分类标签（组头已写明工具名时不再重复） */
  showToolBadge: boolean
  i18n: Record<string, string>
}

const props = defineProps<Props>()

defineEmits<{
  toggleFavorite: [id: string]
  copy: [shortcut: ShortcutInfo]
  edit: [shortcut: ShortcutInfo]
  delete: [id: string]
}>()

const keySequences = computed(() => splitKeySequences(props.shortcut.keys))

const hasConflict = computed(() => props.conflictNames.length > 0)

const conflictTitle = computed(() =>
  `${props.i18n.scConflictWith}: ${props.conflictNames.join(" / ")}`,
)
</script>

<style scoped lang="scss">
@use "../styles/ShortcutRow.scss";
</style>
