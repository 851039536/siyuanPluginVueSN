<template>
  <div
    :class="cardClasses"
    :style="cardStyle"
    v-bind="containerAttrs"
    @click="handleClick"
  >
    <div
      v-if="$slots.header || title"
      class="si-card__header"
    >
      <div class="si-card__header-content">
        <slot name="header">
          <h3
            v-if="title"
            class="si-card__title"
          >
            {{ title }}
          </h3>
          <p
            v-if="subtitle"
            class="si-card__subtitle"
          >
            {{ subtitle }}
          </p>
        </slot>
      </div>
      <div
        v-if="$slots['header-extra']"
        class="si-card__header-extra"
      >
        <slot name="header-extra" />
      </div>
    </div>

    <div
      v-if="$slots.cover || cover"
      class="si-card__cover"
    >
      <img
        v-if="cover"
        :src="cover"
        :alt="coverAlt"
        class="si-card__cover-image"
        :class="{ 'si-card__cover-image--cover': coverFit === 'cover' }"
      />
      <slot name="cover" />
    </div>

    <div
      class="si-card__body"
      :class="{ 'si-card__body--no-padding': bodyNoPadding }"
    >
      <slot />
    </div>

    <div
      v-if="$slots.footer"
      class="si-card__footer"
    >
      <slot name="footer" />
    </div>

    <div
      v-if="loading"
      class="si-card__loading-overlay"
    >
      <div class="si-card__loading-spinner" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  useAttrs,
  useSlots,
} from "vue"

type CardVariant = "bordered" | "elevated" | "flat" | "outlined"
type CardSize = "xsmall" | "small" | "medium" | "large"

interface Props {
  /** 卡片标题 */
  title?: string
  /** 卡片副标题 */
  subtitle?: string
  /** 封面图片 */
  cover?: string
  /** 封面图片 alt */
  coverAlt?: string
  /** 封面适配方式 */
  coverFit?: "contain" | "cover" | "fill"
  /** 卡片变体 */
  variant?: CardVariant
  /** 卡片尺寸 */
  size?: CardSize
  /** 是否可点击 */
  clickable?: boolean
  /** 激活状态 */
  active?: boolean
  /** 禁用状态 */
  disabled?: boolean
  /** 加载状态 */
  loading?: boolean
  /** 是否圆角 */
  rounded?: boolean
  /** 主体内容是否无内边距 */
  bodyNoPadding?: boolean
  /** 宽度 */
  width?: string | number
  /** 高度 */
  height?: string | number
}

type Emits = (e: "click", event: MouseEvent) => void

const props = withDefaults(defineProps<Props>(), {
  variant: "bordered",
  size: "small",
  coverFit: "cover",
  clickable: false,
  active: false,
  disabled: false,
  loading: false,
  rounded: true,
  bodyNoPadding: false,
})

const emit = defineEmits<Emits>()
const attrs = useAttrs()
const slots = useSlots()

const containerAttrs = computed(() => {
  const {
    class: className,
    style,
    ...rest
  } = attrs
  return rest
})

const cardClasses = computed(() => [
  "si-card",
  `si-card--${props.variant}`,
  `si-card--${props.size}`,
  {
    "si-card--clickable": props.clickable && !props.disabled,
    "si-card--active": props.active,
    "si-card--disabled": props.disabled,
    "si-card--loading": props.loading,
    "si-card--rounded": props.rounded,
    "si-card--has-cover": props.cover || slots.cover,
  },
])

const cardStyle = computed(() => {
  const style: Record<string, string | number> = {}
  if (props.width) {
    style.width =
      typeof props.width === "number" ? `${props.width}px` : props.width
  }
  if (props.height) {
    style.height =
      typeof props.height === "number" ? `${props.height}px` : props.height
  }
  return style
})

const handleClick = (event: MouseEvent) => {
  if (props.clickable && !props.disabled && !props.loading) {
    emit("click", event)
  }
}
</script>

<style scoped lang="scss">
@use './styles/Card.scss';
</style>
