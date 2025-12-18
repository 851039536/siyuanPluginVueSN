<template>
  <div
    class="floating-box-wrapper"
    :class="{ collapsed: !isExpanded }"
    ref="wrapperRef"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <!-- 悬浮触发按钮 -->
    <div
      class="floating-box-trigger"
      :class="{ expanded: isExpanded }"
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
import { ref, onMounted } from 'vue'
import { superPanelTool, timestampTool, refreshTool, skillsTool } from './tools'
import type { FloatingTool } from './types'

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: any
}>()

const isExpanded = ref(false)
const tools = ref<FloatingTool[]>([])

onMounted(() => {
  // Create tools array with plugin instance
  const toolList: FloatingTool[] = [
    superPanelTool,
    timestampTool,
    refreshTool,
  ]

  // Add skills tool if plugin is available
  if (props.plugin && props.plugin.settings?.enableSkills !== false) {
    toolList.push(skillsTool(props.plugin))
  }

  tools.value = toolList
})

const handleMouseEnter = () => {
  isExpanded.value = true
}

const handleMouseLeave = () => {
  isExpanded.value = false
}

const handleToolClick = (tool: FloatingTool) => {
  tool.action()
}
</script>

<style scoped lang="scss">
.floating-box-wrapper {
  position: fixed;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: opacity 0.3s ease;

  &.collapsed {
    opacity: 0.35;

    &:hover {
      opacity: 1;
    }
  }
}

.floating-box-trigger {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);

  &:hover {
    transform: scale(1.08);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    background: var(--b3-theme-primary-light);
  }

  &:active {
    transform: scale(0.98);
  }
}

.trigger-icon {
  transition: transform 0.3s ease;
}

.floating-toolbar {
  position: absolute;
  right: 36px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--b3-theme-background);
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--b3-border-color);
  backdrop-filter: blur(10px);
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 80px;

  &:hover {
    background: var(--b3-list-hover);

    .tool-icon {
      transform: scale(1.08) rotate(5deg);
    }
  }

  &:active {
    transform: scale(0.98);
    background: var(--b3-list-hover);
  }
}

.tool-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tool-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--b3-theme-on-background);
  white-space: nowrap;
}

/* 工具栏动画 */
.toolbar-enter-active,
.toolbar-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.toolbar-enter-from,
.toolbar-leave-to {
  opacity: 0;
  transform: translateX(12px) scale(0.95);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .floating-box-wrapper {
    right: 6px;
  }

  .floating-box-trigger {
    width: 26px;
    height: 26px;
  }

  .floating-toolbar {
    right: 32px;
  }

  .tool-item {
    padding: 4px 8px;
    min-width: 70px;
  }

  .tool-icon {
    width: 20px;
    height: 20px;
  }

  .tool-label {
    font-size: 10px;
  }
}
</style>
