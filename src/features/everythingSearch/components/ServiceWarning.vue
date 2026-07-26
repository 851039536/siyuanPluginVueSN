<template>
  <div
    class="vp-warning"
    role="alert"
    aria-live="polite"
  >
    <!-- 警告标签："服务未连接" -->
    <span class="vp-warning__tag"><IconWrapper
      name="warning"
      :size="12"
    /> {{ i18n.serviceNotConnected }}</span>
    <!-- 警告消息："Everything HTTP 服务未启动…" -->
    <span class="vp-warning__msg">{{ i18n.serviceNotRunning }}</span>
    <!-- 重试按钮："重试"（aria："重试连接服务"） -->
    <button
      class="vp-warning__retry"
      :aria-label="i18n.retryConnect"
      @click="handleRetry"
    >
      {{ i18n.retry }}
    </button>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "retry"): void
}

defineProps<Props>()

const emit = defineEmits<Emits>()

const handleRetry = () => {
  emit("retry")
}
</script>

<style scoped lang="scss">
@use "../styles/ServiceWarning.scss";
</style>
