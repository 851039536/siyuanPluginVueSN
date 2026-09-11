<!-- 气泡确认：受控显示 + target 锚点，弹出在触发元素旁（非模态、无遮罩） -->
<template>
  <Transition name="si-confirm-popup-fade">
    <div
      v-if="visible"
      ref="popupRef"
      class="si-confirm-popup"
      :class="[
        `si-confirm-popup--${geometry.placement}`,
        { 'si-confirm-popup--measuring': !positioned },
      ]"
      :style="popupStyle"
      role="dialog"
      :aria-labelledby="header ? titleId : undefined"
      :aria-label="header ? undefined : ariaLabel"
      tabindex="-1"
    >
      <span
        class="si-confirm-popup__arrow"
        :class="`si-confirm-popup__arrow--${arrowSide}`"
        :style="arrowStyle"
        aria-hidden="true"
      />

      <!-- 整块内容可替换（作用域含全部字段与三个回调） -->
      <slot
        name="container"
        v-bind="containerScope"
      >
        <ConfirmBody
          :header="header"
          :message="message"
          :icon="icon"
          :accept-label="acceptLabel"
          :reject-label="rejectLabel"
          :accept-severity="acceptSeverity"
          :accept-icon="acceptIcon"
          :reject-icon="rejectIcon"
          :accept-loading="acceptLoading"
          :size="size"
          :title-id="titleId"
          @accept="handleConfirm"
          @reject="handleReject"
        >
          <!-- 五个官方插槽原样转发给内容段（未传时不建立插槽，让内容段的回退逻辑生效） -->
          <template
            v-if="$slots.default"
            #default
          >
            <slot />
          </template>
          <template
            v-if="$slots.message"
            #message="scope"
          >
            <slot
              name="message"
              v-bind="scope"
            />
          </template>
          <template
            v-if="$slots.icon"
            #icon="scope"
          >
            <slot
              name="icon"
              v-bind="scope"
            />
          </template>
          <template
            v-if="$slots.accepticon"
            #accepticon
          >
            <slot name="accepticon" />
          </template>
          <template
            v-if="$slots.rejecticon"
            #rejecticon
          >
            <slot name="rejecticon" />
          </template>
        </ConfirmBody>
      </slot>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { IconKey } from "./kit/icons"
import type {
  ConfirmContainerScope,
  ConfirmPlacement as ConfirmPlacementShape,
  ConfirmSeverity as ConfirmSeverityShape,
  ConfirmSize as ConfirmSizeShape,
} from "./confirm/types"
import type {
  PopupGeometry,
} from "./confirm/position"
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  watch,
} from "vue"
import {
  DEFAULT_ACCEPT_LABEL,
  DEFAULT_REJECT_LABEL,
} from "./confirm/types"
import {
  POPUP_ARROW_SIZE,
  resolvePopupPosition,
} from "./confirm/position"
import ConfirmBody from "./confirm/ConfirmBody.vue"
import "./kit/theme"

// 公开类型转出（沿用 Paginator / Timeline 的别名转出写法：`<script setup>` 不能直接 re-export 导入名）
export type ConfirmPlacement = ConfirmPlacementShape
export type ConfirmSeverity = ConfirmSeverityShape
export type ConfirmSize = ConfirmSizeShape

interface Props {
  /** 是否显示（受控，配合 `v-model:visible`） */
  visible: boolean
  /**
   * 锚点元素：气泡贴它定位（通常传触发按钮的 ref）。
   * 支持传函数以延迟取值（元素可能晚于组件挂载）；取不到时退化为视口居中。
   */
  target?: HTMLElement | (() => HTMLElement | null) | null
  /** 标题 */
  header?: string
  /** 消息文本，支持 `\n` 多行（默认插槽 / `message` 插槽存在时被覆盖） */
  message?: string
  /** 标题图标 */
  icon?: IconKey
  /** 确认按钮文案 */
  acceptLabel?: string
  /** 取消按钮文案 */
  rejectLabel?: string
  /** 确认按钮配色：`danger`（默认）/ `primary` */
  acceptSeverity?: ConfirmSeverity
  /** 确认按钮前置图标 */
  acceptIcon?: IconKey
  /** 取消按钮前置图标 */
  rejectIcon?: IconKey
  /** 确认按钮加载态 */
  acceptLoading?: boolean
  /** 期望方位：`auto`（默认，优先下方、放不下上翻）/ 上下 + 四角 / 左右（显式方位只钳制不翻转） */
  placement?: ConfirmPlacement
  /** 点击组件与锚点之外是否关闭 */
  dismissable?: boolean
  /** 按 Esc 是否关闭 */
  closeOnEscape?: boolean
  /** 按钮尺寸档位 */
  size?: ConfirmSize
  /** 无标题时的无障碍名称（有标题时自动关联标题） */
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  target: null,
  header: "",
  message: "",
  acceptLabel: DEFAULT_ACCEPT_LABEL,
  rejectLabel: DEFAULT_REJECT_LABEL,
  acceptSeverity: "danger",
  acceptLoading: false,
  placement: "auto",
  dismissable: true,
  closeOnEscape: true,
  size: "small",
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  "update:visible": [value: boolean]
}>()

/** 标题元素 id（`aria-labelledby` 指向它；内容段负责把 id 打在标题上） */
const titleId = `${useId()}-title`

const popupRef = ref<HTMLElement | null>(null)
/** 首帧先隐藏（visibility: hidden）等测量完成再显示，避免打开瞬间闪跳 */
const positioned = ref(false)
const geometry = ref<PopupGeometry>({
  top: 0,
  left: 0,
  placement: "bottom",
  arrowOffset: 0,
  arrowVertical: false,
})

/** 打开前的焦点元素，关闭时归还 */
let previousActive: HTMLElement | null = null
/** rAF 句柄：滚动 / 缩放期间每帧至多重算一次 */
let frame = 0

const popupStyle = computed(() => ({
  top: `${geometry.value.top}px`,
  left: `${geometry.value.left}px`,
}))

/** 三角所贴的气泡边（与方位主轴相反） */
const arrowSide = computed(() => {
  const placement = geometry.value.placement
  if (placement.startsWith("bottom")) return "top"
  if (placement.startsWith("top")) return "bottom"
  return placement === "left" ? "right" : "left"
})

/** 三角沿所在边的偏移（横向边看 `left`、纵向边看 `top`） */
const arrowStyle = computed(() => {
  const offset = geometry.value.arrowOffset - POPUP_ARROW_SIZE / 2
  return geometry.value.arrowVertical
    ? { top: `${offset}px` }
    : { left: `${offset}px` }
})

/** `container` 插槽作用域：关闭与取消同义 */
const containerScope = computed<ConfirmContainerScope>(() => ({
  header: props.header,
  message: props.message,
  icon: props.icon,
  acceptLabel: props.acceptLabel,
  rejectLabel: props.rejectLabel,
  closeCallback: handleReject,
  rejectCallback: handleReject,
  acceptCallback: handleConfirm,
}))

const resolveTarget = (): HTMLElement | null => {
  const target = props.target
  if (!target) return null
  return typeof target === "function" ? target() : target
}

/** 测量锚点与气泡尺寸后写回视口坐标（锚点缺失时退化为视口居中的等值锚点） */
const updatePosition = () => {
  const popup = popupRef.value
  if (!popup) return

  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const anchorElement = resolveTarget()
  const anchorRect = anchorElement?.getBoundingClientRect()
  const popupRect = popup.getBoundingClientRect()

  geometry.value = resolvePopupPosition({
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
    popup: { width: popupRect.width, height: popupRect.height },
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

/** 确认：不自动关闭，由调用方决定关闭时机（便于异步操作） */
function handleConfirm(): void {
  emit("confirm")
}

/** 取消 / 关闭：同时同步受控值，便于父组件直接 `v-model:visible` */
function handleReject(): void {
  emit("cancel")
  emit("update:visible", false)
}

/** 点击气泡与锚点之外关闭（用 pointerdown 覆盖鼠标与触屏） */
function handlePointerDown(event: PointerEvent): void {
  if (!props.dismissable) return
  const node = event.target as Node | null
  if (!node) return
  if (popupRef.value?.contains(node)) return
  if (resolveTarget()?.contains(node)) return
  handleReject()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !props.closeOnEscape) return
  event.preventDefault()
  handleReject()
}

const bindWindowEvents = () => {
  // capture: true —— 任意滚动容器滚动都能跟随（滚动事件不冒泡到 window）
  window.addEventListener("scroll", scheduleUpdate, true)
  window.addEventListener("resize", scheduleUpdate)
  window.addEventListener("pointerdown", handlePointerDown, true)
  window.addEventListener("keydown", handleKeydown)
}

const unbindWindowEvents = () => {
  window.removeEventListener("scroll", scheduleUpdate, true)
  window.removeEventListener("resize", scheduleUpdate)
  window.removeEventListener("pointerdown", handlePointerDown, true)
  window.removeEventListener("keydown", handleKeydown)
  if (frame) {
    cancelAnimationFrame(frame)
    frame = 0
  }
}

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      previousActive = document.activeElement as HTMLElement | null
      positioned.value = false
      bindWindowEvents()
      await nextTick()
      updatePosition()
      positioned.value = true
      // 焦点给气泡容器而非确认按钮：危险操作默认聚焦按钮会被 Enter 误触
      popupRef.value?.focus()
    } else {
      unbindWindowEvents()
      // 焦点归还锚点（拿不到锚点时退回打开前的元素）
      const anchor = resolveTarget()
      if (anchor) anchor.focus()
      else previousActive?.focus()
      previousActive = null
    }
  },
  { immediate: true },
)

// 方位变化即时重算（尺寸变化由滚动 / 缩放与重新打开覆盖）
watch(() => props.placement, scheduleUpdate)

onBeforeUnmount(unbindWindowEvents)
</script>

<style scoped lang="scss">
@use './styles/ConfirmPopup.scss';
</style>
