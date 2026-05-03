<template>
  <div class="dialog-header">
    <div class="header-title">
      <span class="title-icon" aria-hidden="true">🔍</span>
      <span>{{ title }}</span>
    </div>
    <Button
      variant="ghost"
      size="small"
      icon="x"
      :icon-size="12"
      aria-label="关闭对话框"
      @click="handleClose"
    />
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";

interface Props {
  /** 标题文本 */
  title?: string;
}

interface Emits {
  (e: "close"): void;
}

const props = withDefaults(defineProps<Props>(), {
  title: "Everything 本地搜索",
});

const emit = defineEmits<Emits>();

/** 处理关闭 */
const handleClose = () => {
  emit("close");
};
</script>

<style scoped lang="scss">
@use "@/variables" as *;

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  font-family: $font-heading;
  color: $brand-orange;
}

.title-icon {
  font-size: 16px;
}
</style>
