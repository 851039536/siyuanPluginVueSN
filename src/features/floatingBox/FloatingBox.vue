<template>
  <div class="floating-box-wrapper" ref="wrapperRef">
    <!-- 悬浮触发按钮 -->
    <div
      class="floating-box-trigger"
      :class="{ expanded: isExpanded }"
      @click.stop="toggleExpand"
      @mouseenter="showTooltip = true"
      @mouseleave="showTooltip = false"
    >
      <svg v-if="!isExpanded" class="trigger-icon" viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M3 3h8v8H3V3m2 2v4h4V5H5m8-2h8v8h-8V3m2 2v4h4V5h-4M3 13h8v8H3v-8m2 2v4h4v-4H5m8-2h8v8h-8v-8m2 2v4h4v-4h-4"/>
      </svg>
      <svg v-else class="trigger-icon" viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
      <!-- 提示文字 -->
      <Transition name="tooltip">
        <span v-if="showTooltip && !isExpanded" class="trigger-tooltip">快捷工具</span>
      </Transition>
    </div>

    <!-- 展开工具栏 -->
    <Transition name="toolbar">
      <div v-if="isExpanded" class="floating-toolbar" @click.stop>
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
import { ref, onMounted, onUnmounted } from 'vue'
import { allTools } from './tools'
import type { FloatingTool } from './types'

defineProps<{
  i18n?: Record<string, string>
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const isExpanded = ref(false)
const showTooltip = ref(false)
const tools = ref<FloatingTool[]>(allTools)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
  showTooltip.value = false
}

const handleToolClick = (tool: FloatingTool) => {
  tool.action()
  isExpanded.value = false
}

// 点击外部关闭
const handleClickOutside = (event: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    isExpanded.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped lang="scss">
.floating-box-wrapper {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
}

.floating-box-trigger {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
  }

  &.expanded {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
    box-shadow: 0 4px 15px rgba(238, 90, 36, 0.4);
    border-radius: 50%;

    &:hover {
      box-shadow: 0 6px 20px rgba(238, 90, 36, 0.5);
    }
  }
}

.trigger-icon {
  transition: transform 0.3s ease;
}

.trigger-tooltip {
  position: absolute;
  right: 54px;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  pointer-events: none;

  &::after {
    content: '';
    position: absolute;
    right: -6px;
    top: 50%;
    transform: translateY(-50%);
    border: 6px solid transparent;
    border-left-color: rgba(0, 0, 0, 0.8);
    border-right: none;
  }
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition: all 0.2s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

.floating-toolbar {
  position: absolute;
  right: 54px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: var(--b3-theme-background);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--b3-theme-surface-lighter);
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;

  &:hover {
    background: var(--b3-theme-surface-lighter);
    transform: translateX(-2px);

    .tool-icon {
      transform: scale(1.1);
    }
  }

  &:active {
    transform: scale(0.98);
  }
}

.tool-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.tool-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

/* 工具栏动画 */
.toolbar-enter-active,
.toolbar-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toolbar-enter-from,
.toolbar-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.9);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .floating-box-wrapper {
    right: 12px;
  }

  .floating-box-trigger {
    width: 40px;
    height: 40px;
  }

  .floating-toolbar {
    right: 50px;
  }

  .tool-item {
    padding: 6px 10px;
    min-width: 100px;
  }

  .tool-icon {
    width: 28px;
    height: 28px;
  }

  .tool-label {
    font-size: 12px;
  }
}
</style>
