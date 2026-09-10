<!-- 复选框：二元勾选 / 数组分组多选 / 半选态 / 四档尺寸与描边实底变体 -->
<template>
  <div :class="checkboxClasses">
    <FormField
      :hint="hint"
      :error="error"
      :size="size"
    >
      <label
        class="si-checkbox__control"
        :class="{ 'si-checkbox__control--label-before': labelBefore }"
      >
        <input
          ref="inputRef"
          class="si-checkbox__input"
          type="checkbox"
          :id="inputId"
          :name="name"
          :form="form"
          :checked="checked"
          :disabled="disabled"
          :required="required"
          :autofocus="autofocus"
          :aria-label="ariaLabel"
          :aria-labelledby="ariaLabelledby"
          :aria-checked="ariaChecked"
          :aria-readonly="readonly ? 'true' : undefined"
          @change="handleChange"
          @click="handleClick"
          @keydown.space="handleSpace"
          @focus="emit('focus', $event)"
          @blur="emit('blur', $event)"
        />
        <!-- 可视方框：纯展示层，真实交互由上方视觉隐藏的原生 input 承载 -->
        <span class="si-checkbox__box">
          <span class="si-checkbox__indicator">
            <slot
              name="icon"
              :checked="checked"
              :indeterminate="indeterminate"
            >
              <IconWrapper
                v-if="indeterminate"
                :name="'minus' as IconKey"
                :size="iconSize"
              />
              <IconWrapper
                v-else-if="checked"
                :name="'check' as IconKey"
                :size="iconSize"
              />
            </slot>
          </span>
        </span>
        <span
          v-if="label || $slots.default"
          class="si-checkbox__label"
        >
          <slot>{{ label }}</slot>
        </span>
      </label>
    </FormField>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue"
import FormField from "@/components/FormField.vue"
import IconWrapper from "@/components/IconWrapper.vue"

type CheckboxSize = "xsmall" | "small" | "medium" | "large"
type CheckboxVariant = "outlined" | "filled"

/** 尺寸档位 → 指示器图标像素尺寸（与 Button 的档位图标约定一致） */
const TIER_ICON_SIZE: Record<CheckboxSize, number> = {
  xsmall: 10,
  small: 12,
  medium: 14,
  large: 16,
}

interface Props {
  /** 二元模式为布尔值；分组模式为数组 */
  modelValue?: boolean | any[]
  /** 分组模式下本项代表的值 */
  value?: any
  /** 二元模式选中时写入的值 */
  trueValue?: any
  /** 二元模式取消选中时写入的值 */
  falseValue?: any
  /** 强制二元模式（不传时：modelValue 为数组即分组模式，否则二元模式） */
  binary?: boolean
  /** 半选态（受控；点击后由父级负责清除） */
  indeterminate?: boolean
  /** 尺寸档位 */
  size?: CheckboxSize
  /** 视觉变体：描边（默认）/ 实底 */
  variant?: CheckboxVariant
  /** 行内可点击标签文案 */
  label?: string
  /** 辅助说明（error 优先显示） */
  hint?: string
  /** 校验失败文案（同时描红方框） */
  error?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否只读（可聚焦但不可修改） */
  readonly?: boolean
  /** 是否必填（原生表单校验） */
  required?: boolean
  /** 原生 input 的 name */
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
  /** 标签置于方框左侧 */
  labelBefore?: boolean
}

interface Emits {
  (e: "update:modelValue", value: boolean | any[]): void
  (e: "change", value: boolean | any[], event: Event): void
  (e: "focus", event: FocusEvent): void
  (e: "blur", event: FocusEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  value: undefined,
  trueValue: true,
  falseValue: false,
  binary: false,
  indeterminate: false,
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

/** 数组绑定即分组模式（binary 可强制回到二元模式） */
const isGroup = computed(() => !props.binary && Array.isArray(props.modelValue))

const checked = computed(() => {
  if (isGroup.value) {
    return (props.modelValue as any[]).indexOf(props.value) > -1
  }
  return props.modelValue === props.trueValue
})

const iconSize = computed(() => TIER_ICON_SIZE[props.size])

/** 半选态无对应 HTML 属性，需经 aria 显式标记 */
const ariaChecked = computed(() => props.indeterminate ? "mixed" : undefined)

const checkboxClasses = computed(() => [
  "si-checkbox",
  `si-checkbox--${props.size}`,
  `si-checkbox--${props.variant}`,
  {
    "si-checkbox--checked": checked.value,
    "si-checkbox--indeterminate": props.indeterminate,
    "si-checkbox--disabled": props.disabled,
    "si-checkbox--readonly": props.readonly,
    "si-checkbox--error": !!props.error,
  },
])

/** 把受控状态同步回原生 input（indeterminate 只能写 DOM 属性，且父级忽略更新时需回滚视觉） */
const syncNativeState = () => {
  const el = inputRef.value
  if (!el) {
    return
  }
  el.checked = checked.value
  el.indeterminate = props.indeterminate
}

const handleChange = (event: Event) => {
  if (props.disabled || props.readonly) {
    return
  }

  if (isGroup.value) {
    const list = Array.isArray(props.modelValue) ? props.modelValue : []
    const nextList = checked.value
      ? list.filter((item) => item !== props.value)
      : [...list, props.value]
    emit("update:modelValue", nextList)
    emit("change", nextList, event)
  } else {
    const nextValue = checked.value ? props.falseValue : props.trueValue
    emit("update:modelValue", nextValue)
    emit("change", nextValue, event)
  }

  nextTick(syncNativeState)
}

/** 只读态：阻止原生点击切换（disabled 由原生 disabled 属性处理） */
const handleClick = (event: MouseEvent) => {
  if (props.readonly) {
    event.preventDefault()
  }
}

const handleSpace = (event: KeyboardEvent) => {
  if (props.readonly) {
    event.preventDefault()
  }
}

watch(
  () => props.indeterminate,
  () => syncNativeState(),
  { flush: "post" },
)

onMounted(() => syncNativeState())

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  inputElement: computed(() => inputRef.value),
})
</script>

<style scoped lang="scss">
@use './styles/Checkbox.scss';
</style>
