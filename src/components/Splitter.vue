<!-- 分割面板容器：拖动分隔条或按方向键调整相邻面板尺寸，支持受控/非受控、可折叠与尺寸持久化 -->
<template>
  <div
    ref="rootRef"
    :class="rootClasses"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type {
  SplitterContext,
  SplitterLayout,
  SplitterPanelApi,
  SplitterSizes,
} from "./splitter/types"
import {
  computed,
  onMounted,
  provide,
  ref,
  shallowReactive,
} from "vue"
import {
  normalizeConstraint,
  resizePair,
  resolveInitialSizes,
  stepTarget,
} from "./splitter/sizes"
import {
  readStoredSizes,
  resolveStorage,
  writeStoredSizes,
} from "./splitter/storage"
import {
  DEFAULT_GUTTER_SIZE,
  DEFAULT_RESIZE_LABEL,
  DEFAULT_STEP,
  SPLITTER_CONTEXT_KEY,
} from "./splitter/types"
import "./kit/theme"

/** 尺寸事件载荷（与官方 resizestart / resize / resizeend 同形） */
interface SplitterSizeEventShape {
  originalEvent: Event
  sizes: number[]
}

/** collapse 事件载荷（与官方同形） */
interface SplitterCollapseEventShape {
  index: number
  collapsed: boolean
  sizes: number[]
}

export type SplitterSizeEvent = SplitterSizeEventShape
export type SplitterCollapseEvent = SplitterCollapseEventShape

interface Props {
  /** 面板方向：`horizontal` 左右排布（默认）、`vertical` 上下排布（需父容器有确定高度） */
  layout?: SplitterLayout
  /** 分隔条尺寸（px），同时决定拖拽命中区大小 */
  gutterSize?: number
  /** 方向键每次调整的百分比步进 */
  step?: number
  /** 是否禁用调整（同时移除分隔条的 tabindex） */
  disabled?: boolean
  /**
   * 受控尺寸数组（百分比，按面板顺序）；**传入即受控**，配合 `v-model:sizes`；
   * 不传时组件内部自持（非受控）。
   */
  sizes?: SplitterSizes
  /** 提供后把尺寸持久化到 Web Storage（读取结果长度与面板数不符时忽略；受控模式下不读写） */
  stateKey?: string
  /** 持久化位置 */
  stateStorage?: "session" | "local"
  /** 分隔条的无障碍名称（默认中文，可覆盖为调用方 i18n 文案） */
  resizeLabel?: string
}

interface Emits {
  (e: "update:sizes", sizes: SplitterSizes): void
  (e: "resizestart", event: SplitterSizeEventShape): void
  (e: "resize", event: SplitterSizeEventShape): void
  (e: "resizeend", event: SplitterSizeEventShape): void
  (e: "collapse", event: SplitterCollapseEventShape): void
}

const props = withDefaults(defineProps<Props>(), {
  layout: "horizontal",
  gutterSize: DEFAULT_GUTTER_SIZE,
  step: DEFAULT_STEP,
  disabled: false,
  stateStorage: "session",
  resizeLabel: DEFAULT_RESIZE_LABEL,
})

const emit = defineEmits<Emits>()

const rootRef = ref<HTMLElement>()

/** 已注册面板：顺序 = 挂载顺序 = DOM 顺序 */
const panels = shallowReactive<SplitterPanelApi[]>([])

/** 非受控尺寸（受控时以 props.sizes 为准） */
const innerSizes = ref<SplitterSizes>([])

/** 是否已调整过尺寸：调整过之后不再随面板注册 / 属性变化重算 */
let touched = false

const resizing = ref(false)

const sizes = computed<SplitterSizes>(() => props.sizes ?? innerSizes.value)

/** 拖拽主轴：水平布局看 X，垂直布局看 Y */
const axis = computed<"x" | "y">(() => (props.layout === "horizontal" ? "x" : "y"))

/** 面板约束（每次读取都取最新 props，再归一化） */
const constraintOf = (index: number) => {
  const panel = panels[index]
  return normalizeConstraint({
    min: panel?.getMinSize() ?? 0,
    max: panel?.getMaxSize() ?? 100,
    collapsible: panel?.getCollapsible() ?? false,
    collapsedSize: panel?.getCollapsedSize() ?? 0,
  })
}

/** 应用新尺寸：受控只派发事件，非受控写入内部状态 */
const applySizes = (next: SplitterSizes) => {
  touched = true
  if (props.sizes) {
    emit("update:sizes", next)
    return
  }
  innerSizes.value = next
}

/** 折叠态发生变化时按面板逐个派发 collapse */
const emitCollapseChanges = (before: SplitterSizes, after: SplitterSizes) => {
  for (let index = 0; index < panels.length; index++) {
    const min = constraintOf(index).min
    const wasCollapsed = (before[index] ?? 0) < min
    const nowCollapsed = (after[index] ?? 0) < min
    if (wasCollapsed !== nowCollapsed && panels[index].getCollapsible()) {
      emit("collapse", {
        index,
        collapsed: nowCollapsed,
        sizes: [...after],
      })
    }
  }
}

/** 按各面板 size 重算初始尺寸（受控或已调整过时跳过） */
const syncFromPanels = () => {
  if (props.sizes || touched) return
  innerSizes.value = resolveInitialSizes(panels.map((panel) => panel.getSize()))
}

const register = (api: SplitterPanelApi) => {
  panels.push(api)
  if (!props.sizes && innerSizes.value.length !== panels.length) {
    if (touched) {
      // 已调整过尺寸后又新增面板：补一个「剩余份额」，避免该面板退化成 100% 撑破布局
      const used = innerSizes.value.reduce((sum, value) => sum + value, 0)
      innerSizes.value = [...innerSizes.value, Math.max(0, 100 - used)]
    } else {
      innerSizes.value = resolveInitialSizes(panels.map((panel) => panel.getSize()))
    }
  } else {
    syncFromPanels()
  }

  return () => {
    const index = panels.indexOf(api)
    if (index < 0) return
    panels.splice(index, 1)
    if (!props.sizes) {
      const next = [...innerSizes.value]
      next.splice(index, 1)
      innerSizes.value = next
    }
  }
}

const indexOf = (id: symbol) => panels.findIndex((panel) => panel.id === id)

// ==================== 尺寸持久化 ====================

/** 读取已保存尺寸（受控模式或未配置 stateKey 时不读） */
const readSizes = () =>
  props.sizes || !props.stateKey
    ? null
    : readStoredSizes(resolveStorage(props.stateStorage), props.stateKey)

/** 保存当前尺寸（受控模式或未配置 stateKey 时不写） */
const persistSizes = () => {
  if (props.sizes || !props.stateKey) return
  writeStoredSizes(resolveStorage(props.stateStorage), props.stateKey, sizes.value)
}

// ==================== 拖拽 ====================

interface DragState {
  /** 分隔条右侧面板索引 */
  index: number
  startPosition: number
  startSizes: SplitterSizes
  containerSize: number
}

/** 拖拽期间的临时状态（非响应式，避免每帧触发额外渲染） */
let drag: DragState | null = null

const onGutterPointerDown = (event: PointerEvent, id: symbol) => {
  if (props.disabled) return
  const index = indexOf(id)
  if (index <= 0) return

  const rect = rootRef.value?.getBoundingClientRect()
  const containerSize = rect ? (axis.value === "x" ? rect.width : rect.height) : 0
  if (containerSize <= 0) return

  drag = {
    index,
    startPosition: axis.value === "x" ? event.clientX : event.clientY,
    startSizes: [...sizes.value],
    containerSize,
  }
  resizing.value = true

  // 指针捕获：指针移出分隔条后 move / up 仍派发到该元素
  const gutter = event.currentTarget as HTMLElement | null
  gutter?.setPointerCapture?.(event.pointerId)

  emit("resizestart", {
    originalEvent: event,
    sizes: [...sizes.value],
  })
}

const onGutterPointerMove = (event: PointerEvent) => {
  if (!drag || props.disabled) return

  const position = axis.value === "x" ? event.clientX : event.clientY
  const delta = ((position - drag.startPosition) / drag.containerSize) * 100
  const before = [...sizes.value]
  const result = resizePair({
    sizes: drag.startSizes,
    index: drag.index,
    nextTarget: (drag.startSizes[drag.index] ?? 0) - delta,
    prev: constraintOf(drag.index - 1),
    next: constraintOf(drag.index),
  })

  applySizes(result.sizes)
  emit("resize", {
    originalEvent: event,
    sizes: result.sizes,
  })
  emitCollapseChanges(before, result.sizes)
}

const onGutterPointerUp = (event: PointerEvent) => {
  if (!drag) return

  const gutter = event.currentTarget as HTMLElement | null
  if (gutter?.hasPointerCapture?.(event.pointerId)) {
    gutter.releasePointerCapture(event.pointerId)
  }

  drag = null
  resizing.value = false
  emit("resizeend", {
    originalEvent: event,
    sizes: [...sizes.value],
  })
  persistSizes()
}

// ==================== 键盘 ====================

const onGutterKeydown = (event: KeyboardEvent, id: symbol) => {
  if (props.disabled) return
  const index = indexOf(id)
  if (index <= 0) return

  const horizontal = props.layout === "horizontal"
  let grow: "prev" | "next" | null = null
  if (horizontal && event.key === "ArrowLeft") grow = "prev"
  else if (horizontal && event.key === "ArrowRight") grow = "next"
  else if (!horizontal && event.key === "ArrowUp") grow = "prev"
  else if (!horizontal && event.key === "ArrowDown") grow = "next"
  if (!grow) return

  event.preventDefault()

  const prevConstraint = constraintOf(index - 1)
  const nextConstraint = constraintOf(index)
  const before = [...sizes.value]
  const result = resizePair({
    sizes: sizes.value,
    index,
    nextTarget: stepTarget({
      sizes: sizes.value,
      index,
      step: props.step,
      grow,
      prev: prevConstraint,
      next: nextConstraint,
    }),
    prev: prevConstraint,
    next: nextConstraint,
  })

  applySizes(result.sizes)
  // 键盘操作是一次完整交互：resize 与 resizeend 同时派发，便于调用方直接落盘
  emit("resize", {
    originalEvent: event,
    sizes: result.sizes,
  })
  emit("resizeend", {
    originalEvent: event,
    sizes: result.sizes,
  })
  emitCollapseChanges(before, result.sizes)
  persistSizes()
}

// ==================== 上下文 ====================

/** 上下文用 getter 取值：消费方读取即建立响应式依赖，且无需解包 ref */
const context: SplitterContext = {
  get layout() {
    return props.layout
  },
  get sizes() {
    return sizes.value
  },
  get disabled() {
    return props.disabled
  },
  get resizing() {
    return resizing.value
  },
  get gutterSize() {
    return props.gutterSize
  },
  get resizeLabel() {
    return props.resizeLabel
  },
  indexOf,
  getGutterMetrics: (id: symbol) => {
    const index = Math.max(0, indexOf(id) - 1)
    const constraint = constraintOf(index)
    return {
      now: sizes.value[index] ?? 0,
      min: constraint.min,
      max: constraint.max,
    }
  },
  register,
  onGutterPointerDown,
  onGutterPointerMove,
  onGutterPointerUp,
  onGutterKeydown,
}

provide(SPLITTER_CONTEXT_KEY, context)

/** 重置尺寸：优先已保存状态，其次各面板 size，最后均分（对外暴露的方法） */
const resetState = () => {
  touched = false
  const stored = readSizes()
  if (stored && stored.length === panels.length) {
    innerSizes.value = stored
    touched = true
    return
  }
  syncFromPanels()
}

defineExpose({ resetState })

onMounted(() => {
  // 子级 SplitterPanel 的 onMounted 先于父级执行，此处所有面板均已注册
  const stored = readSizes()
  if (stored && stored.length === panels.length) {
    innerSizes.value = stored
    touched = true
    return
  }
  syncFromPanels()
})

const rootClasses = computed(() => [
  "si-splitter",
  `si-splitter--${props.layout}`,
  {
    "si-splitter--resizing": resizing.value,
    "si-splitter--disabled": props.disabled,
  },
])
</script>

<style scoped lang="scss">
@use './styles/Splitter.scss';
</style>
