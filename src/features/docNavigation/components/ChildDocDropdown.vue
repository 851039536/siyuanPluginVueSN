<!-- 子文档下拉树形面板（通用）：DropdownShell 外壳 + 递归树节点，供「下级文档」「参考」复用 -->
<template>
  <DropdownShell
    :trigger-icon="triggerIcon"
    :trigger-text="triggerText"
    :count="childDocs.length"
    panel-role="tree"
    :panel-aria-label="triggerText"
    :panel-title="panelTitle"
  >
    <!-- 父组件 v-if="childCount > 0" 已保证 childDocs 非空，空状态分支不可达故移除 -->
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
  </DropdownShell>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import type { Block } from "../types"
import DropdownShell from "./DropdownShell.vue"
import TreeNode from "./TreeNode.vue"

withDefaults(defineProps<{
  childDocs: Block[]
  notebook: string
  currentDocId: string
  i18n: Record<string, string>
  openDoc: (docId: string) => void
  stripHtml: (html: string) => string
  /** 触发按钮文字（下级文档传 i18n.docNavShowChildren，参考传 i18n.docNavReference） */
  triggerText: string
  /** 面板标题（下级文档传 i18n.docNavPanelTitle，参考传 i18n.docNavReferencePanelTitle） */
  panelTitle: string
  /** 触发按钮图标名（参考传 docNavReference），默认 docNavChildren */
  triggerIcon?: IconKey
}>(), {
  triggerIcon: "docNavChildren",
})
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
