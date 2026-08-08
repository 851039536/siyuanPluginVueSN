<!-- 同级文档下拉面板：触发按钮 + 扁平同级文档列表，与 ChildDocDropdown 外壳一致，点击外部关闭 -->
<template>
  <div
    class="doc-nav-dropdown"
    ref="rootRef"
  >
    <!-- 下拉触发按钮：同级 (N) -->
    <button
      class="doc-nav-dropdown-trigger"
      :class="{ 'doc-nav-dropdown-trigger-open': isOpen }"
      type="button"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <IconWrapper
        :name="'docNavSiblings'"
        size="14"
        aria-hidden="true"
      />
      <span class="doc-nav-dropdown-trigger-text">{{ i18n.docNavSiblings }} ({{ siblingCount }})</span>
      <IconWrapper
        name="chevronDown"
        class="doc-nav-dropdown-caret"
        size="12"
        aria-hidden="true"
      />
    </button>

    <!-- 下拉面板：扁平同级文档列表 -->
    <Transition name="doc-nav-dropdown-fade">
      <div
        v-if="isOpen"
        class="doc-nav-dropdown-panel"
        role="listbox"
        :aria-label="i18n.docNavSiblingPanelTitle"
      >
        <!-- 面板标题 -->
        <div class="doc-nav-dropdown-header">{{ i18n.docNavSiblingPanelTitle }}</div>
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
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { Block } from "../types"

defineProps<{
  siblings: Block[]
  siblingCount: number
  currentDocId: string
  i18n: Record<string, string>
  openDoc: (docId: string) => void
  stripHtml: (html: string) => string
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

/** 点击下拉面板外部区域时关闭面板 */
function handleDocumentClick(event: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener("click", handleDocumentClick)
})
</script>

<style scoped lang="scss">
@use "../styles/SiblingDropdown.scss";
@use "../styles/index.scss";
</style>
