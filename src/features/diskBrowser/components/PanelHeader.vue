<!-- 面板头部组件 — 标题、缓存状态标签、刷新按钮 -->
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
        size="xsmall"
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
@use "../styles/PanelHeader.scss";
@use "../styles/index.scss";
</style>
