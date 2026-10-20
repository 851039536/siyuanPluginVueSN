<!-- 服务未连接警告：共享 Message 承载提示文案 + 右侧重试按钮（统一走共享 Button） -->
<template>
  <div class="vp-warning">
    <!-- 警告消息：文案两条（"服务未连接" / "Everything HTTP 服务未启动…"），语义与 role=alert 由 Message 自带 -->
    <Message
      class="vp-warning__message"
      severity="warn"
      icon="warning"
      size="xsmall"
    >
      <span class="vp-warning__tag">{{ i18n.serviceNotConnected }}</span>
      <span class="vp-warning__msg">{{ i18n.serviceNotRunning }}</span>
    </Message>
    <!-- 重试按钮："重试"（aria："重试连接服务"） -->
    <Button
      class="vp-warning__retry"
      variant="danger"
      outlined
      size="xsmall"
      icon="refresh"
      :title="i18n.retryConnect"
      :aria-label="i18n.retryConnect"
      @click="handleRetry"
    >
      {{ i18n.retry }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"
import Message from "@/components/Message.vue"

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
