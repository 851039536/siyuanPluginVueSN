<!-- 文字提示：锚点旁的气泡（非模态、无遮罩），hover / focus 触发 + 延迟可调 + 四向定位与 auto 翻转 -->
<template>
  <Transition name="si-tooltip-fade">
    <div
      v-if="isOpen"
      ref="bubbleRef"
      class="si-tooltip"
      :class="[
        `si-tooltip--${geometry.placement}`,
        `si-tooltip--${size}`,
        { 'si-tooltip--measuring': !positioned },
      ]"
      :style="bubbleStyle"
      role="tooltip"
      :id="tooltipId"
    >
      <span
        class="si-tooltip__arrow"
        :class="`si-tooltip__arrow--${arrowSide}`"
        :style="arrowStyle"
        aria-hidden="true"
      />
      <!-- 内容可整体替换（作用域给纯文本与其无障碍关联 id） -->
      <slot v-bind="contentScope">{{ text }}</slot>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type {
  TooltipPlacement as TooltipPlacementShape,
  TooltipSize as TooltipSizeShape,
  TooltipTrigger as TooltipTriggerShape,
} from "./tooltip/types"
import type { PopupGeometry } from "./tooltip/position"
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  watch,
} from "vue"
import {
  DEFAULT_HIDE_DELAY,
  DEFAULT_SHOW_DELAY,
} from "./tooltip/types"
import {
  POPUP_ARROW_SIZE,
  resolveTooltipPosition,
} from "./tooltip/position"
import { useTooltipTrigger } from "./tooltip/useTooltipTrigger"
import "./kit/theme"

// 公开类型转出（沿用 Dialog / Drawer 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type TooltipPlacement = TooltipPlacementShape
export type TooltipSize = TooltipSizeShape
export type TooltipTrigger = TooltipTriggerShape

interface Props {
  /** 气泡文案（默认插槽存在时被覆盖） */
  text?: string
  /**
   * 锚点元素：气泡贴它定位（通常传触发元素的 ref）。
   * 支持传函数以延迟取值（元素可能晚于组件挂载）；取不到时退化为视口居中。
   */
  target?: HTMLElement | (() => HTMLElement | null) | null
  /** 是否显示（**受控**，配合 `v-model:visible`；不传时组件自持 = 非受控，由 hover / focus 驱动） */
  visible?: boolean
  /** 期望方位：`top`（默认）/ `bottom` / `left` / `right` / `auto`（优先上方、放不下下翻） */
  placement?: TooltipPlacement
  /** 触发方式：`both`（默认）/ `hover` / `focus`（键盘用户可达性依赖 focus，非必要勿关） */
  trigger?: TooltipTrigger
  /** 显示延迟（毫秒，默认 0） */
  showDelay?: number
  /** 隐藏延迟（毫秒，默认 0） */
  hideDelay?: number
  /** 尺寸档位：只驱动字号与内边距（气泡宽度随内容自适应） */
  size?: TooltipSize
  /** 是否禁用（禁用时不响应任何触发） */
  disabled?: boolean
  /** 最大宽度（px，默认 240）：文案过长时在气泡内换行，而不是拉成一条长条 */
  maxWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  text: "",
  target: null,
  visible: undefined,
  placement: "top",
  trigger: "both",
  showDelay: DEFAULT_SHOW_DELAY,
  hideDelay: DEFAULT_HIDE_DELAY,
  size: "small",
  disabled: false,
  maxWidth: 240,
})

const emit = defineEmits<{
  "update:visible": [value: boolean]
  show: []
  hide: []
}>()

/** 气泡元素 id：锚点经 `aria-describedby` 关联它（由调用方或 `contentScope` 使用） */
const tooltipId = `${useId()}-tooltip`

const bubbleRef = ref<HTMLElement | null>(null)
/** 首帧先隐藏（visibility: hidden）等测量完成再显示，避免打开瞬间闪跳 */
const positioned = ref(false)
const geometry = ref<PopupGeometry>({
  top: 0,
  left: 0,
  placement: "top",
  arrowOffset: 0,
  arrowVertical: false,
})

/**
 * 非受控内部状态：`visible` 未传时由 hover / focus 驱动。
 * 沿用 Panel.collapsed 的「传入即受控、不传即自持」范式。
 */
const innerVisible = ref(false)
const isControlled = computed(() => props.visible !== undefined)
const isOpen = computed(() => (isControlled.value ? props.visible === true : innerVisible.value))

/** rAF 句柄：滚动 / 缩放期间每帧至多重算一次（显示 / 隐藏的延时句柄由 useTooltipTrigger 持有） */
let frame = 0

const bubbleStyle = computed(() => ({
  top: `${geometry.value.top}px`,
  left: `${geometry.value.left}px`,
  maxWidth: `${props.maxWidth}px`,
}))

/** 三角所贴的气泡边（与方位主轴相反） */
const arrowSide = computed(() => {
  const placement = geometry.value.placement
  if (placement === "bottom") return "top"
  if (placement === "top") return "bottom"
  return placement === "left" ? "right" : "left"
})

/** 三角沿所在边的偏移（横向边看 `left`、纵向边看 `top`） */
const arrowStyle = computed(() => {
  const offset = geometry.value.arrowOffset - POPUP_ARROW_SIZE / 2
  return geometry.value.arrowVertical
    ? { top: `${offset}px` }
    : { left: `${offset}px` }
})

/** 默认插槽作用域：文案与无障碍关联 id */
const contentScope = computed(() => ({
  text: props.text,
  tooltipId,
}))

const resolveTarget = (): HTMLElement | null => {
  const target = props.target
  if (!target) return null
  return typeof target === "function" ? target() : target
}

/** 测量锚点与气泡尺寸后写回视口坐标（锚点缺失时退化为视口居中的等值锚点） */
const updatePosition = () => {
  const bubble = bubbleRef.value
  if (!bubble) return

  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const anchorElement = resolveTarget()
  const anchorRect = anchorElement?.getBoundingClientRect()
  const bubbleRect = bubble.getBoundingClientRect()

  geometry.value = resolveTooltipPosition({
    anchor: anchorRect
      ? {
        top: anchorRect.top,
        left: anchorRect.left,
        width: anchorRect.width,
        height: anchorRect.height,
      }
      // 无锚点：以视口中心为零尺寸锚点，气泡落在中间而非左上角
      : {
        top: viewport.height / 2,
        left: viewport.width / 2,
        width: 0,
        height: 0,
      },
    popup: { width: bubbleRect.width, height: bubbleRect.height },
    viewport,
    placement: props.placement,
  })
}

const scheduleUpdate = () => {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    updatePosition()
  })
}

// ==================== 定位编排 ====================

/** 显示期间才绑定窗口监听：滚动（capture 覆盖任意滚动容器）与缩放时跟随锚点 */
const bindWindowEvents = () => {
  window.addEventListener("scroll", scheduleUpdate, true)
  window.addEventListener("resize", scheduleUpdate)
}

const unbindWindowEvents = () => {
  window.removeEventListener("scroll", scheduleUpdate, true)
  window.removeEventListener("resize", scheduleUpdate)
  if (frame) {
    cancelAnimationFrame(frame)
    frame = 0
  }
}

// ==================== 开合编排 ====================

/** 提交显示 / 隐藏：受控时只派发事件（单向数据流），自持时才改内部状态 */
const commitShow = () => {
  if (!isControlled.value) innerVisible.value = true
  emit("update:visible", true)
  emit("show")
}

const commitHide = () => {
  if (!isControlled.value) innerVisible.value = false
  emit("update:visible", false)
  emit("hide")
}

// 锚点监听 / 延迟定时器 / 补挂轮询统一交给私有组合式函数（生命周期随组件卸载自动清理）
useTooltipTrigger({
  resolveAnchor: resolveTarget,
  isOpen,
  showDelay: () => props.showDelay,
  hideDelay: () => props.hideDelay,
  trigger: () => props.trigger,
  disabled: () => props.disabled,
  onShow: commitShow,
  onHide: commitHide,
})

// 打开：重新测量后再显示（先隐藏避免在旧坐标闪跳）；关闭：解绑窗口监听
watch(
  isOpen,
  async (open) => {
    if (open) {
      positioned.value = false
      bindWindowEvents()
      await nextTick()
      updatePosition()
      positioned.value = true
    } else {
      unbindWindowEvents()
      positioned.value = false
    }
  },
  { immediate: true },
)

// 方位变化即时重算（尺寸变化由滚动 / 缩放与重新打开覆盖）
watch(() => props.placement, scheduleUpdate)

onBeforeUnmount(unbindWindowEvents)
</script>

<style scoped lang="scss">
@use './styles/Tooltip.scss';
</style>
