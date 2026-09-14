<!-- 快捷键卡片：内容行（主内容自适应为按键徽章组 / 等宽代码芯片 + 弱化快捷键徽章 + 悬停浮出的操作按钮）+ 名称与描述行 -->
<template>
  <div class="shortcut-row">
    <!-- 内容行：主内容整块是复制触发区 -->
    <div class="shortcut-row__top">
      <button
        v-if="display.kind === 'keys'"
        type="button"
        class="shortcut-row__content shortcut-row__content--keys"
        :title="display.content"
        :aria-label="copyLabel"
        @click="$emit('copy', shortcut)"
      >
        <span
          v-for="sequence in keySequences"
          :key="sequence"
          class="shortcut-row__key"
        >{{ sequence }}</span>
      </button>
      <button
        v-else
        type="button"
        class="shortcut-row__content shortcut-row__content--code"
        :title="display.content"
        :aria-label="copyLabel"
        @click="$emit('copy', shortcut)"
      >{{ display.content }}</button>

      <!-- 次显快捷键：仅当快捷键与主内容不同且本身是按键组合 -->
      <span
        v-if="display.hotkey"
        class="shortcut-row__hotkey"
        :title="display.hotkey"
      >{{ display.hotkey }}</span>

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

    <!-- 名称行 + 描述行（描述放不下时自动折到第二行） -->
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
import {
  resolveShortcutDisplay,
  splitKeySequences,
} from "../utils"

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

/** 显示模型：主内容形态与次显快捷键由纯函数判定（与复制逻辑同源） */
const display = computed(() => resolveShortcutDisplay(props.shortcut))

/** 按键组合形态才按 `,` 拆序列（代码芯片整体显示，避免含逗号的命令被拆散） */
const keySequences = computed(() =>
  display.value.kind === "keys" ? splitKeySequences(display.value.content) : [],
)

/** 复制触发区的可访问名：形如「复制：npm install」，含可见文本以满足无障碍标签匹配 */
const copyLabel = computed(() => {
  const template = props.i18n.scCopyContentLabel
  return template ? template.replace("{content}", display.value.content) : display.value.content
})
</script>

<style scoped lang="scss">
@use "../styles/ShortcutRow.scss";
</style>
