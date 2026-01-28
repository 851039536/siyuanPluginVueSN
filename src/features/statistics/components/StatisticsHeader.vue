<template>
  <div class="statistics-header">
    <div class="header-left">
      <button
        class="refresh-btn"
        :title="i18n.refresh"
        @click="handleRefresh"
        :disabled="loading"
      >
        <Icon :icon="loading ? 'mdi:loading' : 'mdi:refresh'" :class="{ 'spin-icon': loading }" />
      </button>
    </div>
    <div class="header-right">
      <div class="auto-update-info">
        <span class="update-icon">⏱️</span>
        <span class="update-text">{{ updateIntervalText }}</span>
      </div>
      <div class="last-update">{{ i18n.lastUpdate }}: {{ lastUpdateTime }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

interface Props {
  loading?: boolean
  lastUpdateTime?: string
  updateInterval?: number
  i18n?: {
    refresh: string
    lastUpdate: string
  }
}

interface Emits {
  (e: 'refresh'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  lastUpdateTime: '',
  updateInterval: 60,
  i18n: () => ({
    refresh: '刷新',
    lastUpdate: '最后更新',
  }),
})

const emit = defineEmits<Emits>()

const updateIntervalText = computed(() => {
  const seconds = props.updateInterval
  if (seconds < 60) {
    return `${seconds}秒`
  } else {
    const minutes = seconds / 60
    return `${minutes}分钟`
  }
})

function handleRefresh() {
  emit('refresh')
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;

$stats-header-height: 48px;
$stats-transition: all 0.2s ease;

.statistics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  flex-shrink: 0;
  min-height: $stats-header-height;

  .header-left {
    display: flex;
    gap: $spacing-sm;
    align-items: center;
  }

  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .auto-update-info {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--b3-theme-on-surface);

    .update-icon {
      font-size: 12px;
    }

    .update-text {
      font-weight: 500;
    }
  }

  .last-update {
    font-size: 10px;
    color: var(--b3-theme-on-surface);
    font-family: $font-body;
  }
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition: $stats-transition;
  color: var(--b3-theme-primary);

  svg {
    width: 16px;
    height: 16px;
  }

  .spin-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  &:hover:not(:disabled) {
    background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1);
    border-color: var(--b3-theme-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Responsive design
@include tablet-only {
  .statistics-header {
    flex-direction: column;
    align-items: stretch;
    gap: $spacing-sm;

    .header-left,
    .header-right {
      width: 100%;
    }

    .header-right {
      align-items: flex-start;
    }
  }
}
</style>
