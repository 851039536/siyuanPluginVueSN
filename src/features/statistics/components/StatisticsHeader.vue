<template>
  <div class="statistics-header">
    <div class="header-left">
      <Button
        :icon="refreshIcon"
        variant="ghost"
        size="small"
        :loading="loading"
        :title="i18n.refresh"
        @click="handleRefresh"
      />
      <button
        class="storage-toggle-btn"
        :title="showStorage ? '隐藏存储路径' : '查看存储路径'"
        @click="showStorage = !showStorage"
      >
        <svg><use xlink:href="#iconFolder"></use></svg>
      </button>
    </div>
    <div class="header-right">
      <div class="auto-update-info">
        <span class="update-icon">⏱️</span>
        <span class="update-text">{{ updateIntervalText }}</span>
      </div>
      <div class="last-update">
        {{ i18n.lastUpdate }}: {{ lastUpdateTime }}
      </div>
    </div>
  </div>
  <div
    v-if="showStorage && storagePaths && storagePaths.length > 0"
    class="storage-paths"
  >
    <div
      v-for="item in storagePaths"
      :key="item.key"
      class="storage-path-item"
    >
      <span class="storage-key">{{ item.key }}</span>
      <span class="storage-desc">{{ item.desc }}</span>
      <span class="storage-path" :title="item.path">{{ item.path }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import { computed, ref } from "vue"
import Button from "@/components/Button.vue"

interface StoragePathItem {
  key: string
  desc: string
  path: string
}

interface Props {
  loading?: boolean
  lastUpdateTime?: string
  updateInterval?: number
  storagePaths?: StoragePathItem[]
  i18n?: {
    refresh: string
    lastUpdate: string
  }
}

interface Emits {
  (e: "refresh"): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  lastUpdateTime: "",
  updateInterval: 60,
  storagePaths: () => [],
  i18n: () => ({
    refresh: "刷新",
    lastUpdate: "最后更新",
  }),
})

const emit = defineEmits<Emits>()

const showStorage = ref(false)

const updateIntervalText = computed(() => {
  const seconds = props.updateInterval
  if (seconds < 60) {
    return `${seconds}秒`
  } else {
    const minutes = seconds / 60
    return `${minutes}分钟`
  }
})

const refreshIcon = computed<IconKey>(() => {
  return props.loading ? "loading" : "refresh"
})

function handleRefresh() {
  emit("refresh")
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/shared" as *;
@use "../styles/index.scss" as stats;

$stats-header-height: 56px;

.statistics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
  height: $stats-header-height;
  position: sticky;
  top: 0;
  z-index: 10;
  @include stats.stats-glass-effect;

  .header-left {
    display: flex;
    gap: $spacing-sm;
    align-items: center;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .auto-update-info {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--b3-theme-on-surface);
    background: var(--b3-theme-background);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--b3-border-color);

    .update-icon {
      font-size: 12px;
    }

    .update-text {
      font-weight: 600;
      opacity: 0.8;
    }
  }

  .last-update {
    font-size: 11px;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
    font-family: $font-body;
    font-weight: 500;
  }
}

// Responsive design
@include mobile-only {
  .statistics-header {
    height: auto;
    padding: 12px 16px;
    flex-wrap: wrap;
    gap: 12px;

    .header-right {
      width: 100%;
      justify-content: space-between;
      gap: 8px;
    }
  }
}

.storage-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s, background 0.2s;

  &:hover {
    opacity: 1;
    background: var(--b3-theme-hover);
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.storage-paths {
  padding: 6px 12px;
  background: var(--b3-theme-background);
  border-bottom: 1px solid var(--b3-border-color);
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-family: $font-body;
  user-select: all;
}

.storage-path-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.storage-key {
  font-weight: 600;
  color: var(--b3-theme-primary);
  white-space: nowrap;
  min-width: 130px;
}

.storage-desc {
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  white-space: nowrap;
  min-width: 60px;
}

.storage-path {
  flex: 1;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
}
</style>

