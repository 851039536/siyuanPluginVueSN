<template>
  <div
    class="vp-warning"
    role="alert"
    aria-live="polite"
  >
    <span class="vp-warning__tag"><IconWrapper name="warning" :size="12" /> 服务未连接</span>
    <span class="vp-warning__msg">{{ message }}</span>
    <button
      class="vp-warning__retry"
      aria-label="重试连接服务"
      @click="handleRetry"
    >
      重试
    </button>
  </div>
</template>

<script setup lang="ts">
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  /** 警告消息 */
  message?: string
}

interface Emits {
  (e: "retry"): void
}

withDefaults(defineProps<Props>(), {
  message:
    "Everything HTTP 服务未启动。请确保 Everything 已安装并启用 HTTP 服务器（工具 → 选项 → HTTP 服务器）。",
})

const emit = defineEmits<Emits>()

const handleRetry = () => {
  emit("retry")
}
</script>

<style scoped lang="scss">
@use "../styles/ServiceWarning.scss";
</style>
