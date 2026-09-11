<!-- 单选框：单选组 / 二值模式 / 四档尺寸与描边实底变体 / 禁用只读 / 校验态 -->
<template>
  <div :class="radioClasses">
    <FormField
      :hint="hint"
      :error="error"
      :size="size"
    >
      <label
        class="si-radiobutton__control"
        :class="{ 'si-radiobutton__control--label-before': labelBefore }"
      >
        <input
          ref="inputRef"
          class="si-radiobutton__input"
          type="radio"
          :id="inputId"
          :name="name"
          :form="form"
          :value="binary ? undefined : stringValue"
          :checked="checked"
          :disabled="disabled"
          :required="required"
          :autofocus="autofocus"
          :aria-label="ariaLabel"
          :aria-labelledby="ariaLabelledby"
          :aria-readonly="readonly ? 'true' : undefined"
          @change="handleChange"
          @click="handleClick"
          @keydown="handleKeydown"
          @focus="emit('focus', $event)"
          @blur="emit('blur', $event)"
        />
        <!-- 可视圆框：纯展示层，真实交互由上方视觉隐藏的原生 input 承载 -->
        <span class="si-radiobutton__box">
          <span class="si-radiobutton__dot"></span>
        </span>
        <span
          v-if="label || $slots.default"
          class="si-radiobutton__label"
        >
          <slot>{{ label }}</slot>
        </span>
      </label>
    </FormField>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
} from "vue"
import FormField from "./FormField.vue"
import "./kit/theme"

type RadioButtonSize = "xsmall" | "small" | "medium" | "large"
type RadioButtonVariant = "outlined" | "filled"

interface Props {
  /** 单选组模式：当前选中项的值；二值模式：布尔值 */
  modelValue?: any
  /** 本项代表的值（二值模式下不要传） */
  value?: any
  /** 二值模式：modelValue 直接作为选中值，无需 value */
  binary?: boolean
  /** 尺寸档位 */
  size?: RadioButtonSize
  /** 视觉变体：描边（默认）/ 实底 */
  variant?: RadioButtonVariant
  /** 行内可点击标签文案 */
  label?: string
  /** 辅助说明（error 优先显示） */
  hint?: string
  /** 校验失败文案（同时描红圆框） */
  error?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否只读（可聚焦但不可修改） */
  readonly?: boolean
  /** 是否必填（原生表单校验） */
  required?: boolean
  /** 同一单选组的原生 name（同组必须一致，否则方向键与 ARIA 语义失效） */
  name?: string
  /** 原生 input 所属的表单 id */
  form?: string
  /** 原生 input 的 id，供外部 <label for> 关联 */
  inputId?: string
  /** 无障碍名称 */
  ariaLabel?: string
  /** 无障碍名称来源元素 id */
  ariaLabelledby?: string
  /** 是否自动聚焦 */
  autofocus?: boolean
  /** 标签置于圆框左侧 */
  labelBefore?: boolean
}

interface Emits {
  (e: "update:modelValue", value: any): void
  (e: "change", value: any, event: Event): void
  (e: "focus", event: FocusEvent): void
  (e: "blur", event: FocusEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  value: undefined,
  binary: false,
  size: "small",
  variant: "outlined",
  disabled: false,
  readonly: false,
  required: false,
  autofocus: false,
  labelBefore: false,
})

const emit = defineEmits<Emits>()

const inputRef = ref<HTMLInputElement>()

/** 原生 input 的 value 只接受字符串/数字；对象等复杂值不落到 DOM（分组由受控 v-model 表达） */
const stringValue = computed(() => (
  typeof props.value === "string" || typeof props.value === "number"
    ? props.value
    : undefined
))

/** 二值模式直接比对布尔值，否则与组内共享的选中值比对 */
const checked = computed(() => (
  props.binary ? !!props.modelValue : props.modelValue === props.value
))

const radioClasses = computed(() => [
  "si-radiobutton",
  `si-radiobutton--${props.size}`,
  `si-radiobutton--${props.variant}`,
  {
    "si-radiobutton--checked": checked.value,
    "si-radiobutton--disabled": props.disabled,
    "si-radiobutton--readonly": props.readonly,
    "si-radiobutton--error": !!props.error,
  },
])

/** 把受控状态同步回原生 input（父级忽略更新时需回滚视觉，避免与真实值漂移） */
const syncNativeState = () => {
  const el = inputRef.value
  if (!el) {
    return
  }
  el.checked = checked.value
}

const handleChange = (event: Event) => {
  if (props.disabled || props.readonly) {
    return
  }

  // 单选项只能切到自己，无法取消（与复选框的核心差异）
  const nextValue = props.binary ? true : props.value
  emit("update:modelValue", nextValue)
  emit("change", nextValue, event)

  nextTick(syncNativeState)
}

/** 只读态：阻止原生点击切换（disabled 由原生 disabled 属性处理） */
const handleClick = (event: MouseEvent) => {
  if (props.readonly) {
    event.preventDefault()
  }
}

/** 只读态：Space 与方向键都会触发原生改选，需一并拦截（方向键还会连带移动组内焦点） */
const READONLY_BLOCKED_KEYS = [" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]

const handleKeydown = (event: KeyboardEvent) => {
  if (props.readonly && READONLY_BLOCKED_KEYS.includes(event.key)) {
    event.preventDefault()
  }
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  inputElement: computed(() => inputRef.value),
})
</script>

<style scoped lang="scss">
@use './styles/RadioButton.scss';
</style>
