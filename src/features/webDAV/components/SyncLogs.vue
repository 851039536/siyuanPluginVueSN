<template>
  <div class="sync-logs" v-if="logs.length > 0">
    <div class="logs-header">
      <span>{{ i18n.syncLogs || '同步日志' }}</span>
      <button
        class="btn-clear"
        @click="onClear"
      >
        {{ i18n.clearLogs || '清空' }}
      </button>
    </div>
    <div class="logs-list">
      <div
        v-for="(log, index) in logs"
        :key="index"
        :class="['log-item', log.type]"
      >
        <span class="log-time">{{ formatTime(log.time) }}</span>
        <span class="log-message">{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SyncLog } from '../types'
import { formatTime } from '../utils'

interface Props {
  logs: SyncLog[]
  i18n: Record<string, any>
}

const props = defineProps<Props>()

interface Emits {
  (e: 'clear'): void
}

const emit = defineEmits<Emits>()

const onClear = () => {
  emit('clear')
}
</script>

<style scoped lang="scss">
@use "sass:color";
@use "@/index.scss" as *;

.sync-logs {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;

  .logs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: var(--background-secondary, #f9fafb);
    border-bottom: 1px solid var(--border-color, #e5e7eb);

    span {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary, #6b7280);
    }

    .btn-clear {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      font-family: $font-body;
      color: var(--text-secondary, #6b7280);
      transition: all 0.2s ease;

      &:hover {
        background: var(--background-hover, #f3f4f6);
        color: #ef4444;
        border-color: #ef4444;
      }
    }
  }

  .logs-list {
    max-height: 200px;
    overflow-y: auto;
    padding: 8px 0;
  }

  .log-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 16px;
    font-size: 12px;

    &:hover {
      background: var(--background-hover, #f3f4f6);
    }

    .log-time {
      color: var(--text-muted, #9ca3af);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .log-message {
      color: var(--text-color, #374151);
      word-break: break-all;
    }

    &.success .log-message {
      color: #10b981;
    }

    &.error .log-message {
      color: #ef4444;
    }

    &.info .log-message {
      color: #3b82f6;
    }
  }
}

:global(.dark) {
  .sync-logs {
    border-color: var(--border-color, #374151);

    .logs-header {
      background: var(--background-secondary, #111827);
      border-color: var(--border-color, #374151);

      span {
        color: var(--text-secondary, #9ca3af);
      }
    }

    .logs-list {
      .log-item {
        &:hover {
          background: var(--background-hover, #374151);
        }

        .log-time {
          color: var(--text-muted, #6b7280);
        }

        .log-message {
          color: var(--text-color, #f9fafb);
        }
      }
    }
  }
}
</style>
