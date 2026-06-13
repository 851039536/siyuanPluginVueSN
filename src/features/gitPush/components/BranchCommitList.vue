<template>
  <div class="bcl-panel">
    <div class="bcl-header" :class="{ expanded }" @click="toggleExpanded">
      <Icon :icon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-right'" height="14" />
      <span class="bcl-title">COMMIT LOG</span>
      <span v-if="!loading && entries.length" class="bcl-count">{{ entries.length }}</span>
    </div>

    <div v-if="expanded" class="bcl-body">
      <div v-if="loading" class="bcl-loading">
        <Icon icon="mdi:loading" class="gp-spin" height="14" />
        <span>加载中...</span>
      </div>

      <div v-else-if="entries.length === 0" class="bcl-empty">
        暂无提交记录
      </div>

      <div v-else class="bcl-list">
        <div v-for="entry in entries" :key="entry.hash" class="bcl-entry">
          <span class="bcl-hash" :title="entry.hash">{{ entry.hash }}</span>
          <span class="bcl-msg" :title="entry.message">{{ entry.message }}</span>
          <span class="bcl-meta">
            <span class="bcl-author">{{ entry.author }}</span>
            <span class="bcl-date" :title="entry.date">{{ entry.relativeDate }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { Icon } from "@iconify/vue"
import type { CommitLogEntry } from "../types"

defineProps<{
  entries: CommitLogEntry[]
  loading: boolean
}>()

const expanded = ref(false)

function toggleExpanded() {
  expanded.value = !expanded.value
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../styles/variables" as *;

.bcl-panel {
  border-top: 1px dashed var(--b3-border-color);
  margin-top: 6px;
  padding-top: 4px;
}

.bcl-header {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 0;
  font-size: 11px;
  opacity: 0.6;
  transition: opacity 0.15s;
  user-select: none;

  &:hover {
    opacity: 1;
  }

  &.expanded {
    opacity: 0.9;
  }
}

.bcl-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.45;
}

.bcl-count {
  font-size: 10px;
  font-weight: 600;
  font-family: $vp-mono;
  opacity: 0.35;
}

.bcl-body {
  margin-top: 4px;
}

.bcl-loading,
.bcl-empty {
  font-size: 11px;
  opacity: 0.5;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}

.bcl-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 160px;
  overflow-y: auto;
}

.bcl-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  font-size: 10px;
  border-radius: 3px;
  transition: background 0.1s;

  &:hover {
    background: var(--b3-list-hover);
  }
}

.bcl-hash {
  font-family: $vp-mono;
  font-weight: 600;
  color: var(--b3-theme-primary);
  opacity: 0.7;
  flex-shrink: 0;
}

.bcl-msg {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: $vp-mono;
  font-size: 10px;
}

.bcl-meta {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0.4;
  font-size: 9px;
}

.bcl-author {
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bcl-date {
  white-space: nowrap;
}
</style>
