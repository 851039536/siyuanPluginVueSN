<template>
  <div
    :class="tagClasses"
    :style="tagStyle"
  >
    <IconWrapper
      v-if="icon"
      :name="icon"
      :size="iconSize"
      class="si-tag__icon"
    />
    <span
      v-if="$slots.default || content !== undefined"
      class="si-tag__content"
    >
      <slot>{{ displayContent }}</slot>
    </span>
    <button
      v-if="closable"
      type="button"
      class="si-tag__close"
      @click="handleClose"
    >
      <IconWrapper
        name="close"
        :size="closeIconSize"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "./kit/icons"
import { computed } from "vue"
import IconWrapper from "./IconWrapper.vue"
import "./kit/theme"

type TagSize = "xsmall" | "small" | "medium" | "large"
/**
 * 颜色轴。取值同时容纳库内既有命名与 PrimeVue 官方 Badge 的 severity 命名：
 * - 库内既有：`default` / `primary` / `success` / `warning` / `danger` / `info`
 * - 官方 Badge：`secondary` / `info` / `success` / `warn` / `danger` / `contrast`
 * 取两组取值的并集（`warning` 与 `warn`、`default` 与 `secondary` 为同义别名，样式层合并映射）。
 */
type TagVariant =
  | "default"
  | "secondary"
  | "primary"
  | "success"
  | "warning"
  | "warn"
  | "danger"
  | "error"
  | "info"
  | "contrast"
type TagShape = "rounded" | "square" | "circle"

interface Props {
  /** 标签尺寸 */
  size?: TagSize
  /** 标签变体 */
  variant?: TagVariant
  /** 标签形状；`circle` 为圆形徽标（宜放纯数字或单字，内容过长会被裁） */
  shape?: TagShape
  /** 图标名称 */
  icon?: IconKey
  /** 图标大小 */
  iconSize?: number
  /** 是否可关闭 */
  closable?: boolean
  /** 关闭按钮图标大小 */
  closeIconSize?: number
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义背景色 */
  color?: string
  /** 自定义文本色 */
  textColor?: string
  /** 自定义边框色 */
  borderColor?: string
  /**
   * 实底外观：以「变体色 100% 铺底 + 反差文字」渲染，替代默认的「10% 浅底 + 100% 文字 + 20% 描边」。
   * 对齐 PrimeVue Badge 的默认实底观感（其 Badge 无描边、直接色块铺底），适用于需要强对比的计数 / 状态徽标。
   * 与 `color` / `textColor` 自定义色同用时以后者为准。
   */
  fill?: boolean
  /**
   * 纯文本内容便捷入口（对齐官方 Badge 的 `value`）：不传默认插槽时直接渲染该值。
   * 数字会按 `max` 折叠为 `${max}+`（对齐本库 `Badge` 的 `max` 语义）。
   */
  content?: string | number
  /** 数值上限：`content` 为数字且超过它时显示 `${max}+`（仅对 `content` 生效） */
  max?: number
}

interface Emits {
  (e: "close"): void
  (e: "click", event: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  size: "small",
  variant: "default",
  shape: "rounded",
  iconSize: 12,
  closeIconSize: 10,
  closable: false,
  disabled: false,
  fill: false,
  max: 99,
})

const emit = defineEmits<Emits>()

const tagClasses = computed(() => [
  "si-tag",
  `si-tag--${props.size}`,
  `si-tag--${props.variant}`,
  `si-tag--${props.shape}`,
  {
    "si-tag--closable": props.closable,
    "si-tag--disabled": props.disabled,
    "si-tag--has-icon": !!props.icon,
    "si-tag--custom-color": !!props.color,
    "si-tag--fill": props.fill,
  },
])

const tagStyle = computed(() => {
  const style: Record<string, string> = {}

  if (props.color) {
    style.backgroundColor = props.color
  }

  if (props.textColor) {
    style.color = props.textColor
  }

  if (props.borderColor) {
    style.borderColor = props.borderColor
  }

  return style
})

/** 内容展示值：数字超过 `max` 时折叠为 `${max}+`（`max <= 0` 视为不折叠） */
const displayContent = computed(() => {
  const value = props.content
  if (typeof value === "number" && props.max > 0 && value > props.max) {
    return `${props.max}+`
  }
  return value
})

const handleClose = (event: MouseEvent) => {
  event.stopPropagation()
  if (!props.disabled) {
    emit("close")
  }
}
</script>

<style scoped lang="scss">
@use './styles/Tag.scss';
</style>
