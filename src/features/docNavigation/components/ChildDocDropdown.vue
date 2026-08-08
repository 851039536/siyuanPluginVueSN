<!-- 子文档下拉树形面板：触发按钮 + 树形列表，点击外部关闭 -->
<template>
  <div
    class="doc-nav-dropdown"
    ref="rootRef"
  >
    <!-- 下拉触发按钮："下级文档 (N)" -->
    <button
      class="doc-nav-dropdown-trigger"
      :class="{ 'doc-nav-dropdown-trigger-open': isOpen }"
      type="button"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <IconWrapper
        name="docNavChildren"
        size="14"
        aria-hidden="true"
      />
      <span class="doc-nav-dropdown-trigger-text">{{ i18n.docNavShowChildren }} ({{ childCount }})</span>
      <IconWrapper
        name="chevronDown"
        class="doc-nav-dropdown-caret"
        size="12"
        aria-hidden="true"
      />
    </button>

    <!-- 下拉树形面板 -->
    <Transition name="doc-nav-dropdown-fade">
      <div
        v-if="isOpen"
        class="doc-nav-dropdown-panel"
        role="tree"
        :aria-label="i18n.docNavShowChildren"
      >
        <!-- 面板标题："子文档" -->
        <div class="doc-nav-dropdown-header">{{ i18n.docNavPanelTitle }}</div>
        <template v-if="childDocs.length">
          <TreeNode
            v-for="doc in childDocs"
            :key="doc.id"
            :node="doc"
            :notebook="notebook"
            :current-doc-id="currentDocId"
            :i18n="i18n"
            :open-doc="openDoc"
            :strip-html="stripHtml"
          />
        </template>
        <!-- 空状态提示："无下级文档" -->
        <div
          v-else
          class="doc-nav-dropdown-empty"
        >
          {{ i18n.docNavNoChildren }}
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
import TreeNode from "./TreeNode.vue"

defineProps<{
  childDocs: Block[]
  notebook: string
  currentDocId: string
  childCount: number
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
@use "../styles/ChildDocDropdown.scss";
@use "../styles/index.scss";
</style>
