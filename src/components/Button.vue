<!-- 按钮组件：颜色/外观变体、四档尺寸、图标、加载与无障碍命名 -->
<template>
  <button
    ref="buttonRef"
    :type="type"
    :class="buttonClasses"
    :disabled="disabled || loading"
    :title="title"
    :aria-label="accessibleName"
    @click="handleClick"
  >
    <span
      v-if="loading"
      class="si-button__spinner"
    ></span>
    <IconWrapper
      v-if="icon"
      :name="icon"
      :size="resolvedIconSize"
      class="si-button__icon"
    />
    <span
      v-if="$slots.default"
      class="si-button__text"
    >
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import {
  computed,
  onMounted,
  ref,
  useSlots,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

/** 颜色轴（与外观轴正交；variant 的既有取值会推导出对应颜色族） */
type ButtonSeverity = "primary" | "secondary" | "success" | "info" | "warning" | "danger"
/** 既有变体取值（渲染结果保持不变，勿改语义）：danger 为描边红、ghost 为中性纯文本 */
type ButtonVariant = ButtonSeverity | "ghost"
type ButtonSize = "xsmall" | "small" | "medium" | "large"
type ButtonIconPosition = "left" | "right" | "top" | "bottom"

/** 各尺寸档位的默认图标边长（与 Button.scss 中 spinner 尺寸表一致，改动需同步两处） */
const TIER_ICON_SIZE: Record<ButtonSize, number> = {
  xsmall: 12,
  small: 14,
  medium: 16,
  large: 18,
}

interface Props {
  /** 按钮变体（既有颜色语义） */
  variant?: ButtonVariant
  /** 颜色轴：显式指定时覆盖 variant 推导出的颜色族 */
  severity?: ButtonSeverity
  /** 按钮尺寸 */
  size?: ButtonSize
  /** 图标名称 */
  icon?: IconKey
  /** 图标大小（不传时按 size 档位取默认值） */
  iconSize?: number
  /** 禁用状态 */
  disabled?: boolean
  /** 加载状态 */
  loading?: boolean
  /** 图标位置 */
  iconPosition?: ButtonIconPosition
  /** 是否为块级按钮 */
  block?: boolean
  /** 描边外观（透明底 + 彩色边框与文字） */
  outlined?: boolean
  /** 纯文本外观（透明底无边框，文字取颜色轴色值） */
  text?: boolean
  /** 圆形外观（主要配合纯图标按钮） */
  rounded?: boolean
  /** 原生 type（表单内提交需传 submit） */
  type?: "button" | "submit" | "reset"
  /** 鼠标悬停提示；纯图标按钮同时作为可访问名称 */
  title?: string
  /** 可访问名称（优先级高于 title） */
  ariaLabel?: string
}

type Emits = (e: "click", event: MouseEvent) => void

const props = withDefaults(defineProps<Props>(), {
  variant: "primary",
  size: "small",
  iconPosition: "left",
  disabled: false,
  loading: false,
  block: false,
  outlined: false,
  text: false,
  rounded: false,
  type: "button",
})

const emit = defineEmits<Emits>()

const slots = useSlots()
const buttonRef = ref<HTMLButtonElement>()

/** 无默认插槽且有图标 → 纯图标按钮 */
const isIconOnly = computed(() => !slots.default && !!props.icon)

/** 实际图标边长：显式传入优先，否则按尺寸档位查表 */
const resolvedIconSize = computed(
  () => props.iconSize ?? TIER_ICON_SIZE[props.size],
)

/** 可访问名称：显式 ariaLabel 优先；纯图标按钮回退到 title（不覆盖文字按钮的可读标签） */
const accessibleName = computed(() => {
  if (props.ariaLabel) {
    return props.ariaLabel
  }
  return isIconOnly.value ? props.title : undefined
})

const buttonClasses = computed(() => {
  const classes: (string | Record<string, boolean>)[] = [
    "si-button",
    `si-button--${props.variant}`,
    `si-button--${props.size}`,
    {
      "si-button--disabled": props.disabled || props.loading,
      "si-button--loading": props.loading,
      "si-button--icon-only": isIconOnly.value,
      "si-button--block": props.block,
      "si-button--rounded": props.rounded,
      "si-button--outlined": props.outlined,
      "si-button--text": props.text,
      "si-button--icon-right": props.iconPosition === "right",
      "si-button--icon-top": props.iconPosition === "top",
      "si-button--icon-bottom": props.iconPosition === "bottom",
    },
  ]
  if (props.severity) {
    classes.push(`si-button--severity-${props.severity}`)
  }
  return classes
})

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit("click", event)
  }
}

// 开发期提示：纯图标按钮缺少可访问名称时屏幕阅读器无法朗读（仅告警，不阻断渲染）
onMounted(() => {
  if (
    import.meta.env.DEV
    && isIconOnly.value
    && !props.title
    && !props.ariaLabel
  ) {
    console.warn(
      `[Button] 纯图标按钮缺少可访问名称，请提供 title 或 ariaLabel（icon: ${props.icon}）`,
    )
  }
})

defineExpose({
  focus: () => buttonRef.value?.focus(),
  blur: () => buttonRef.value?.blur(),
})
</script>

<style scoped lang="scss">
@use './styles/Button.scss';
</style>
