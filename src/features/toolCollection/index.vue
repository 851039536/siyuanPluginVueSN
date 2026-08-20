<template>
  <Transition name="slide-up">
    <div
      v-if="mode === 'overlay' ? visible?.value : true"
      class="tool-collection-overlay"
      :class="{ 'tab-mode': mode === 'tab' }"
      @click.self="mode === 'overlay' ? close() : undefined"
    >
      <div
        class="tool-collection-panel"
        :class="{ 'tab-mode': mode === 'tab' }"
        :style="mode === 'overlay' ? panelStyle : undefined"
      >
        <!-- 拖拽调整高度手柄（仅底部面板模式显示） -->
        <div
          v-if="mode === 'overlay'"
          class="resize-handle"
          @mousedown="onResizeStart"
        />
        <!-- 头部 -->
        <div class="tool-collection-header">
          <span class="header-title">{{ i18n.toolCollection }}</span>
          <!-- 尺寸调整按钮组（仅底部面板模式显示） -->
          <div
            v-if="mode === 'overlay'"
            class="header-resize"
          >
            <!-- 按钮提示："变窄" -->
            <button
              class="resize-btn"
              :title="i18n.toolCollectionPanel.narrower"
              :disabled="panelWidth <= 500"
              @click="adjustDimension('width', -80, 500, 1600)"
            >
              <Icon
                icon="mdi:chevron-left"
                :size="12"
              />
            </button>
            <span class="resize-label">{{ panelWidth }}</span>
            <!-- 按钮提示："变宽" -->
            <button
              class="resize-btn"
              :title="i18n.toolCollectionPanel.wider"
              :disabled="panelWidth >= 1600"
              @click="adjustDimension('width', 80, 500, 1600)"
            >
              <Icon
                icon="mdi:chevron-right"
                :size="12"
              />
            </button>
            <span class="resize-divider" />
            <!-- 按钮提示："变矮" -->
            <button
              class="resize-btn"
              :title="i18n.toolCollectionPanel.shorter"
              :disabled="panelHeight <= 30"
              @click="adjustDimension('height', -10, 30, 100)"
            >
              <Icon
                icon="mdi:chevron-down"
                :size="12"
              />
            </button>
            <span class="resize-label">{{ panelHeight }}</span>
            <!-- 按钮提示："变高" -->
            <button
              class="resize-btn"
              :title="i18n.toolCollectionPanel.taller"
              :disabled="panelHeight >= 100"
              @click="adjustDimension('height', 10, 30, 100)"
            >
              <Icon
                icon="mdi:chevron-up"
                :size="12"
              />
            </button>
          </div>
          <!-- 在独立窗口打开（浮动窗口内隐藏；关闭浮动窗口自动移回主窗口） -->
          <button
            v-if="!isFloating"
            class="header-float"
            :title="i18n.toolCollectionPanel.openFloatingWindow"
            @click="openFloatingWindow"
          >
            <Icon
              icon="mdi:dock-window"
              :size="14"
            />
          </button>
          <!-- 关闭按钮（仅底部面板模式显示） -->
          <button
            v-if="mode === 'overlay'"
            class="header-close"
            @click="close"
          >
            <Icon
              icon="mdi:close"
              :size="14"
            />
          </button>
        </div>

        <!-- Tab 标签栏（左右箭头 + 可滚动 Tab 条） -->
        <div class="tool-collection-tab-bar">
          <!-- 按钮提示："上一个工具 (←)" -->
          <button
            class="tab-nav-btn tab-nav-left"
            :title="i18n.toolCollectionPanel.prevTool"
            @click="prevTool"
          >
            <Icon
              icon="mdi:arrow-left"
              :size="12"
            />
          </button>
          <div class="tool-collection-tabs">
            <button
              v-for="(tool, idx) in tools"
              :key="tool.id"
              class="tab-btn"
              :class="{ active: currentTool === tool.id, dragging: dragIndex === idx }"
              :ref="(el) => { if (currentTool === tool.id) activeTabRef = el as HTMLButtonElement | null }"
              draggable="true"
              @click="currentTool = tool.id"
              @dragstart="onDragStart(idx)"
              @dragover="onDragOver"
              @drop="onDrop(idx)"
              @dragend="onDragEnd"
            >
              <Icon
                :icon="tool.icon"
                :size="14"
              />
              {{ tool.label }}
            </button>
          </div>
          <!-- 按钮提示："下一个工具 (→)" -->
          <button
            class="tab-nav-btn tab-nav-right"
            :title="i18n.toolCollectionPanel.nextTool"
            @click="nextTool"
          >
            <Icon
              icon="mdi:arrow-right"
              :size="12"
            />
          </button>
          <span class="tab-keyhint">← →</span>
        </div>

        <!-- 工具内容区（动态组件，由 registry 驱动） -->
        <div class="tool-collection-content">
          <component
            :is="currentToolMeta.component"
            :key="currentTool"
            :plugin="plugin"
            :i18n="plugin.i18n"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * 工具合集 - 主组件（overlay 底部面板 / tab 独立页签双形态）
 * Tab 切换多个实用小工具，支持键盘导航、面板尺寸持久化与独立窗口承载
 */
import type { Plugin } from "siyuan"
import { getFrontend } from "siyuan"
import type { Ref } from "vue"
import type { ToolMeta } from "./types"
import { Icon } from "@iconify/vue"
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue"
import { usePanelResize } from "./composables/usePanelResize"
import { useDragResize } from "./composables/useDragResize"
import { useTabReorder } from "./composables/useTabReorder"
import { useToolNavigation } from "./composables/useToolNavigation"
import {
  TOOL_LABEL_KEYS,
  TOOL_REGISTRY,
} from "./tools/registry"

/** 面板 i18n 键的最小类型声明 */
interface PanelI18n {
  toolCollection: string
  toolCollectionPanel: {
    narrower: string
    wider: string
    shorter: string
    taller: string
    prevTool: string
    nextTool: string
    openFloatingWindow: string
  }
}

interface Props {
  plugin: Plugin
  visible?: Ref<boolean>
  /** 承载模式：overlay = 底部滑入面板；tab = 独立页签/浮动窗口 */
  mode?: "overlay" | "tab"
}

const props = withDefaults(defineProps<Props>(), {
  mode: "overlay",
})

const i18n = props.plugin.i18n as unknown as PanelI18n

const close = () => {
  if (props.visible) {
    props.visible.value = false
  }
}

/** 当前是否运行在独立浮动窗口中（思源 getFrontend()：desktop=主窗口 / desktop-window=新窗口） */
const isFloating = computed(() => {
  try {
    return getFrontend() === "desktop-window"
  } catch {
    return false
  }
})

/** 打开独立浮动窗口：经 __toolCollection 挂载的 Manager 调度，同时关闭底部面板避免双实例 */
const openFloatingWindow = () => {
  const manager = (props.plugin as any).__toolCollection as
    | { openFloating: () => void }
    | undefined
  if (!manager) return
  close()
  void manager.openFloating()
}

// ==================== 面板尺寸 ====================
const { panelWidth, panelHeight, panelStyle, adjustDimension, loadPersistedSize, saveHeight } = usePanelResize(props.plugin)
const { onResizeStart } = useDragResize(panelHeight, saveHeight)

// ==================== 工具注册表（由 registry.ts 驱动） ====================
const tools = ref<ToolMeta[]>(TOOL_REGISTRY.map((t) => ({
  ...t,
  label: TOOL_LABEL_KEYS[t.id]?.(props.plugin.i18n) ?? t.id,
})))

// ==================== Tab 拖拽排序 ====================
const { dragIndex, onDragStart, onDragOver, onDrop, onDragEnd } = useTabReorder(tools, props.plugin)

// ==================== Tab 导航 + 键盘交互 ====================
// tab 模式无 visible prop，键盘交互视为始终可见
const visibleForNav = computed(() => props.visible?.value ?? true)
const { currentTool, prevTool, nextTool, handleKeydown } = useToolNavigation(
  tools,
  visibleForNav,
  close
)

const currentToolMeta = computed(() =>
  tools.value.find((t) => t.id === currentTool.value) ?? tools.value[0]
)

// 当前激活的 Tab 按钮 ref（打开时聚焦于此，兼顾键盘上下文与无障碍）
const activeTabRef = ref<HTMLButtonElement | null>(null)

watch(
  () => props.visible?.value,
  (val) => {
    if (val) {
      nextTick(() => activeTabRef.value?.focus())
    }
  },
)

onMounted(async () => {
  // 键盘监听注册必须在任何 await 之前
  window.addEventListener("keydown", handleKeydown)
  await loadPersistedSize()
})
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
