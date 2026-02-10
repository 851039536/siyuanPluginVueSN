<template>
  <div
    class="floating-box-wrapper"
    :class="{ collapsed: !isExpanded }"
    ref="wrapperRef"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 触发按钮 - 桌面端悬停，移动端点击 -->
    <div
      class="floating-box-trigger"
      :class="{ expanded: isExpanded }"
      @click="isMobile && toggleExpanded()"
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
import { ref, onMounted, onUnmounted, computed } from 'vue'
import {
  createSuperPanelTool,
  createRefreshTool,
  skillsTool,
  createTextDiffTool,
  createPasswordVaultTool,
  createFlashcardReadingTool
} from './tools'
import type { FloatingTool } from './types'

const props = defineProps<{
  plugin?: any
}>()

const isExpanded = ref(false)
const isMobile = ref(false)

// 桌面端工具列表（全部功能）
const desktopTools = ref<FloatingTool[]>([])

// 移动端工具列表（超级面板、刷新、密码箱、单词阅读）- 缓存避免重复创建
const mobileToolsCache = ref<FloatingTool[]>([])

// 根据设备类型返回对应的工具列表
const tools = computed(() => isMobile.value ? mobileToolsCache.value : desktopTools.value)

// 检测是否为移动端（带防抖）
let resizeTimer: ReturnType<typeof setTimeout> | null = null
const MOBILE_BREAKPOINT = 768

const checkMobile = () => {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
}

const debouncedCheckMobile = () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(checkMobile, 150)
}

// 初始化工具列表
const initTools = () => {
  // 移动端工具（缓存）
  mobileToolsCache.value = [
    createSuperPanelTool(props.plugin),
    createRefreshTool(props.plugin),
    createPasswordVaultTool(props.plugin),
    createFlashcardReadingTool(props.plugin),
  ]

  // 桌面端工具
  const toolList: FloatingTool[] = [
    createSuperPanelTool(props.plugin),
    createRefreshTool(props.plugin),
    createTextDiffTool(props.plugin),
  ]

  // Add skills tool if plugin is available
  if (props.plugin?.settings?.enableSkills !== false) {
    toolList.push(skillsTool(props.plugin))
  }

  desktopTools.value = toolList
}

onMounted(() => {
  checkMobile()
  initTools()
  window.addEventListener('resize', debouncedCheckMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', debouncedCheckMobile)
  if (resizeTimer) clearTimeout(resizeTimer)
})

const handleMouseEnter = () => {
  if (!isMobile.value) isExpanded.value = true
}

const handleMouseLeave = () => {
  if (!isMobile.value) isExpanded.value = false
}

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const handleToolClick = (tool: FloatingTool) => {
  tool.action(props.plugin)
}
</script>

<style scoped lang="scss">
@use './FloatingBox.scss';
</style>
