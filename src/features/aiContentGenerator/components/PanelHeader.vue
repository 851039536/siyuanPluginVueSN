<template>
  <div class="panel-header">
    <span class="panel-title">AI 内容生成</span>
    <div class="header-actions">
      <Button
        variant="ghost"
        size="xsmall"
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

<style lang="scss" scoped>
@use "../styles/PanelHeader.scss";
</style>
