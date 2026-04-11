<template>
  <div v-if="hasNavigation || hasBreadcrumbs || hasSiblings" class="doc-navigation-container" :data-doc-id="docId">
    <div class="doc-navigation">
      <div v-if="hasBreadcrumbs" class="doc-nav-breadcrumb">
        <template v-for="(item, index) in breadcrumbs" :key="item.id">
          <a class="doc-nav-breadcrumb-link" :data-doc-id="item.id" :title="stripHtml(item.content)" @click="openDoc(item.id)">
            {{ stripHtml(item.content) }}
          </a>
          <span v-if="index < breadcrumbs.length - 1" class="doc-nav-breadcrumb-separator">/</span>
        </template>
      </div>

      <div v-if="hasSiblings" class="doc-nav-siblings">
        <a
          v-if="siblingDocs.prev"
          class="doc-nav-sibling doc-nav-sibling-prev"
          :data-doc-id="siblingDocs.prev.id"
          :title="'上一篇: ' + stripHtml(siblingDocs.prev.content)"
          @click="openDoc(siblingDocs.prev.id)"
        >
          <IconWrapper name="chevronLeft" size="14" />
          <span class="doc-nav-sibling-text">{{ stripHtml(siblingDocs.prev.content) }}</span>
        </a>
        <span v-else class="doc-nav-sibling doc-nav-sibling-disabled">
          <IconWrapper name="chevronLeft" size="14" />
        </span>

        <span class="doc-nav-sibling-count">{{ siblingDocs.currentIndex + 1 }}/{{ siblingDocs.siblings.length }}</span>

        <a
          v-if="siblingDocs.next"
          class="doc-nav-sibling doc-nav-sibling-next"
          :data-doc-id="siblingDocs.next.id"
          :title="'下一篇: ' + stripHtml(siblingDocs.next.content)"
          @click="openDoc(siblingDocs.next.id)"
        >
          <span class="doc-nav-sibling-text">{{ stripHtml(siblingDocs.next.content) }}</span>
          <IconWrapper name="chevronRight" size="14" />
        </a>
        <span v-else class="doc-nav-sibling doc-nav-sibling-disabled">
          <IconWrapper name="chevronRight" size="14" />
        </span>
      </div>

      <div v-if="parentDoc" class="doc-nav-parent">
        <IconWrapper name="docNavParent" class="doc-nav-icon" size="18" title="上级文档" />
        <a class="doc-nav-link" :data-doc-id="parentDoc.id" :title="stripHtml(parentDoc.content)" @click="openDoc(parentDoc.id)">
          {{ stripHtml(parentDoc.content) }}
        </a>
      </div>

      <div v-if="childDocs.length" class="doc-nav-children">
        <IconWrapper name="docNavChildren" class="doc-nav-icon" size="18" :title="`下级文档 (${childDocs.length})`" />
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
import { computed, watch } from "vue";
import IconWrapper from "@/components/IconWrapper.vue";
import { useDocNavigation } from "../composables/useDocNavigation";

const props = defineProps<{
	docId: string;
}>();

const {
	parentDoc,
	childDocs,
	breadcrumbs,
	siblingDocs,
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
} = useDocNavigation();

const expandTitle = computed(() => {
	return isExpanded.value
		? "收起"
		: `展开 ${hiddenChildren.value.length} 个文档`;
});

watch(
	() => props.docId,
	(newDocId) => {
		if (newDocId) {
			loadHierarchy(newDocId);
		}
	},
	{ immediate: true },
);
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;
</style>
