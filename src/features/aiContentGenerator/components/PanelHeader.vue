<template>
  <div class="panel-header">
    <span class="panel-title">AI 内容生成</span>
    <div class="header-actions">
      <Button
        variant="ghost"
        size="small"
        title="对话设置"
        @click="$emit('toggle-settings')"
      >
        <svg
          width="18"
          height="16"
        >
          <use xlink:href="#iconSettings"></use>
        </svg>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"

defineEmits<{
  (e: "toggle-settings"): void
}>()
</script>

<style scoped lang="scss">
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  padding: 0 6px;
}

.header-actions {
  display: flex;
  gap: 6px;
}
</style>
