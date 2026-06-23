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
@use "../styles/DialogHeader.scss";
</style>
