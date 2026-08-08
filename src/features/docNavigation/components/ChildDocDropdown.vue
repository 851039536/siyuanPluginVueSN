<!-- 子文档下拉树形面板（通用）：触发按钮 + 树形列表，供「下级文档」「参考」复用，点击外部关闭 -->
<template>
  <div
    class="doc-nav-dropdown"
    ref="rootRef"
  >
    <!-- 下拉触发按钮：triggerText (N) -->
    <button
      class="doc-nav-dropdown-trigger"
      :class="{ 'doc-nav-dropdown-trigger-open': isOpen }"
      type="button"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      <IconWrapper
        :name="triggerIconName"
        size="14"
        aria-hidden="true"
      />
      <span class="doc-nav-dropdown-trigger-text">{{ triggerText }} ({{ childCount }})</span>
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
        :aria-label="triggerText"
      >
        <!-- 面板标题：panelTitle -->
        <div class="doc-nav-dropdown-header">{{ panelTitle }}</div>
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
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type { IconKey } from "@/config/icons"
import type { Block } from "../types"
import TreeNode from "./TreeNode.vue"

const props = defineProps<{
  childDocs: Block[]
  notebook: string
  currentDocId: string
  childCount: number
  i18n: Record<string, string>
  openDoc: (docId: string) => void
  stripHtml: (html: string) => string
  /** 触发按钮文字（下级文档传 i18n.docNavShowChildren，参考传 i18n.docNavReference） */
  triggerText: string
  /** 面板标题（下级文档传 i18n.docNavPanelTitle，参考传 i18n.docNavReferencePanelTitle） */
  panelTitle: string
  /** 触发按钮图标名（参考传 docNavReference），默认 docNavChildren */
  triggerIcon?: string
}>()

/** 触发按钮图标名计算属性：未传时回退 docNavChildren */
const triggerIconName = computed<IconKey>(() => {
  return (props.triggerIcon || "docNavChildren") as IconKey
})

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
