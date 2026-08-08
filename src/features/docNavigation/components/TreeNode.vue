<!-- 递归树节点：文档链接 + 懒加载展开下级文档 -->
<template>
  <div
    class="doc-nav-tree-node"
    role="treeitem"
    :aria-expanded="hasChildren ? expanded : undefined"
  >
    <div class="doc-nav-tree-row">
      <!-- 展开箭头：仅当节点存在下级文档时显示 -->
      <button
        v-if="hasChildren"
        class="doc-nav-tree-arrow"
        type="button"
        :aria-label="expanded ? i18n.docNavCollapse : i18n.docNavExpand"
        @click="toggle"
      >
        <IconWrapper
          name="chevronRight"
          class="doc-nav-tree-arrow-icon"
          :class="{ 'doc-nav-tree-arrow-expanded': expanded }"
          size="12"
          aria-hidden="true"
        />
      </button>
      <span
        v-else
        class="doc-nav-tree-arrow doc-nav-tree-arrow-placeholder"
        aria-hidden="true"
      />
      <a
        class="doc-nav-tree-link"
        :class="{ 'doc-nav-tree-current': node.id === currentDocId }"
        :title="stripHtml(node.content)"
        :data-doc-id="node.id"
        @click="openDoc(node.id)"
      >
        {{ stripHtml(node.content) }}
      </a>
    </div>

    <div
      v-if="expanded"
      class="doc-nav-tree-children"
      role="group"
    >
      <!-- 加载中占位："加载中..." -->
      <div
        v-if="loading"
        class="doc-nav-tree-loading"
      >
        {{ i18n.docNavLoading }}
      </div>
      <template v-else>
        <TreeNode
          v-for="child in children"
          :key="child.id"
          :node="child"
          :notebook="notebook"
          :current-doc-id="currentDocId"
          :i18n="i18n"
          :open-doc="openDoc"
          :strip-html="stripHtml"
        />
        <!-- 加载后无下级文档 -->
        <div
          v-if="!children.length"
          class="doc-nav-tree-empty"
        >
          {{ i18n.docNavNoChildren }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import * as api from "@/api"
import type { Block } from "../types"
import { iFileToBlock } from "../types/storage"

defineOptions({ name: "TreeNode" })

const props = defineProps<{
  node: Block
  notebook: string
  currentDocId: string
  i18n: Record<string, string>
  openDoc: (docId: string) => void
  stripHtml: (html: string) => string
}>()

const expanded = ref(false)
const children = ref<Block[]>([])
const loading = ref(false)

const hasChildren = computed(() => {
  return (props.node.subFileCount ?? 0) > 0
})

/** 通过 listDocsByPath 懒加载下级文档 */
async function loadChildren(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const path = props.node.path || props.node.hpath
    const result = await api.listDocsByPath(props.notebook, path, 0)
    children.value = (result?.files || []).map(iFileToBlock)
  } catch (error) {
    console.error("加载下级文档失败:", error)
    children.value = []
  } finally {
    loading.value = false
  }
}

/** 展开/折叠节点，展开前先懒加载子文档 */
async function toggle(): Promise<void> {
  if (expanded.value) {
    expanded.value = false
    return
  }
  await loadChildren()
  expanded.value = true
}
</script>

<style scoped lang="scss">
@use "../styles/TreeNode.scss";
@use "../styles/index.scss";
</style>
