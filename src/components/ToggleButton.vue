<!-- 按钮式布尔开关：按下态切换文案与图标 / 四档尺寸 / 禁用与校验态 -->
<!-- 无障碍：可访问名称应不随状态变化 —— 文案或图标随状态切换时必须传 ariaLabel / ariaLabelledby / title -->
<template>
  <div :class="toggleClasses">
    <FormField
      :hint="hint"
      :error="error"
      :size="size"
    >
      <!-- 有文案时走插槽分支；无文案时不传插槽，让 Button 退化为方形纯图标按钮 -->
      <Button
        v-if="currentLabel"
        ref="buttonRef"
        v-bind="buttonProps"
        @click="handleClick"
      >
        {{ currentLabel }}
      </Button>
      <Button
        v-else
        ref="buttonRef"
        v-bind="buttonProps"
        @click="handleClick"
      />
    </FormField>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "./kit/icons"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import Button from "./Button.vue"
import FormField from "./FormField.vue"
import "./kit/theme"

type ToggleButtonSize = "xsmall" | "small" | "medium" | "large"
type ToggleButtonSeverity = "primary" | "danger"

interface Props {
  /** 是否处于按下（开启）状态 */
  modelValue?: boolean
  /** 尺寸档位 */
  size?: ToggleButtonSize
  /** 按下时显示的文案（不传则只渲染图标） */
  onLabel?: string
  /** 未按下时显示的文案（不传则只渲染图标） */
  offLabel?: string
  /** 按下时显示的图标 */
  onIcon?: IconKey
  /** 未按下时显示的图标 */
  offIcon?: IconKey
  /** 禁用状态 */
  disabled?: boolean
  /** 是否占满容器宽度 */
  fluid?: boolean
  /** 提示文本 */
  hint?: string
  /** 错误文本（同时切换 danger 配色与 aria-invalid） */
  error?: string
  /** 原生 name（用于表单提交） */
  name?: string
  /** 原生 type */
  type?: "button" | "submit" | "reset"
  /** 焦点顺序（透传到内部按钮） */
  tabindex?: string | number
  /** 鼠标悬停提示；纯图标时同时作为可访问名称 */
  title?: string
  /** 不随状态变化的可访问名称（优先级高于 title） */
  ariaLabel?: string
  /** 外部标签元素 id（与 ariaLabel 二选一即可） */
  ariaLabelledby?: string
}

interface Emits {
  (e: "update:modelValue", value: boolean): void
  (e: "change", value: boolean): void
  (e: "click", event: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  size: "small",
  disabled: false,
  fluid: false,
  type: "button",
})

const emit = defineEmits<Emits>()

/** 内部 Button 对外暴露能力的结构化子集（仅需转发 focus / blur，不依赖组件实例类型推导） */
interface ButtonHandle {
  focus: () => void
  blur: () => void
}

const buttonRef = ref<ButtonHandle>()

const pressed = computed(() => !!props.modelValue)

const hasError = computed(() => !!props.error)

/** 当前状态对应的文案（未提供时为空串 → 模板切到纯图标分支） */
const currentLabel = computed(() => (pressed.value ? props.onLabel : props.offLabel) ?? "")

/** 当前状态对应的图标 */
const currentIcon = computed(() => (pressed.value ? props.onIcon : props.offIcon))

/**
 * 配色轴：
 * - 未按下（无错误）不传 severity → 叠加 outlined 后取中性描边与中性文字
 * - 按下 → severity="primary" 的填充外观
 * - 有错误 → severity="danger" 覆盖（未按下仍是红描边、按下为红实底）
 */
const severity = computed<ToggleButtonSeverity | undefined>(() => {
  if (hasError.value) {
    return "danger"
  }
  return pressed.value ? "primary" : undefined
})

/** 透传给 Button 的全部参数（两个分支共用，避免重复书写） */
const buttonProps = computed(() => ({
  variant: "ghost" as const,
  severity: severity.value,
  outlined: !pressed.value,
  size: props.size,
  icon: currentIcon.value,
  disabled: props.disabled,
  block: props.fluid,
  type: props.type,
  tabindex: props.tabindex,
  title: props.title,
  ariaLabel: props.ariaLabel,
  // 以下键 Button 未声明为 props，经 attr fallthrough 落到原生 <button> 上
  "aria-labelledby": props.ariaLabelledby,
  "aria-pressed": pressed.value,
  "aria-invalid": hasError.value ? "true" : undefined,
  name: props.name,
}))

const toggleClasses = computed(() => [
  "si-togglebutton",
  {
    "si-togglebutton--fluid": props.fluid,
  },
])

const handleClick = (event: MouseEvent) => {
  if (props.disabled) {
    return
  }
  const next = !pressed.value
  emit("update:modelValue", next)
  emit("change", next)
  emit("click", event)
}

// 开发期提示：内容缺失与可访问名称（仅告警，不阻断渲染）
onMounted(() => {
  if (!import.meta.env.DEV) {
    return
  }
  if (!currentLabel.value && !currentIcon.value) {
    console.warn("[ToggleButton] 未提供 onLabel/offLabel 与 onIcon/offIcon，按钮将渲染为空内容")
  }
  const contentChanges = props.onLabel !== props.offLabel || props.onIcon !== props.offIcon
  const hasStableName = !!(props.ariaLabel || props.ariaLabelledby || props.title)
  if (contentChanges && !hasStableName) {
    console.warn(
      "[ToggleButton] 可见文案/图标随状态切换时，请提供 ariaLabel / ariaLabelledby / title 作为不随状态变化的可访问名称",
    )
  }
})

defineExpose({
  focus: () => buttonRef.value?.focus(),
  blur: () => buttonRef.value?.blur(),
})
</script>

<style scoped lang="scss">
@use './styles/ToggleButton.scss';
</style>
