<template>
  <div class="vp-header">
    <div class="vp-title">
      <span class="vp-title__icon" aria-hidden="true">⌘</span>
      <span class="vp-title__text">{{ title }}</span>
    </div>
    <button
      class="vp-header__close"
      aria-label="关闭对话框"
      @click="handleClose"
    >
      <span aria-hidden="true">✕</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** 标题文本 */
  title?: string
}

interface Emits {
  (e: "close"): void
}

withDefaults(defineProps<Props>(), {
  title: "Everything 本地搜索",
})

const emit = defineEmits<Emits>()

/** 处理关闭 */
const handleClose = () => {
  emit("close")
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;

.vp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.vp-title {
  display: flex;
  align-items: center;
  gap: 8px;

  &__icon {
    font-size: 14px;
    color: $brand-orange;
  }

  &__text {
    font-size: 14px;
    font-weight: 600;
    font-family: $font-heading;
    color: $brand-orange;
  }
}

.vp-header__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  font-size: 12px;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}
</style>
