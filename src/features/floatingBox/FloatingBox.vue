<template>
  <div class="floating-box-wrapper">
    <!-- 悬浮触发按钮 -->
    <div
      class="floating-box-trigger"
      :class="{ expanded: isExpanded }"
      @click="toggleExpand"
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
import { ref } from 'vue'
import { showMessage } from 'siyuan'

interface Tool {
  id: string
  label: string
  title: string
  icon: string
  bgColor: string
  action: () => void
}

defineProps<{
  i18n?: Record<string, string>
}>()

const isExpanded = ref(false)
const showTooltip = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
  showTooltip.value = false
}

// 工具配置
const tools = ref<Tool[]>([
  {
    id: 'timestamp',
    label: '时间戳',
    title: '插入当前时间',
    icon: '<path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>',
    bgColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    action: () => {
      const now = new Date()
      const timestamp = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
      navigator.clipboard.writeText(timestamp)
      showMessage(`已复制: ${timestamp}`, 2000, 'info')
    }
  },
  {
    id: 'divider',
    label: '分割线',
    title: '插入分割线',
    icon: '<path fill="currentColor" d="M19 13H5v-2h14v2z"/>',
    bgColor: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    action: () => {
      navigator.clipboard.writeText('---')
      showMessage('分割线已复制到剪贴板', 2000, 'info')
    }
  },
  {
    id: 'todo',
    label: '待办',
    title: '插入待办事项',
    icon: '<path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2m0 16H5V5h14v14M17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99 8-8z"/>',
    bgColor: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    action: () => {
      navigator.clipboard.writeText('* [ ] ')
      showMessage('待办格式已复制', 2000, 'info')
    }
  },
  {
    id: 'codeblock',
    label: '代码块',
    title: '插入代码块',
    icon: '<path fill="currentColor" d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4m5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>',
    bgColor: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    action: () => {
      navigator.clipboard.writeText('```\n\n```')
      showMessage('代码块格式已复制', 2000, 'info')
    }
  },
  {
    id: 'quote',
    label: '引用',
    title: '插入引用块',
    icon: '<path fill="currentColor" d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z"/>',
    bgColor: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    action: () => {
      navigator.clipboard.writeText('> ')
      showMessage('引用格式已复制', 2000, 'info')
    }
  },
  {
    id: 'link',
    label: '链接',
    title: '插入链接格式',
    icon: '<path fill="currentColor" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1M8 13h8v-2H8v2m9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>',
    bgColor: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    action: () => {
      navigator.clipboard.writeText('[链接文字](url)')
      showMessage('链接格式已复制', 2000, 'info')
    }
  }
])

const handleToolClick = (tool: Tool) => {
  tool.action()
  isExpanded.value = false
}
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
