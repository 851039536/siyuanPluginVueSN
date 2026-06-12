<template>
  <div class="disk-browser-header">
    <h3 class="header-title">
      <IconWrapper
        name="diskBrowser"
        :size="16"
      />
      {{ i18n.panelTitle || '本地磁盘浏览器' }}
    </h3>
    <div class="header-actions">
      <span
        v-if="cacheStatus.text"
        class="cache-tag"
        :class="{ expired: cacheStatus.isExpired }"
        :title="cacheStatus.tooltip"
      >
        {{ cacheStatus.text }}
      </span>
      <Button
        variant="ghost"
        size="small"
        icon="refresh"
        :icon-size="14"
        :loading="loading"
        :title="i18n.refreshing || '刷新'"
        @click="$emit('refresh')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CacheStatus,
  DiskBrowserI18n,
} from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  i18n: DiskBrowserI18n
  cacheStatus: CacheStatus
  loading: boolean
}

defineProps<Props>()
defineEmits<{
  refresh: []
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.disk-browser-header {
  @include flex-align-center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid $border;
  flex-shrink: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.header-actions {
  @include flex-align-center;
  gap: 6px;
}

.cache-tag {
  font-family: $mono;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--b3-theme-primary);
  padding: 2px 8px;
  background: var(--b3-theme-primary-lightest);
  border-radius: 3px;
  white-space: nowrap;

  &.expired {
    color: var(--b3-theme-error);
    background: rgba(var(--b3-theme-error-rgb, 220, 38, 38), 0.08);
    animation: pulse 2s ease-in-out infinite;
  }
}
</style>
