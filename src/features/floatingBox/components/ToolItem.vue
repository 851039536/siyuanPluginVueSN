<template>
  <div
    class="tool-item"
    :title="tool.title"
    @click="handleClick"
  >
    <div class="tool-icon" :style="{ background: tool.bgColor }">
      <svg viewBox="0 0 24 24" width="18" height="18" v-html="tool.icon" />
    </div>
    <span class="tool-label">{{ tool.label }}</span>
  </div>
</template>

<script setup lang="ts">
import type { FloatingTool } from "../types";

const props = defineProps<{
	tool: FloatingTool;
	plugin?: any;
}>();

const handleClick = () => {
	props.tool.action(props.plugin);
};
</script>

<style scoped lang="scss">
@use '../styles/index.scss';
</style>
