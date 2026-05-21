<template>
  <div
    class="tool-item"
    :class="{ 'has-children': tool.children?.length }"
    :title="tool.title"
    @click="handleClick"
  >
    <div
      class="tool-icon"
      :style="{ background: tool.bgColor }"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        v-html="tool.icon"
      />
    </div>
    <span class="tool-label">{{ tool.label }}</span>
    <svg
      v-if="tool.children?.length"
      class="tool-arrow"
      viewBox="0 0 24 24"
      width="10"
      height="10"
    >
      <path
        fill="currentColor"
        d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
      />
    </svg>

    <!-- 子菜单 -->
    <div
      v-if="tool.children?.length"
      class="tool-submenu"
    >
      <div
        v-for="child in tool.children"
        :key="child.id"
        class="submenu-item"
        :title="child.title"
        @click.stop="handleChildClick(child)"
      >
        <span class="submenu-label">{{ child.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FloatingTool, FloatingToolChild } from "../types"

const props = defineProps<{
  tool: FloatingTool
  plugin?: any
}>()

const handleClick = () => {
  props.tool.action(props.plugin)
}

const handleChildClick = (child: FloatingToolChild) => {
  child.action(props.plugin)
}
</script>

<style scoped lang="scss">
@use '../styles/index.scss';
</style>
