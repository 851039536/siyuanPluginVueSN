<template>
  <div class="service-warning" role="alert" aria-live="polite">
    <span class="warning-icon" aria-hidden="true">⚠️</span>
    <span class="warning-message">{{ message }}</span>
    <Button
      variant="secondary"
      size="small"
      @click="handleRetry"
      aria-label="重试连接服务"
    >
      {{ retryButtonText }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";

interface Props {
  /** 重试按钮文本 */
  retryButtonText?: string;
  /** 警告消息 */
  message?: string;
}

interface Emits {
  (e: "retry"): void;
}

const props = withDefaults(defineProps<Props>(), {
  retryButtonText: "重试",
  message:
    "Everything HTTP服务未启动。请确保Everything已安装并启用HTTP服务器（工具 → 选项 → HTTP服务器）。",
});

const emit = defineEmits<Emits>();

/** 处理重试 */
const handleRetry = () => {
  emit("retry");
};
</script>

<style scoped lang="scss">
@use "@/variables" as *;

.service-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #fef3cd;
  color: #856404;
  font-size: 13px;
  font-family: $font-body;
}

.warning-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.warning-message {
  flex: 1;
}
</style>
