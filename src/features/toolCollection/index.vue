<template>
  <Transition name="slide-up">
    <div
      v-if="mode === 'tab' || !!visible?.value"
      class="tool-collection-overlay"
      :class="{ 'tab-mode': mode === 'tab' }"
      @click.self="close"
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
        <!-- 头部（独立浮动窗口内隐藏：窗口页签标题已标识"工具合集"，避免重复字样；底部面板正常显示） -->
        <div
          v-if="!isFloating"
          class="tool-collection-header"
        >
          <span class="header-title">{{ i18n.toolCollection }}</span>
          <!-- 尺寸调整按钮组（仅底部面板模式显示），每个维度为 [减小] 数值 [增大]，如 "变窄 1060px 变宽" -->
          <div
            v-if="mode === 'overlay'"
            class="header-resize"
          >
            <template
              v-for="(axis, axisIndex) in resizeAxes"
              :key="axis.dimension"
            >
              <span
                v-if="axisIndex > 0"
                class="resize-divider"
              />
              <!-- 减小按钮："变窄"/"变矮" -->
              <button
                class="resize-btn"
                :title="axis.decrease.title"
                :disabled="currentSize(axis.dimension) <= axis.min"
                @click="adjustDimension(axis.dimension, -axis.step, axis.min, axis.max)"
              >
                <Icon
                  :icon="axis.decrease.icon"
                  :size="14"
                />
              </button>
              <span class="resize-label">{{ currentSize(axis.dimension) }}{{ axis.unit }}</span>
              <!-- 增大按钮："变宽"/"变高" -->
              <button
                class="resize-btn"
                :title="axis.increase.title"
                :disabled="currentSize(axis.dimension) >= axis.max"
                @click="adjustDimension(axis.dimension, axis.step, axis.min, axis.max)"
              >
                <Icon
                  :icon="axis.increase.icon"
                  :size="14"
                />
              </button>
            </template>
          </div>
          <!-- 在独立窗口打开："在独立窗口打开"（经 __toolCollection 的 Manager 调度；浮动窗口时整个头部已隐藏） -->
          <button
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

        <!-- 主内容区：左侧工具导航栏 + 右侧工具视图（横向双栏布局） -->
        <div class="tool-collection-body">
          <!-- 左侧工具导航栏（名称竖排列表，可滚动 / 可拖拽排序 / 键盘导航） -->
          <nav class="tool-collection-sidebar">
            <div class="tool-list">
              <button
                v-for="(tool, idx) in tools"
                :key="tool.id"
                class="tool-item"
                :class="{ active: currentTool === tool.id, dragging: dragIndex === idx }"
                :ref="(el) => { if (currentTool === tool.id) activeToolRef = el as HTMLButtonElement | null }"
                draggable="true"
                :title="tool.label"
                @click="currentTool = tool.id"
                @dragstart="onDragStart(idx)"
                @dragover="onDragOver"
                @drop="onDrop(idx)"
                @dragend="onDragEnd"
              >
                <span class="tool-item-label">{{ tool.label }}</span>
              </button>
            </div>
            <!-- 键盘导航提示："↑↓←→ 切换 · Ctrl+数字跳转" -->
            <div class="tool-keyhint">{{ i18n.toolCollectionPanel.keyhint }}</div>
          </nav>
          <!-- 右侧工具内容区（动态组件，由 registry 驱动） -->
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
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * 工具合集 - 主组件（overlay 底部面板 / tab 独立页签双形态）
 * 左侧工具列表 + 右侧内容双栏布局，支持键盘导航、面板尺寸持久化与独立窗口承载
 */
import type { Plugin } from "siyuan"
import { getFrontend } from "siyuan"
import type { Ref } from "vue"
import {
  PANEL_HEIGHT_MAX,
  PANEL_HEIGHT_MIN,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  type PanelDimension,
} from "./types"
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
import { useToolReorder } from "./composables/useToolReorder"
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
    openFloatingWindow: string
    keyhint: string
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

/** 尺寸调整轴配置：宽度步长 ±80px、高度步长 ±10vh，边界常量定义于 types/index.ts */
interface ResizeAxisButton {
  icon: string
  title: string
}
interface ResizeAxis {
  dimension: PanelDimension
  unit: "px" | "vh"
  min: number
  max: number
  step: number
  decrease: ResizeAxisButton
  increase: ResizeAxisButton
}

const panelAxisTitles = i18n.toolCollectionPanel
const resizeAxes: ResizeAxis[] = [
  {
    dimension: "width",
    unit: "px",
    min: PANEL_WIDTH_MIN,
    max: PANEL_WIDTH_MAX,
    step: 80,
    decrease: { icon: "mdi:chevron-left", title: panelAxisTitles.narrower },
    increase: { icon: "mdi:chevron-right", title: panelAxisTitles.wider },
  },
  {
    dimension: "height",
    unit: "vh",
    min: PANEL_HEIGHT_MIN,
    max: PANEL_HEIGHT_MAX,
    step: 10,
    decrease: { icon: "mdi:chevron-down", title: panelAxisTitles.shorter },
    increase: { icon: "mdi:chevron-up", title: panelAxisTitles.taller },
  },
]

/** 当前维度数值（供按钮禁用态与标签渲染） */
const currentSize = (dimension: PanelDimension) =>
  dimension === "width" ? panelWidth.value : panelHeight.value

// ==================== 工具注册表（由 registry.ts 驱动） ====================
const tools = ref<ToolMeta[]>(TOOL_REGISTRY.map((t) => ({
  ...t,
  label: TOOL_LABEL_KEYS[t.id]?.(props.plugin.i18n) ?? t.id,
})))

// ==================== 工具拖拽排序 ====================
const { dragIndex, onDragStart, onDragOver, onDrop, onDragEnd } = useToolReorder(tools, props.plugin)

// ==================== 工具导航 + 键盘交互 ====================
// tab 模式无 visible prop，键盘交互视为始终可见
const visibleForNav = computed(() => props.visible?.value ?? true)
const { currentTool, handleKeydown } = useToolNavigation(
  tools,
  visibleForNav,
  close
)

const currentToolMeta = computed(() =>
  tools.value.find((t) => t.id === currentTool.value) ?? tools.value[0]
)

// 当前激活的工具项按钮 ref（打开时聚焦于此，兼顾键盘上下文与无障碍）
const activeToolRef = ref<HTMLButtonElement | null>(null)

watch(
  () => props.visible?.value,
  (val) => {
    if (val) {
      nextTick(() => activeToolRef.value?.focus())
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
