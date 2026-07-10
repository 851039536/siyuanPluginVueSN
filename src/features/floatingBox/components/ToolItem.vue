<!-- 悬浮框工具项按钮：图标+标签+可选子菜单 -->
<template>
  <div
    class="tool-item"
    :class="{ 'has-children': hasChildren }"
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
      v-if="hasChildren"
      icon="mdi:chevron-right"
      class="tool-arrow"
      width="10"
      height="10"
    />

    <!-- 子菜单 -->
    <div
      v-if="hasChildren"
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
import type { Plugin } from "siyuan"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import type {
  FloatingTool,
  FloatingToolChild,
} from "../types"

const props = defineProps<{
  tool: FloatingTool
  plugin?: Plugin
}>()

const hasChildren = computed(() => (props.tool.children?.length ?? 0) > 0)

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
