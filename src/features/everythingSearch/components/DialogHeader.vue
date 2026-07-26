<template>
  <div class="vp-header">
    <div class="vp-title">
      <span
        class="vp-title__icon"
        aria-hidden="true"
      >⌘</span>
      <!-- 弹窗标题："Everything搜索" -->
      <span class="vp-title__text">{{ i18n.title }}</span>
    </div>
    <!-- 关闭按钮（aria："关闭对话框"） -->
    <button
      class="vp-header__close"
      :aria-label="i18n.closeDialog"
      @click="handleClose"
    >
      <span aria-hidden="true">✕</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** everythingSearch 命名空间的 i18n 文案 */
  i18n: Record<string, string>
}

interface Emits {
  (e: "close"): void
}

defineProps<Props>()

const emit = defineEmits<Emits>()

/** 处理关闭 */
const handleClose = () => {
  emit("close")
}
</script>

<style scoped lang="scss">
@use "../styles/DialogHeader.scss";
</style>
