<template>
  <div class="dialog-header">
    <div class="header-title">
      <span class="title-icon" aria-hidden="true">🔍</span>
      <span>{{ title }}</span>
    </div>
    <button class="close-btn" @click="handleClose" aria-label="关闭对话框">
      <svg class="close-icon"><use xlink:href="#iconClose"></use></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** 标题文本 */
  title?: string
}

interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Everything 本地搜索'
})

const emit = defineEmits<Emits>()

/** 处理关闭 */
const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.title-icon {
  font-size: 20px;
}

.close-btn {
  padding: 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--b3-theme-error);
  color: #fff;
}

.close-icon {
  width: 14px;
  height: 14px;
}
</style>
