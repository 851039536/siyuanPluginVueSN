<template>
  <div
    class="doc-list-item"
    @click="$emit('open', doc.id)"
  >
    <div class="doc-info">
      <div class="doc-title">
        <Icon icon="mdi:file-document-outline" class="doc-icon" />
        <span class="title-text">{{ doc.title }}</span>
      </div>
      <div class="doc-meta">
        <span class="meta-notebook">
          <Icon icon="mdi:book-outline" class="meta-icon" />
          {{ doc.notebookName }}
        </span>
        <span class="meta-path" v-if="doc.hpath">{{ doc.hpath }}</span>
      </div>
    </div>
    <div class="doc-size">
      <span class="wordcount-value" v-if="doc.wordCount > 0">{{ formatWords }}</span>
      <span class="size-value">{{ formatSize }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue";
import type { DocInfo } from "../types/index";
import { formatBytes, formatWordCount } from "../types/storage";

interface Props {
  doc: DocInfo;
}

const props = defineProps<Props>();

defineEmits<{
  (e: "open", docId: string): void;
}>();

const formatSize = computed(() => formatBytes(props.doc.contentSize));
const formatWords = computed(() => formatWordCount(props.doc.wordCount));
</script>

<style lang="scss" scoped>
.doc-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-bottom: 1px solid var(--b3-border-color);

  &:hover {
    background-color: var(--b3-list-hover);
  }

  .doc-info {
    flex: 1;
    min-width: 0;
  }

  .doc-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--b3-theme-on-background);
    font-weight: 500;

    .doc-icon {
      font-size: 16px;
      color: var(--b3-theme-primary);
      flex-shrink: 0;
    }

    .title-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .doc-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant);

    .meta-notebook {
      display: flex;
      align-items: center;
      gap: 3px;
      flex-shrink: 0;
    }

    .meta-icon {
      font-size: 12px;
    }

    .meta-path {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
  }

  .doc-size {
    flex-shrink: 0;
    margin-left: 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;

    .wordcount-value {
      font-size: 12px;
      color: var(--b3-theme-on-surface-variant);
      background: var(--b3-theme-surface-light);
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
    }

    .size-value {
      font-size: 11px;
      color: var(--b3-theme-on-surface-variant);
      opacity: 0.7;
      white-space: nowrap;
    }
  }
}
</style>
