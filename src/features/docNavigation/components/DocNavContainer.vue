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

      <div
        v-if="hasSiblings"
        class="doc-nav-siblings"
        role="group"
        aria-label="同级文档"
      >
        <a
          v-if="siblingDocs.prev"
          class="doc-nav-sibling doc-nav-sibling-prev"
          :data-doc-id="siblingDocs.prev.id"
          :title="`上一篇: ${stripHtml(siblingDocs.prev.content)}`"
          :aria-label="`上一篇: ${stripHtml(siblingDocs.prev.content)}`"
          @click="openDoc(siblingDocs.prev.id)"
        >
          <IconWrapper
            name="chevronLeft"
            size="14"
          />
          <span class="doc-nav-sibling-text">{{ stripHtml(siblingDocs.prev.content) }}</span>
        </a>
        <span
          v-else
          class="doc-nav-sibling doc-nav-sibling-disabled"
          aria-hidden="true"
        >
          <IconWrapper
            name="chevronLeft"
            size="14"
          />
        </span>

        <span
          class="doc-nav-sibling-count"
          aria-live="polite"
        >{{ siblingDocs.currentIndex + 1 }}/{{ siblingDocs.siblings.length }}</span>

        <a
          v-if="siblingDocs.next"
          class="doc-nav-sibling doc-nav-sibling-next"
          :data-doc-id="siblingDocs.next.id"
          :title="`下一篇: ${stripHtml(siblingDocs.next.content)}`"
          :aria-label="`下一篇: ${stripHtml(siblingDocs.next.content)}`"
          @click="openDoc(siblingDocs.next.id)"
        >
          <span class="doc-nav-sibling-text">{{ stripHtml(siblingDocs.next.content) }}</span>
          <IconWrapper
            name="chevronRight"
            size="14"
          />
        </a>
        <span
          v-else
          class="doc-nav-sibling doc-nav-sibling-disabled"
          aria-hidden="true"
        >
          <IconWrapper
            name="chevronRight"
            size="14"
          />
        </span>
      </div>

      <div
        v-if="parentDoc"
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

      <!-- 子文档下拉树形面板 -->
      <ChildDocDropdown
        v-if="childCount > 0"
        :child-docs="childDocs"
        :notebook="notebook"
        :current-doc-id="currentDocId"
        :child-count="childCount"
        :i18n="i18n"
        :open-doc="openDoc"
        :strip-html="stripHtml"
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
