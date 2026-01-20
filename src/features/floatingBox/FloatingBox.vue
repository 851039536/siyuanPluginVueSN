<template>
  <div
    class="floating-box-wrapper"
    :class="{ collapsed: !isExpanded }"
    ref="wrapperRef"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 桌面端：悬浮触发按钮 -->
    <div
      class="floating-box-trigger desktop-trigger"
      :class="{ expanded: isExpanded }"
    >
      <svg class="trigger-icon" viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
      </svg>
    </div>

    <!-- 移动端：点击触发按钮 -->
    <div
      class="floating-box-trigger mobile-trigger"
      :class="{ expanded: isExpanded }"
      @click="toggleMobileExpanded"
    >
      <svg class="trigger-icon" viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
      </svg>
    </div>

    <!-- 展开工具栏 -->
    <Transition name="toolbar">
      <div v-if="isExpanded" class="floating-toolbar">
        <!-- 工具按钮 -->
        <div
          v-for="tool in tools"
          :key="tool.id"
          class="tool-item"
          :title="tool.title"
          @click="handleToolClick(tool)"
        >
          <div class="tool-icon" :style="{ background: tool.bgColor }">
            <svg viewBox="0 0 24 24" width="18" height="18" v-html="tool.icon" />
          </div>
          <span class="tool-label">{{ tool.label }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  createSuperPanelTool,
  createRefreshTool,
  skillsTool,
  createTextDiffTool
} from './tools'
import type { FloatingTool } from './types'

const props = defineProps<{
  plugin?: any
}>()

const isExpanded = ref(false)
const isMobile = ref(false)

// 桌面端工具列表（全部功能）
const desktopTools = ref<FloatingTool[]>([])

// 移动端工具列表（仅超级面板和刷新）
const mobileTools = computed(() => [
  createSuperPanelTool(props.plugin),
  createRefreshTool(props.plugin),
])

// 根据设备类型返回对应的工具列表
const tools = computed(() => {
  return isMobile.value ? mobileTools.value : desktopTools.value
})

// 检测是否为移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)

  // Create desktop tools array with plugin instance
  const toolList: FloatingTool[] = [
    createSuperPanelTool(props.plugin),
    createRefreshTool(props.plugin),
    createTextDiffTool(props.plugin),
  ]

  // Add skills tool if plugin is available
  if (props.plugin && props.plugin.settings?.enableSkills !== false) {
    toolList.push(skillsTool(props.plugin))
  }

  desktopTools.value = toolList
})

const handleMouseEnter = () => {
  isExpanded.value = true
}

const handleMouseLeave = () => {
  isExpanded.value = false
}

const toggleMobileExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const handleToolClick = (tool: FloatingTool) => {
  // 传递 plugin 实例给工具的 action 函数
  tool.action(props.plugin)
}
</script>

<style scoped lang="scss">
@use './FloatingBox.scss';
</style>
