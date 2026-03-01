<template>
  <div v-if="hasNavigation" class="doc-navigation-container" :data-doc-id="docId">
    <div class="doc-navigation">
      <div v-if="parentDoc" class="doc-nav-parent">
        <svg class="doc-nav-icon" title="上级文档"><use xlink:href="#iconUp"></use></svg>
        <a class="doc-nav-link" :data-doc-id="parentDoc.id" :title="stripHtml(parentDoc.content)" @click="openDoc(parentDoc.id)">
          {{ stripHtml(parentDoc.content) }}
        </a>
      </div>

      <div v-if="childDocs.length" class="doc-nav-children">
        <svg class="doc-nav-icon" :title="`下级文档 (${childDocs.length})`"><use xlink:href="#iconDown"></use></svg>
        <div class="doc-nav-children-list" :data-expanded="isExpanded">
          <a
            v-for="doc in visibleChildren"
            :key="doc.id"
            class="doc-nav-link"
            :data-doc-id="doc.id"
            :title="stripHtml(doc.content)"
            @click="openDoc(doc.id)"
          >
            {{ stripHtml(doc.content) }}
          </a>

          <template v-if="hiddenChildren.length">
            <button class="doc-nav-expand" :title="expandTitle" @click="toggleExpand">
              <svg class="expand-icon"><use :xlink:href="isExpanded ? '#iconContract' : '#iconExpand'"></use></svg>
              {{ isExpanded ? '收起' : `+${hiddenChildren.length}` }}
            </button>
            <a
              v-for="doc in hiddenChildren"
              :key="doc.id"
              class="doc-nav-link doc-nav-link-hidden"
              :class="{ show: isExpanded }"
              :data-doc-id="doc.id"
              :title="stripHtml(doc.content)"
              @click="openDoc(doc.id)"
            >
              {{ stripHtml(doc.content) }}
            </a>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useDocNavigation } from '../composables/useDocNavigation'

const props = defineProps<{
  docId: string
}>()

const {
  parentDoc,
  childDocs,
  hasNavigation,
  isExpanded,
  visibleChildren,
  hiddenChildren,
  loadHierarchy,
  toggleExpand,
  openDoc,
  stripHtml,
} = useDocNavigation()

const expandTitle = computed(() => {
  return isExpanded.value ? '收起' : `展开 ${hiddenChildren.value.length} 个文档`
})

watch(() => props.docId, (newDocId) => {
  if (newDocId) {
    loadHierarchy(newDocId)
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;
</style>
