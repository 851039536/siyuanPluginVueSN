<!-- gitPush Markdown 文件标识徽章 — 显示在 ProjectCard 路径行下方 -->
<template>
  <!-- 徽章按钮（tooltip："预览 <文件名>"） -->
  <button
    class="gp-md-badge"
    :class="`gp-md-badge--${variant}`"
    :title="i18n.previewFileTitle.replace('{0}', filename)"
    @click.stop="$emit('select')"
  >
    {{ label }}
  </button>
</template>

<script setup lang="ts">
import type { MdFileVariant } from "../../composables/useMarkdownFiles"
import { computed } from "vue"
import { getMdLabel } from "../../composables/useMarkdownFiles"

const props = defineProps<{
  filename: string
  variant: MdFileVariant
  i18n: Record<string, any>
}>()

defineEmits<{
  select: []
}>()

/** 徽章显示标签（约定文件去扩展名大写，其他保留原始文件名） */
const label = computed(() => getMdLabel(props.filename, props.variant))
</script>

<style lang="scss">
@use "../../styles/MarkdownFileBadge.scss";
</style>
