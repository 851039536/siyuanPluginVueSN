<!-- 快捷键卡片：上行按键徽章 + 悬停浮出的复制/编辑/删除，下行名称与描述（描述放不下时自动折行） -->
<template>
  <div class="shortcut-row">
    <!-- 上行：按键徽章（点击复制）+ 行内操作（悬停 / 聚焦浮出，空间恒定预留） -->
    <div class="shortcut-row__top">
      <button
        type="button"
        class="shortcut-row__keys"
        :title="i18n.copy"
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

    <!-- 下行：名称 + 平台 / 分类标签 + 描述 -->
    <div class="shortcut-row__title">
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
import Tag from "@/components/Tag.vue"
import { splitKeySequences } from "../utils"

interface Props {
  shortcut: ShortcutInfo
  isPreset: boolean
  categoryLabel: string
  /** 是否显示分类标签（组头已写明工具名时不再重复） */
  showToolBadge: boolean
  i18n: Record<string, string>
}

const props = defineProps<Props>()

defineEmits<{
  copy: [shortcut: ShortcutInfo]
  edit: [shortcut: ShortcutInfo]
  delete: [id: string]
}>()

const keySequences = computed(() => splitKeySequences(props.shortcut.keys))
</script>

<style scoped lang="scss">
@use "../styles/ShortcutRow.scss";
</style>
