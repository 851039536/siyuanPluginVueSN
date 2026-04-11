<template>
  <div class="connection-status" :class="status">
    <div class="status-icon">
      <svg v-if="status === 'connected'" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else-if="status === 'error'" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="16" r="1" fill="currentColor"/>
      </svg>
    </div>
    <div class="status-text">{{ text }}</div>
  </div>
</template>

<script setup lang="ts">
interface Props {
	status: "unknown" | "connected" | "error";
	text: string;
}

defineProps<Props>();
</script>

<style scoped lang="scss">
.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;

  &.connected {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;

    .status-icon {
      color: #10b981;
    }
  }

  &.error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;

    .status-icon {
      color: #ef4444;
    }
  }

  &.unknown {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;

    .status-icon {
      color: #f59e0b;
    }
  }

  .status-icon {
    flex-shrink: 0;
  }

  .status-text {
    font-weight: 500;
  }
}
</style>
