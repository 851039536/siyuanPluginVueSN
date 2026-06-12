<template>
  <div
    v-if="currentPath"
    class="breadcrumb-nav"
  >
    <button
      class="breadcrumb-item"
      :title="i18n.backToRoot || '返回根目录'"
      @click="$emit('navigate-root')"
    >
      <IconWrapper
        name="diskBrowser"
        :size="12"
      />
      {{ expandedDisk }}
    </button>
    <span
      v-for="(segment, index) in pathSegments"
      :key="index"
      class="breadcrumb-segment"
    >
      <span class="breadcrumb-sep">\</span>
      <button
        class="breadcrumb-item"
        :title="segment"
        @click="$emit('navigate-path', index)"
      >
        {{ segment }}
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { DiskBrowserI18n } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  currentPath: string
  expandedDisk: string
  pathSegments: string[]
  i18n: DiskBrowserI18n
}

defineProps<Props>()
defineEmits<{
  "navigate-root": []
  "navigate-path": [index: number]
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.breadcrumb-nav {
  @include flex-align-center;
  padding: 6px 14px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid $border;
  overflow-x: auto;
  white-space: nowrap;
  flex-shrink: 0;
  @include scrollbar(3px, 3px);
}

.breadcrumb-segment {
  @include flex-align-center;
}

.breadcrumb-sep {
  font-family: $mono;
  font-size: 10px;
  color: var(--b3-theme-on-surface-light);
  opacity: 0.3;
  margin: 0 2px;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: none;
  background: transparent;
  border-radius: 3px;
  font-family: $mono;
  font-size: 11px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.12s;

  &:hover {
    color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}
</style>
