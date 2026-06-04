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

      <div
        v-if="childDocs.length"
        class="doc-nav-children"
      >
        <IconWrapper
          name="docNavChildren"
          class="doc-nav-icon"
          size="18"
          aria-hidden="true"
        />
        <div
          class="doc-nav-children-list"
          role="list"
          :aria-label="`下级文档 (${childDocs.length})`"
        >
          <a
            v-for="doc in visibleChildren"
            :key="doc.id"
            class="doc-nav-link"
            :class="{ 'doc-nav-current': doc.id === currentDocId }"
            role="listitem"
            :data-doc-id="doc.id"
            :title="stripHtml(doc.content)"
            :aria-current="doc.id === currentDocId ? 'page' : undefined"
            @click="openDoc(doc.id)"
          >
            {{ stripHtml(doc.content) }}
          </a>

          <template v-if="hiddenChildren.length">
            <button
              class="doc-nav-expand"
              :aria-expanded="isExpanded"
              aria-controls="doc-nav-hidden-children"
              @click="toggleExpand"
            >
              {{ isExpanded ? '收起' : `+${hiddenChildren.length}` }}
            </button>
            <div
              id="doc-nav-hidden-children"
              :hidden="!isExpanded"
            >
              <a
                v-for="doc in hiddenChildren"
                :key="doc.id"
                class="doc-nav-link doc-nav-link-hidden"
                :class="{
                  'show': isExpanded,
                  'doc-nav-current': doc.id === currentDocId,
                }"
                role="listitem"
                :data-doc-id="doc.id"
                :title="stripHtml(doc.content)"
                :aria-current="doc.id === currentDocId ? 'page' : undefined"
                @click="openDoc(doc.id)"
              >
                {{ stripHtml(doc.content) }}
              </a>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { watch } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useDocNavigation } from "../composables/useDocNavigation"

const props = defineProps<{
  docId: string
  plugin: Plugin
}>()

const {
  parentDoc,
  childDocs,
  breadcrumbs,
  siblingDocs,
  currentDocId,
  hasNavigation,
  hasBreadcrumbs,
  hasSiblings,
  isExpanded,
  visibleChildren,
  hiddenChildren,
  loadHierarchy,
  toggleExpand,
  openDoc,
  stripHtml,
} = useDocNavigation(props.plugin)

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
