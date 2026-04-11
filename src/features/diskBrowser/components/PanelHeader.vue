<template>
  <div class="disk-browser-header">
    <h3>{{ i18n.panelTitle || '本地磁盘浏览器' }}</h3>
    <div class="header-actions">
      <Tag
        v-if="cacheStatus.text"
        :variant="cacheStatus.isExpired ? 'danger' : 'primary'"
        size="small"
        class="cache-tag"
        :class="{ expired: cacheStatus.isExpired }"
        :title="cacheStatus.tooltip"
      >
        {{ cacheStatus.text }}
      </Tag>
      <Button
        variant="ghost"
        size="small"
        icon="refresh"
        :icon-size="16"
        :loading="loading"
        :title="i18n.refreshing || '刷新'"
        @click="$emit('refresh')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import Tag from "@/components/Tag.vue";
import type { CacheStatus, DiskBrowserI18n } from "../types";

interface Props {
	i18n: DiskBrowserI18n;
	cacheStatus: CacheStatus;
	loading: boolean;
}

defineProps<Props>();
defineEmits<{
	refresh: [];
}>();
</script>

<style scoped lang="scss">
@use "../styles/index.scss" as *;

.disk-browser-header {
  @include flex-align-center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }
}

.header-actions {
  @include flex-align-center;
  gap: 8px;
}

.cache-tag {
  &.expired {
    animation: pulse 2s ease-in-out infinite;
  }
}
</style>
