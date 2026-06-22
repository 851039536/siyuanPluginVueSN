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
@use "@/variables" as *;

$vp-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;

.vp-warning {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: var(--b3-theme-surface-light);
  border-bottom: 1px dashed var(--b3-theme-primary);
  font-family: $font-body;

  &__tag {
    font-size: 11px;
    font-weight: 600;
    color: $brand-orange;
    padding: 2px 6px;
    border: 1px solid rgba($brand-orange, 0.3);
    border-radius: 3px;
    flex-shrink: 0;
  }

  &__msg {
    flex: 1;
    font-size: 12px;
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }

  &__retry {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    font-size: 12px;
    color: $brand-orange;
    background: transparent;
    border: 1px solid rgba($brand-orange, 0.35);
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;

    &:hover {
      background: rgba($brand-orange, 0.08);
      border-color: $brand-orange;
    }
  }
}
</style>
