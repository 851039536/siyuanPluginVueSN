<template>
  <div
    :class="tagClasses"
    :style="tagStyle"
  >
    <!--
      头像位（对齐 PrimeVue Chip 的 image）：图片加载失败时回退到 icon，
      避免出现破图占位 —— 与 Avatar 的 hasError 回退同一思路。
    -->
    <img
      v-if="image && !imageFailed"
      :src="image"
      :alt="imageAlt"
      class="si-tag__image"
      @error="imageFailed = true"
    >
    <IconWrapper
      v-else-if="icon"
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
      :aria-label="closeLabel"
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
import { computed, ref } from "vue"
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
  /**
   * 头像图片地址（对齐 PrimeVue Chip 的 `image`）：渲染在标签最左侧的圆形头像，典型用于人员 / 主体标签。
   * 与 `icon` 互斥 —— **同时传时 `image` 优先**；图片加载失败时自动回退到 `icon`（无 icon 则只剩文本）。
   */
  image?: string
  /** 头像的替代文本（`alt`）：不传时取 `content` 的文本形式，仍为空则用空串（装饰性图片，交由读屏跳过） */
  imageAlt?: string
  /** 是否可关闭 */
  closable?: boolean
  /** 关闭按钮的可访问名称（可覆盖为调用方 i18n 文案） */
  closeLabel?: string
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
  closeLabel: "关闭",
})

const emit = defineEmits<Emits>()

/** 头像加载失败标记：置位后回退到 icon / 文本，避免破图（同 Avatar 的 hasError 思路） */
const imageFailed = ref(false)

/** 头像是否生效（传了 image 且未加载失败）：生效时图标位让给头像，两者互斥 */
const hasImage = computed(() => !!props.image && !imageFailed.value)

/** 头像替代文本：显式传入优先，否则取 content 的文本形式（无 content 时为空串 = 装饰性图片） */
const imageAlt = computed(() => {
  if (props.imageAlt !== undefined) return props.imageAlt
  const value = props.content
  return value === undefined ? "" : String(value)
})

const tagClasses = computed(() => [
  "si-tag",
  `si-tag--${props.size}`,
  `si-tag--${props.variant}`,
  `si-tag--${props.shape}`,
  {
    "si-tag--closable": props.closable,
    "si-tag--disabled": props.disabled,
    // 头像优先于图标（两者同时传时只渲染头像）⇒ has-icon 在头像生效时置否，避免样式按图标位调整
    "si-tag--has-icon": !!props.icon && !hasImage.value,
    "si-tag--has-image": hasImage.value,
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
