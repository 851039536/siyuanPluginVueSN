<!-- 分割面板：作为 Splitter 的直接子级使用，承载自身尺寸与左（上）侧分隔条；独立使用时退化为普通容器 -->
<template>
  <div
    class="si-splitter-panel"
    :class="{ 'si-splitter-panel--collapsed': collapsed }"
    :style="panelStyle"
  >
    <!-- 分隔条属于当前面板的左 / 上侧（首个面板没有），拖动即调整「上一个面板 + 本面板」 -->
    <div
      v-if="context && index > 0"
      class="si-splitter__gutter"
      :class="{ 'si-splitter__gutter--active': context.resizing }"
      :style="gutterStyle"
      role="separator"
      :aria-orientation="gutterOrientation"
      :aria-valuenow="Math.round(metrics.now)"
      :aria-valuemin="metrics.min"
      :aria-valuemax="metrics.max"
      :aria-label="context.resizeLabel"
      :aria-disabled="context.disabled ? 'true' : undefined"
      :tabindex="context.disabled ? -1 : 0"
      @pointerdown="handlePointerDown"
      @pointermove="context.onGutterPointerMove"
      @pointerup="context.onGutterPointerUp"
      @pointercancel="context.onGutterPointerUp"
      @keydown="handleKeydown"
    >
      <span
        class="si-splitter__gutter-handle"
        aria-hidden="true"
      />
    </div>

    <div class="si-splitter-panel__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  SplitterContext,
  SplitterPanelApi,
} from "./splitter/types"
import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
} from "vue"
import { SPLITTER_CONTEXT_KEY } from "./splitter/types"
import "./kit/theme"

interface Props {
  /** 初始尺寸（百分比，相对容器 100%）；未指定时与其它未指定面板均分剩余空间 */
  size?: number
  /** 最小尺寸（百分比） */
  minSize?: number
  /** 最大尺寸（百分比） */
  maxSize?: number
  /** 是否允许折叠到 `collapsedSize`（拖到 `minSize` 以下时吸附） */
  collapsible?: boolean
  /** 折叠尺寸（百分比） */
  collapsedSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  minSize: 0,
  maxSize: 100,
  collapsible: false,
  collapsedSize: 0,
})

/** 未注入（独立使用）时为 null，此时按普通容器渲染 */
const context = inject<SplitterContext | null>(SPLITTER_CONTEXT_KEY, null)

/** 注册给 Splitter 的只读能力：全部用 getter，注册后 props 变化仍读到最新值 */
const api: SplitterPanelApi = {
  id: Symbol("siSplitterPanel"),
  getSize: () => props.size,
  getMinSize: () => props.minSize,
  getMaxSize: () => props.maxSize,
  getCollapsible: () => props.collapsible,
  getCollapsedSize: () => props.collapsedSize,
}

let unregister: (() => void) | null = null

onMounted(() => {
  if (context) unregister = context.register(api)
})

onBeforeUnmount(() => {
  unregister?.()
  unregister = null
})

const index = computed(() => (context ? context.indexOf(api.id) : -1))

/** 当前尺寸（百分比）：未注册时退化为整宽，避免撑破布局 */
const size = computed(() => {
  if (!context) return 100
  const value = context.sizes[index.value]
  return typeof value === "number" ? value : 100
})

/** 折叠态：允许折叠且尺寸已低于自身最小值 */
const collapsed = computed(() => !!context && props.collapsible && size.value < props.minSize)

const panelStyle = computed(() => ({
  flexBasis: `${size.value}%`,
}))

const gutterStyle = computed(() => ({
  flexBasis: `${context?.gutterSize ?? 0}px`,
}))

/** 分隔条自身的物理方向：水平布局下是竖条，垂直布局下是横条 */
const gutterOrientation = computed(() => (context?.layout === "vertical" ? "horizontal" : "vertical"))

/** 分隔条的 aria 数值：取左侧面板的当前尺寸与其约束 */
const metrics = computed(() => context?.getGutterMetrics(api.id) ?? {
  now: 0,
  min: 0,
  max: 100,
})

const handlePointerDown = (event: PointerEvent) => {
  context?.onGutterPointerDown(event, api.id)
}

const handleKeydown = (event: KeyboardEvent) => {
  context?.onGutterKeydown(event, api.id)
}
</script>

<style scoped lang="scss">
@use './styles/SplitterPanel.scss';
</style>
