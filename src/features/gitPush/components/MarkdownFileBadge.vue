<!-- gitPush Markdown 文件标识徽章 — 显示在 ProjectCard 路径行下方 -->
<template>
  <!-- 徽章按钮（tooltip："预览 <文件名>"） -->
  <button
    class="gp-md-badge"
    :class="`gp-md-badge--${variant}`"
    :title="i18n.previewFileTitle.replace('{0}', filename)"
    @click.stop="$emit('select')"
  >
    <Icon
      icon="mdi:file-document-outline"
      height="10"
    />
    <span class="gp-md-badge-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import type { MdFileVariant } from "../composables/useMarkdownFiles"
import { Icon } from "@iconify/vue"

defineProps<{
  filename: string
  label: string
  variant: MdFileVariant
  i18n: Record<string, any>
}>()

defineEmits<{
  select: []
}>()
</script>

<style lang="scss">
@use "../styles/MarkdownFileBadge.scss";
</style>
