<!-- 文档元数据信息条：创建/更新时间 + 块数统计，右对齐，hover 显示完整信息 tooltip -->
<template>
  <div
    v-if="docMeta"
    class="doc-meta-bar"
    :title="metaTooltip"
  >
    <span class="doc-meta-bar-item">{{ formatShortDate(docMeta.created) }} {{ i18n.docNavMetaCreated }}</span>
    <span
      class="doc-meta-bar-separator"
      aria-hidden="true"
    >·</span>
    <span class="doc-meta-bar-item">{{ formatRelativeTime(docMeta.updated) }} {{ i18n.docNavMetaUpdated }}</span>
    <span
      class="doc-meta-bar-separator"
      aria-hidden="true"
    >·</span>
    <span class="doc-meta-bar-item">{{ docMeta.count }} {{ i18n.docNavMetaBlocks }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import type { DocMeta } from "../types"
import {
  formatFullTime,
  formatRelativeTime,
  formatShortDate,
} from "../utils"

const props = defineProps<{
  docMeta: DocMeta | null
  i18n: Record<string, string>
}>()

/** hover 完整信息：创建/更新完整时间戳 + 块数 + 文件大小 */
const metaTooltip = computed(() => {
  if (!props.docMeta) {
    return ""
  }
  const parts = [
    `${props.i18n.docNavMetaCreatedAt} ${formatFullTime(props.docMeta.created)}`,
    `${props.i18n.docNavMetaUpdatedAt} ${formatFullTime(props.docMeta.updated)}`,
    `${props.docMeta.count} ${props.i18n.docNavMetaBlocks}`,
    `${props.docMeta.size} ${props.i18n.docNavMetaBytes}`,
  ]
  return parts.join(" · ")
})
</script>

<style scoped lang="scss">
@use "../styles/DocMetaBar.scss";
@use "../styles/index.scss";
</style>
