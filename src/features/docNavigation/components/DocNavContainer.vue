<template>
  <div
    v-if="hasNavigation || hasBreadcrumbs || hasSiblings"
    class="doc-navigation-container"
    role="navigation"
    aria-label="文档导航"
    :data-doc-id="docId"
  >
    <div class="doc-navigation">
      <div
        v-if="hasBreadcrumbs"
        class="doc-nav-breadcrumb"
        role="list"
        aria-label="面包屑导航"
      >
        <template
          v-for="(item, index) in breadcrumbs"
          :key="item.id"
        >
          <a
            class="doc-nav-breadcrumb-link"
            :class="{ 'doc-nav-current': item.id === currentDocId }"
            role="listitem"
            :data-doc-id="item.id"
            :title="stripHtml(item.content)"
            :aria-current="item.id === currentDocId ? 'page' : undefined"
            @click="openDoc(item.id)"
          >
            {{ stripHtml(item.content) }}
          </a>
          <span
            v-if="index < breadcrumbs.length - 1"
            class="doc-nav-breadcrumb-separator"
            aria-hidden="true"
          >/</span>
        </template>
      </div>

      <!-- 同级文档下拉面板 -->
      <SiblingDropdown
        v-if="hasSiblings"
        :siblings="siblingDocs.siblings"
        :sibling-count="siblingDocs.siblings.length"
        :current-doc-id="currentDocId"
        :i18n="i18n"
        :open-doc="openDoc"
        :strip-html="stripHtml"
      />

      <!-- 上级文档链接：面包屑可见时已包含上级，避免重复显示 -->
      <div
        v-if="parentDoc && !hasBreadcrumbs"
        class="doc-nav-parent"
      >
        <IconWrapper
          name="docNavParent"
          class="doc-nav-icon"
          size="18"
          aria-hidden="true"
        />
        <a
          class="doc-nav-link"
          :data-doc-id="parentDoc.id"
          :title="stripHtml(parentDoc.content)"
          :aria-label="`上级文档: ${stripHtml(parentDoc.content)}`"
          @click="openDoc(parentDoc.id)"
        >
          {{ stripHtml(parentDoc.content) }}
        </a>
      </div>

      <!-- 下级文档下拉树形面板 -->
      <ChildDocDropdown
        v-if="childCount > 0"
        :child-docs="childDocs"
        :notebook="notebook"
        :current-doc-id="currentDocId"
        :child-count="childCount"
        :i18n="i18n"
        :open-doc="openDoc"
        :strip-html="stripHtml"
        :trigger-text="i18n.docNavShowChildren"
        :panel-title="i18n.docNavPanelTitle"
      />

      <!-- 参考下拉树形面板：仅显示标题含「参考」的子文档，无匹配项时不显示 -->
      <ChildDocDropdown
        v-if="filteredChildCount > 0"
        :child-docs="filteredChildDocs"
        :notebook="notebook"
        :current-doc-id="currentDocId"
        :child-count="filteredChildCount"
        :i18n="i18n"
        :open-doc="openDoc"
        :strip-html="stripHtml"
        :trigger-text="i18n.docNavReference"
        :panel-title="i18n.docNavReferencePanelTitle"
        trigger-icon="docNavReference"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { watch } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useDocNavigation } from "../composables/useDocNavigation"
import ChildDocDropdown from "./ChildDocDropdown.vue"
import SiblingDropdown from "./SiblingDropdown.vue"

const props = defineProps<{
  docId: string
  plugin: Plugin
}>()

/** 功能 i18n 文案（合并后平铺在 plugin.i18n 顶层，与 tableOfContents 等同级模块一致） */
const i18n = props.plugin.i18n as Record<string, string>

const {
  parentDoc,
  childDocs,
  breadcrumbs,
  siblingDocs,
  currentDocId,
  notebook,
  hasNavigation,
  hasBreadcrumbs,
  hasSiblings,
  childCount,
  filteredChildDocs,
  filteredChildCount,
  loadHierarchy,
  openDoc,
  stripHtml,
} = useDocNavigation()

watch(
  () => props.docId,
  (newDocId) => {
    if (newDocId) {
      loadHierarchy(newDocId)
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;
</style>
