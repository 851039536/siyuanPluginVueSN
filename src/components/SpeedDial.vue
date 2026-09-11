<!-- 浮动动作按钮：主按钮按下后按指定方向与轨迹展开一组动作，支持角落悬浮定位与菜单无障碍语义 -->
<template>
  <div
    ref="rootRef"
    :class="rootClasses"
    :style="rootStyle"
    @keydown="handleKeydown"
  >
    <div
      :id="menuId"
      class="si-speeddial__list"
      role="menu"
      :aria-labelledby="triggerId"
    >
      <Button
        v-for="(action, index) in model"
        :key="action.key"
        :ref="(el) => setItemRef(el, index)"
        v-bind="resolveItemProps(action)"
        :size="size"
        :style="itemStyle(index)"
        :class="itemClass"
        rounded
        role="menuitem"
        class="si-speeddial__item"
        @focus="markActive(index)"
        @click="handleActionClick(action, $event)"
      />
    </div>
    <Button
      :id="triggerId"
      ref="triggerRef"
      v-bind="triggerProps"
      :size="size"
      :icon="currentIcon"
      :disabled="disabled"
      aria-haspopup="menu"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :aria-controls="menuId"
      rounded
      class="si-speeddial__trigger"
      @click="handleTriggerClick"
      @focus="handleTriggerFocus"
      @blur="handleTriggerBlur"
    />
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "./kit/icons"
import type {
  SpeedDialAction as SpeedDialActionShape,
  SpeedDialActionSeverity as SpeedDialActionSeverityShape,
  SpeedDialDirection as SpeedDialDirectionShape,
  SpeedDialPosition as SpeedDialPositionShape,
  SpeedDialSize as SpeedDialSizeShape,
  SpeedDialTooltipSide as SpeedDialTooltipSideShape,
  SpeedDialType as SpeedDialTypeShape,
} from "./speedDial/types"
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue"
import Button from "./Button.vue"
import { resolveActionOffset, toItemStyle } from "./speedDial/geometry"
import type { FocusableHandle } from "./speedDial/useSpeedDial"
import { useSpeedDial } from "./speedDial/useSpeedDial"
import {
  DEFAULT_RADIUS,
  DIRECTION_TOOLTIP_SIDE,
  LINEAR_ITEM_GAP,
  SIZE_BUTTON_EDGE,
} from "./speedDial/types"
import "./kit/theme"

export type SpeedDialAction = SpeedDialActionShape
export type SpeedDialActionSeverity = SpeedDialActionSeverityShape
export type SpeedDialDirection = SpeedDialDirectionShape
export type SpeedDialPosition = SpeedDialPositionShape
export type SpeedDialSize = SpeedDialSizeShape
export type SpeedDialTooltipSide = SpeedDialTooltipSideShape
export type SpeedDialType = SpeedDialTypeShape

interface Props {
  /** 动作列表 */
  model: SpeedDialAction[]
  /** 受控可见性（支持 `v-model:visible`；不传时组件亦可独立开合） */
  visible?: boolean
  /** 展开方向 */
  direction?: SpeedDialDirection
  /** 展开轨迹 */
  type?: SpeedDialType
  /** 曲线轨迹半径（px），对 linear 无效 */
  radius?: number
  /** 逐项递增延迟（ms） */
  transitionDelay?: number
  /** 组件禁用 */
  disabled?: boolean
  /** 点击组件外部是否收起 */
  hideOnClickOutside?: boolean
  /** 收起态图标 */
  showIcon?: IconKey
  /** 展开态图标（不传时复用 showIcon 并做旋转动画） */
  hideIcon?: IconKey
  /** 展开时是否旋转图标 */
  rotateAnimation?: boolean
  /** 角落定位档位 */
  position?: SpeedDialPosition
  /** 距视口边缘的距离（CSS 长度）；不传时用样式内的间距 Token */
  offset?: string
  /** 尺寸档位（同时决定轨迹几何所用按钮边长，请勿经 buttonProps.size 覆盖） */
  size?: SpeedDialSize
  /** 气泡方向；不传时按 direction 自动取反向 */
  tooltipPosition?: SpeedDialTooltipSide
  /** 主按钮透传参数（如 severity / block） */
  buttonProps?: Record<string, unknown>
  /** 动作按钮透传参数（作默认值，动作项自身字段优先） */
  actionButtonProps?: Record<string, unknown>
  /** 主按钮可访问名称 */
  ariaLabel?: string
  /** 外部标签元素 id（与 ariaLabel 二选一） */
  ariaLabelledby?: string
}

interface Emits {
  (e: "update:visible", value: boolean): void
  (e: "show"): void
  (e: "hide"): void
  (e: "select", action: SpeedDialAction, event: MouseEvent): void
  (e: "click", event: MouseEvent): void
  (e: "focus", event: FocusEvent): void
  (e: "blur", event: FocusEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  direction: "up",
  type: "linear",
  radius: DEFAULT_RADIUS,
  transitionDelay: 30,
  disabled: false,
  hideOnClickOutside: true,
  showIcon: "plus",
  rotateAnimation: true,
  position: "bottom-right",
  size: "small",
})

const emit = defineEmits<Emits>()

const rootRef = ref<HTMLElement>()
const triggerRef = ref<FocusableHandle>()
const itemRefs = ref<Array<FocusableHandle | undefined>>([])

const handleVisibleChange = (value: boolean) => {
  emit("update:visible", value)
  emit(value ? "show" : "hide")
}

const {
  isOpen,
  menuId,
  triggerId,
  close,
  toggle,
  markActive,
  handleKeydown,
} = useSpeedDial({
  rootRef,
  triggerRef,
  itemRefs,
  visible: () => props.visible,
  onVisibleChange: handleVisibleChange,
  hideOnClickOutside: () => props.hideOnClickOutside,
  disabled: () => props.disabled,
})

/** 轨迹偏移一次性算出（O(n)），模板按索引取用 */
const offsets = computed(() =>
  props.model.map((_, index) => resolveActionOffset({
    index,
    total: props.model.length,
    direction: props.direction,
    type: props.type,
    radius: props.radius,
    itemSize: SIZE_BUTTON_EDGE[props.size],
    gap: LINEAR_ITEM_GAP,
  })),
)

const currentIcon = computed(() =>
  (isOpen.value && props.hideIcon ? props.hideIcon : props.showIcon),
)

/** 未提供 hideIcon 时用同一图标旋转 45° 表达「已展开」 */
const iconRotated = computed(() =>
  isOpen.value && props.rotateAnimation && !props.hideIcon,
)

const tooltipSide = computed(() =>
  props.tooltipPosition ?? DIRECTION_TOOLTIP_SIDE[props.direction],
)

/** 思源内置气泡类（同时保留 aria-label 作无障碍名称） */
const itemClass = computed(() => `b3-tooltips b3-tooltips__${tooltipSide.value}`)

const rootClasses = computed(() => [
  "si-speeddial",
  `si-speeddial--${props.size}`,
  `si-speeddial--${props.position}`,
  {
    "si-speeddial--open": isOpen.value,
    "si-speeddial--disabled": props.disabled,
    "si-speeddial--rotate": iconRotated.value,
  },
])

/** 仅当调用方显式指定 offset 时才写入变量，默认值由样式内的间距 Token 承担 */
const rootStyle = computed(() =>
  props.offset ? { "--si-speeddial-offset": props.offset } : undefined,
)

/** 主按钮参数：不传 ariaLabel / ariaLabelledby 时不注入，避免覆盖 buttonProps 的取值 */
const triggerProps = computed(() => ({
  ...props.buttonProps,
  ...(props.ariaLabel ? { ariaLabel: props.ariaLabel } : {}),
  ...(props.ariaLabelledby ? { "aria-labelledby": props.ariaLabelledby } : {}),
}))

/** 动作按钮参数：actionButtonProps 作默认值，动作项自身字段优先 */
const resolveItemProps = (action: SpeedDialAction) => {
  const {
    disabled: defaultDisabled,
    ...rest
  } = props.actionButtonProps ?? {}
  return {
    ...rest,
    icon: action.icon,
    disabled: action.disabled ?? Boolean(defaultDisabled),
    ariaLabel: action.label,
    ...(action.severity ? { severity: action.severity } : {}),
  }
}

const itemStyle = (index: number) =>
  toItemStyle(offsets.value[index] ?? { x: 0, y: 0 }, index, props.transitionDelay)

const setItemRef = (el: unknown, index: number) => {
  itemRefs.value[index] = (el ?? undefined) as FocusableHandle | undefined
}

const handleTriggerClick = (event: MouseEvent) => {
  emit("click", event)
  // 键盘触发的 click 其 detail 为 0：只有键盘操作才把焦点移入首项，鼠标点击不抢焦点
  toggle(event.detail === 0)
}

const handleActionClick = (action: SpeedDialAction, event: MouseEvent) => {
  action.onClick?.(action, event)
  emit("select", action, event)
  close(false)
}

const handleTriggerFocus = (event: FocusEvent) => emit("focus", event)

const handleTriggerBlur = (event: FocusEvent) => emit("blur", event)

// 动作列表缩短时清理多余句柄，避免方向键环绕用到失效引用
watch(() => props.model.length, (length) => {
  itemRefs.value = itemRefs.value.slice(0, length)
})

// 开发期提示：可访问名称与空列表（仅告警，不阻断渲染）
onMounted(() => {
  if (!import.meta.env.DEV) {
    return
  }
  if (!props.ariaLabel && !props.ariaLabelledby) {
    console.warn("[SpeedDial] 主按钮缺少可访问名称，请提供 ariaLabel 或 ariaLabelledby")
  }
  if (!props.model.length) {
    console.warn("[SpeedDial] model 为空，展开后没有任何动作")
  }
})

defineExpose({
  isOpen,
  close: () => close(false),
  toggle: () => toggle(false),
})
</script>

<style scoped lang="scss">
@use './styles/SpeedDial.scss';
</style>
