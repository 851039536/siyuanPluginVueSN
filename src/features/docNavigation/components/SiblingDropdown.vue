<!-- 同级文档下拉面板：通用外壳（DropdownShell）+ 扁平同级文档列表 -->
<template>
  <DropdownShell
    trigger-icon="docNavSiblings"
    :trigger-text="i18n.docNavSiblings"
    :count="siblings.length"
    panel-role="listbox"
    :panel-aria-label="i18n.docNavSiblingPanelTitle"
    :panel-title="i18n.docNavSiblingPanelTitle"
  >
    <!-- 同级文档链接列表 -->
    <div
      v-for="doc in siblings"
      :key="doc.id"
      class="doc-nav-sibling-item"
      :class="{ 'doc-nav-sibling-item--current': doc.id === currentDocId }"
      role="option"
      :aria-selected="doc.id === currentDocId"
      :title="stripHtml(doc.content)"
      @click="openDoc(doc.id)"
    >
      <span class="doc-nav-sibling-item-text">{{ stripHtml(doc.content) }}</span>
    </div>
  </DropdownShell>
</template>

<script setup lang="ts">
import type { Block } from "../types"
import DropdownShell from "./DropdownShell.vue"

defineProps<{
  siblings: Block[]
  currentDocId: string
  i18n: Record<string, string>
  openDoc: (docId: string) => void
  stripHtml: (html: string) => string
}>()
</script>

<style scoped lang="scss">
@use "../styles/SiblingDropdown.scss";
@use "../styles/index.scss";
</style>
