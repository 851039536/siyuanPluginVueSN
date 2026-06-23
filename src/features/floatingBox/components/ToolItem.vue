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
      <Icon
        :icon="tool.icon"
        width="18"
        height="18"
      />
    </div>
    <span class="tool-label">{{ tool.label }}</span>
    <Icon
      v-if="tool.children?.length"
      icon="mdi:chevron-right"
      class="tool-arrow"
      width="10"
      height="10"
    />

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
import { Icon } from "@iconify/vue"
import type {
  FloatingTool,
  FloatingToolChild,
} from "../types"

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
