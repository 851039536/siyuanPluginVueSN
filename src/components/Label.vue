<!-- 表单标签：包裹控件建立隐式关联（wrapper）、标签/容器/邻近控件三入口禁用联动、必填标记附无障碍替代文本。
     禁用联动已知覆盖范围：仅「禁用态就在根元素上」的成员（Switch 的原生 button[disabled]、原生 input）可被邻近兜底自动命中；
     Input / Select / DatePicker 的禁用态加在内部元素上，需由包装层显式标记 data-disabled。 -->
<template>
  <component
    :is="tag"
    :class="labelClasses"
    :for="forAttr"
    :style="labelStyle"
    :aria-disabled="disabled ? 'true' : undefined"
  >
    <IconWrapper
      v-if="icon && iconPosition === 'left'"
      :name="icon"
      :size="iconSize"
      class="si-label__icon"
    />
    <!-- 包裹模式：插槽内容直出，避免控件被文本层包裹（宽度挤压 + 文本样式串染） -->
    <slot v-if="wrapper" />
    <span
      v-else-if="$slots.default"
      class="si-label__text"
    >
      <slot />
    </span>
    <IconWrapper
      v-if="icon && iconPosition === 'right'"
      :name="icon"
      :size="iconSize"
      class="si-label__icon"
    />
    <span
      v-if="required"
      class="si-label__required"
      aria-hidden="true"
    >*</span>
    <!-- 必填的无障碍替代文本：视觉隐藏，仅屏幕阅读器播报（控件侧仍需自行声明 required / aria-required） -->
    <span
      v-if="required && requiredText"
      class="si-label__required-text"
    >{{ requiredText }}</span>
  </component>
</template>

<script setup lang="ts">
import type { IconKey } from "./kit/icons"
import { computed } from "vue"
import IconWrapper from "./IconWrapper.vue"
import "./kit/theme"

type LabelSize = "xsmall" | "small" | "medium" | "large"
type LabelVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
type LabelState = "default" | "error" | "success" | "warning"

interface Props {
  /** 是否必填 */
  required?: boolean
  /** 标签尺寸 */
  size?: LabelSize
  /** 标签变体（用于独立展示） */
  variant?: LabelVariant
  /** 状态 */
  state?: LabelState
  /** 图标名称 */
  icon?: IconKey
  /** 图标大小 */
  iconSize?: number
  /** 图标位置 */
  iconPosition?: "left" | "right"
  /** HTML 标签类型 */
  tag?: "label" | "span" | "div"
  /** 关联的表单元素 id（仅当 tag="label" 时有效） */
  for?: string
  /** 是否禁用（也可由容器 data-disabled 或邻近被禁用控件触发，见组件头注释） */
  disabled?: boolean
  /** 自定义宽度 */
  width?: string | number
  /** 文本对齐（标签设有固定宽度时可见效果） */
  align?: "left" | "center" | "right"
  /** 包裹模式：插槽内容直出（不包文本层），用于把控件包进标签建立原生隐式关联，建议配合 tag="label" */
  wrapper?: boolean
  /** 必填的无障碍替代文本（视觉隐藏，仅供屏幕阅读器；控件侧仍需自行声明 required / aria-required） */
  requiredText?: string
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  size: "small",
  variant: "default",
  state: "default",
  iconPosition: "left",
  tag: "label",
  disabled: false,
  align: "left",
  wrapper: false,
})

const labelClasses = computed(() => [
  "si-label",
  `si-label--${props.size}`,
  `si-label--${props.state}`,
  `si-label--align-${props.align}`,
  {
    "si-label--required": props.required,
    "si-label--disabled": props.disabled,
    "si-label--has-icon": !!props.icon,
    "si-label--inline": props.tag !== "label",
    "si-label--wrapper": props.wrapper,
  },
])

const labelStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.width) {
    style.width =
      typeof props.width === "number" ? `${props.width}px` : props.width
  }
  return style
})

const forAttr = computed(() => (props.tag === "label" ? props.for : undefined))
</script>

<style scoped lang="scss">
@use './styles/Label.scss';
</style>
