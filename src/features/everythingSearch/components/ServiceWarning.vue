<template>
  <div class="service-warning" role="alert" aria-live="polite">
    <span class="warning-icon" aria-hidden="true">⚠️</span>
    <span class="warning-message">{{ message }}</span>
    <button class="retry-btn" @click="handleRetry" aria-label="重试连接服务">
      {{ retryButtonText }}
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** 重试按钮文本 */
  retryButtonText?: string
  /** 警告消息 */
  message?: string
}

interface Emits {
  (e: 'retry'): void
}

const props = withDefaults(defineProps<Props>(), {
  retryButtonText: '重试',
  message: 'Everything HTTP服务未启动。请确保Everything已安装并启用HTTP服务器（工具 → 选项 → HTTP服务器）。'
})

const emit = defineEmits<Emits>()

/** 处理重试 */
const handleRetry = () => {
  emit('retry')
}
</script>

<style scoped>
.service-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #fef3cd;
  color: #856404;
  font-size: 13px;
}

.warning-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.warning-message {
  flex: 1;
}

.retry-btn {
  padding: 4px 12px;
  background: #856404;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}

.retry-btn:hover {
  background: #6d5303;
}
</style>
