<template>
  <div
    :class="inputClasses"
    v-bind="containerAttrs"
  >
    <label
      v-if="label"
      class="si-input__label"
    >
      {{ label }}
      <span
        v-if="required"
        class="si-input__required"
      >*</span>
    </label>
    <div class="si-input__wrapper">
      <IconWrapper
        v-if="prefixIcon"
        :name="prefixIcon"
        :size="iconSize"
        class="si-input__icon si-input__icon--prefix"
      />
      <component
        :is="isTextarea ? 'textarea' : 'input'"
        ref="inputRef"
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :maxlength="maxlength"
        :minlength="minlength"
        :autocomplete="autocomplete"
        :pattern="pattern"
        :name="name"
        :form="form"
        class="si-input__field"
        :class="{
          'si-input__field--with-prefix': prefixIcon,
          'si-input__field--with-suffix': suffixIcon,
          'si-input__field--error': error,
          'si-input__field--textarea': isTextarea,
        }"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
        @keydown="handleKeydown"
        @change="handleChange"
      />
      <IconWrapper
        v-if="suffixIcon"
        :name="suffixIcon"
        :size="iconSize"
        class="si-input__icon si-input__icon--suffix"
      />
      <span
        v-if="clearable && modelValue && !disabled && !readonly"
        class="si-input__clear"
        @click="handleClear"
      >
        <IconWrapper
          :name="'x' as IconKey"
          :size="iconSize"
        />
      </span>
      <span
        v-if="showPassword && type === 'password' && !disabled && !readonly"
        class="si-input__password-toggle"
        @click="togglePasswordVisibility"
      >
        <IconWrapper
          :name="(passwordVisible ? 'eyeOff' : 'eye') as IconKey"
          :size="iconSize"
        />
      </span>
    </div>
    <div
      v-if="hint || error"
      class="si-input__hint"
      :class="{ 'si-input__hint--error': error }"
    >
      {{ error || hint }}
    </div>
    <div
      v-if="showCount && (type === 'text' || type === 'textarea') && maxlength"
      class="si-input__count"
    >
      {{ currentLength }} / {{ maxlength }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import {
  computed,
  nextTick,
  ref,
  useAttrs,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

type InputType =
  | "text"
  | "password"
  | "email"
  | "number"
  | "tel"
  | "url"
  | "search"
  | "textarea"
type InputSize = "small" | "medium" | "large"

interface Props {
  /** 绑定值 */
  modelValue?: string | number | null
  /** 输入框类型 */
  type?: InputType
  /** 尺寸 */
  size?: InputSize
  /** 占位文本 */
  placeholder?: string
  /** 禁用状态 */
  disabled?: boolean
  /** 只读状态 */
  readonly?: boolean
  /** 标签文本 */
  label?: string
  /** 是否必填 */
  required?: boolean
  /** 提示文本 */
  hint?: string
  /** 错误文本 */
  error?: string
  /** 前缀图标 */
  prefixIcon?: IconKey
  /** 后缀图标 */
  suffixIcon?: IconKey
  /** 图标大小 */
  iconSize?: number
  /** 最大长度 */
  maxlength?: number
  /** 最小长度 */
  minlength?: number
  /** 自动完成 */
  autocomplete?: string
  /** 正则验证模式 */
  pattern?: string
  /** 是否可清空（显示清除按钮） */
  clearable?: boolean
  /** 是否显示密码切换 */
  showPassword?: boolean
  /** 是否显示字符计数 */
  showCount?: boolean
  /** 是否自动获得焦点 */
  autofocus?: boolean
  /** 原生 name 属性 */
  name?: string
  /** 原生 form 属性 */
  form?: string
}

interface Emits {
  (e: "update:modelValue", value: string | number | null): void
  (e: "input", value: string | number, event: Event): void
  (e: "change", value: string | number, event: Event): void
  (e: "focus", event: FocusEvent): void
  (e: "blur", event: FocusEvent): void
  (e: "clear"): void
  (e: "keydown", event: KeyboardEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  type: "text",
  size: "medium",
  placeholder: "",
  disabled: false,
  readonly: false,
  modelValue: null,
  required: false,
  iconSize: 16,
  clearable: false,
  showPassword: false,
  showCount: false,
  autofocus: false,
  autocomplete: "off",
})

const emit = defineEmits<Emits>()
const attrs = useAttrs()

const containerAttrs = computed(() => {
  const {
    class: className,
    style,
    ...rest
  } = attrs
  return rest
})

const inputRef = ref<HTMLInputElement | HTMLTextAreaElement>()
const passwordVisible = ref(false)

const isTextarea = computed(() => props.type === "textarea")

const inputType = computed(() => {
  if (props.type === "password" && passwordVisible.value) {
    return "text"
  }
  return props.type
})

const currentLength = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined) {
    return 0
  }
  return String(props.modelValue).length
})

const inputClasses = computed(() => [
  "si-input",
  `si-input--${props.size}`,
  {
    "si-input--disabled": props.disabled,
    "si-input--readonly": props.readonly,
    "si-input--error": props.error,
    "si-input--with-prefix": props.prefixIcon,
    "si-input--with-suffix":
      props.suffixIcon
      || (props.clearable && props.modelValue)
      || (props.showPassword && props.type === "password"),
  },
])

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  const value = target.value
  emit("update:modelValue", value)
  emit("input", value, event)
}

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  emit("change", target.value, event)
}

const handleFocus = (event: FocusEvent) => {
  emit("focus", event)
}

const handleBlur = (event: FocusEvent) => {
  emit("blur", event)
}

const handleKeydown = (event: KeyboardEvent) => {
  emit("keydown", event)
}

const handleClear = () => {
  emit("update:modelValue", "")
  emit("clear")
}

const togglePasswordVisibility = () => {
  passwordVisible.value = !passwordVisible.value
}

const focus = () => {
  nextTick(() => {
    inputRef.value?.focus()
  })
}

const blur = () => {
  nextTick(() => {
    inputRef.value?.blur()
  })
}

const select = () => {
  nextTick(() => {
    inputRef.value?.select()
  })
}

watch(
  () => props.autofocus,
  (newVal) => {
    if (newVal) {
      nextTick(() => {
        inputRef.value?.focus()
      })
    }
  },
  { immediate: true },
)

defineExpose({
  focus,
  blur,
  select,
  inputElement: inputRef,
})
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-input {
  display: inline-flex;
  flex-direction: column;
  position: relative;
  font-family: $font-body;
  width: 100%;

  &__label {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
  }

  &__required {
    color: var(--b3-theme-primary, $brand-orange);
    margin-left: 2px;
  }

  &__wrapper {
    display: flex;
    align-items: center;
    position: relative;
    background: var(--b3-theme-background, $brand-light);
    border: 1px solid var(--b3-border-color, $brand-subtle-gray);
    border-radius: 6px;
    outline: none;

    &:hover:not(.si-input__wrapper--disabled) {
      border-color: var(--b3-theme-secondary, $brand-blue);
    }

    &:focus-within {
      border-color: var(--b3-theme-primary, $brand-orange);
      box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, $brand-orange), 0.1);
    }
  }

  &__field {
    flex: 1;
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-family: $font-body;
    font-size: 14px;
    color: var(--b3-theme-on-background, $brand-dark);
    padding: 8px 12px;

    &::placeholder {
      color: var(--b3-theme-secondary, $brand-mid-gray);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    &:read-only {
      cursor: default;
    }

    &--error {
      border-color: var(--b3-theme-error, $brand-orange) !important;
    }

    &--with-prefix {
      padding-left: 0;
    }

    &--with-suffix {
      padding-right: 0;
    }

    &--textarea {
      resize: vertical;
      min-height: 80px;
      max-height: 200px;
    }
  }

  &__icon {
    flex-shrink: 0;
    color: var(--b3-theme-secondary, $brand-mid-gray);

    &--prefix {
      margin-left: 12px;
    }

    &--suffix {
      margin-right: 12px;
    }
  }

  &__clear,
  &__password-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    margin-right: 8px;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    cursor: pointer;
    border-radius: 4px;

    &:hover {
      color: var(--b3-theme-on-background, $brand-dark);
      background: var(--b3-theme-surface-lighter, $brand-light-gray);
    }
  }

  &__hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--b3-theme-secondary, $brand-mid-gray);

    &--error {
      color: var(--b3-theme-error, $brand-orange);
    }
  }

  &__count {
    position: absolute;
    right: 0;
    bottom: -20px;
    font-size: 12px;
    color: var(--b3-theme-secondary, $brand-mid-gray);
  }

  // 尺寸变体
  &--small {
    .si-input__field {
      padding: 6px 10px;
      font-size: 13px;
      min-height: 28px;
    }

    .si-input__label {
      font-size: 12px;
    }
  }

  &--medium {
    .si-input__field {
      padding: 8px 12px;
      font-size: 14px;
      min-height: 36px;
    }

    .si-input__label {
      font-size: 13px;
    }
  }

  &--large {
    .si-input__field {
      padding: 10px 14px;
      font-size: 15px;
      min-height: 44px;
    }

    .si-input__label {
      font-size: 14px;
    }
  }

  // 状态变体
  &--disabled {
    .si-input__wrapper {
      background: var(--b3-theme-surface, $brand-light-gray);
      cursor: not-allowed;
    }
  }

  &--readonly {
    .si-input__wrapper {
      background: var(--b3-theme-surface-lighter, $brand-light-gray);
    }
  }

  &--error {
    .si-input__wrapper {
      border-color: var(--b3-theme-error, $brand-orange);
    }
  }
}
</style>
