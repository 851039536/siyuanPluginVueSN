<template>
  <div
    :class="inputClasses"
    v-bind="containerAttrs"
  >
    <FormField
      :label="label"
      :required="required"
      :hint="hint"
      :error="error"
      :size="size"
      :show-count="showCount"
      :show-count-without-max="showCountWithoutMax"
      :count-current="currentLength"
      :count-max="maxlength"
    >
      <div
        class="si-input__wrapper"
        :class="{ 'si-input__wrapper--error': error }"
      >
        <IconWrapper
          v-if="prefixIcon && !isTextarea"
          :name="prefixIcon"
          :size="iconSize"
          class="si-input__icon si-input__icon--prefix"
        />
        <textarea
          v-if="isTextarea"
          ref="textareaRef"
          :value="modelValue"
          :placeholder="placeholder"
          :disabled="disabled"
          :readonly="readonly"
          :maxlength="maxlength"
          :minlength="minlength"
          :rows="rows"
          :cols="cols"
          :autofocus="autofocus"
          :autocomplete="autocomplete"
          :wrap="wrap"
          :spellcheck="spellcheck"
          :inputmode="inputmode"
          :name="name"
          :form="form"
          class="si-input__field si-input__field--textarea"
          :style="textareaStyle"
          @input="handleInput"
          @change="handleChange"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown="handleKeydown"
        />
        <input
          v-else
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
          }"
          @input="handleInput"
          @blur="handleBlur"
          @focus="handleFocus"
          @keydown="handleKeydown"
          @change="handleChange"
        />
        <IconWrapper
          v-if="suffixIcon && !isTextarea"
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
        <div
          v-if="isTextarea && showResizeHandle && !disabled && !readonly"
          class="si-input__resize-handle"
          @mousedown="startResize"
        />
      </div>
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
  useAttrs,
  watch,
} from "vue"
import FormField from "@/components/FormField.vue"
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
type InputResize = "none" | "both" | "horizontal" | "vertical"
type InputWrap = "hard" | "soft" | "off"

interface Props {
  modelValue?: string | number | null
  type?: InputType
  size?: InputSize
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  label?: string
  required?: boolean
  hint?: string
  error?: string
  prefixIcon?: IconKey
  suffixIcon?: IconKey
  iconSize?: number
  maxlength?: number
  minlength?: number
  autocomplete?: string
  pattern?: string
  clearable?: boolean
  showPassword?: boolean
  showCount?: boolean
  showCountWithoutMax?: boolean
  autofocus?: boolean
  name?: string
  form?: string
  rows?: number
  cols?: number
  autosize?: boolean
  minRows?: number
  maxRows?: number
  resize?: InputResize
  showResizeHandle?: boolean
  wrap?: InputWrap
  spellcheck?: boolean
  inputmode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search"
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
  showCountWithoutMax: false,
  autofocus: false,
  autocomplete: "off",
  rows: 3,
  autosize: false,
  minRows: 1,
  maxRows: 10,
  resize: "vertical",
  showResizeHandle: false,
  wrap: "soft",
  spellcheck: true,
  inputmode: "text",
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

const inputRef = ref<HTMLInputElement>()
const textareaRef = ref<HTMLTextAreaElement>()
const passwordVisible = ref(false)
const isResizing = ref(false)
const startY = ref(0)
const startHeight = ref(0)

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
    "si-input--textarea": isTextarea.value,
    "si-input--with-prefix": props.prefixIcon && !isTextarea.value,
    "si-input--with-suffix":
      (props.suffixIcon && !isTextarea.value)
      || (props.clearable && props.modelValue)
      || (props.showPassword && props.type === "password"),
  },
])

const textareaStyle = computed(() => {
  const style: Record<string, string> = {}

  if (props.autosize || props.resize === "none") {
    style.resize = "none"
  } else if (props.resize) {
    style.resize = props.resize
  }

  if (props.autosize) {
    style.overflow = "hidden"
  }

  return style
})

const adjustHeight = () => {
  if (!props.autosize || !textareaRef.value) return

  const textarea = textareaRef.value
  textarea.style.height = "auto"

  const styles = window.getComputedStyle(textarea)
  const paddingTop = Number.parseFloat(styles.paddingTop)
  const paddingBottom = Number.parseFloat(styles.paddingBottom)
  const lineHeight = Number.parseFloat(styles.lineHeight)
  const minHeight = paddingTop + paddingBottom + lineHeight * props.minRows
  const maxHeight = paddingTop + paddingBottom + lineHeight * props.maxRows

  let newHeight = textarea.scrollHeight

  if (newHeight < minHeight) {
    newHeight = minHeight
  } else if (newHeight > maxHeight) {
    newHeight = maxHeight
    textarea.style.overflowY = "auto"
  } else {
    textarea.style.overflowY = "hidden"
  }

  textarea.style.height = `${newHeight}px`
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  const value = target.value
  emit("update:modelValue", value)
  emit("input", value, event)

  if (isTextarea.value && props.autosize) {
    nextTick(() => adjustHeight())
  }
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

const startResize = (event: MouseEvent) => {
  if (props.disabled || props.readonly) return

  isResizing.value = true
  startY.value = event.clientY
  startHeight.value = textareaRef.value?.offsetHeight || 0

  document.addEventListener("mousemove", onResize)
  document.addEventListener("mouseup", stopResize)
  event.preventDefault()
}

const onResize = (event: MouseEvent) => {
  if (!isResizing.value || !textareaRef.value) return

  const deltaY = event.clientY - startY.value
  const newHeight = Math.max(startHeight.value + deltaY, 40)

  textareaRef.value.style.height = `${newHeight}px`
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener("mousemove", onResize)
  document.removeEventListener("mouseup", stopResize)
}

const focus = () => {
  nextTick(() => {
    const el = isTextarea.value ? textareaRef.value : inputRef.value
    el?.focus()
  })
}

const blur = () => {
  nextTick(() => {
    const el = isTextarea.value ? textareaRef.value : inputRef.value
    el?.blur()
  })
}

const select = () => {
  nextTick(() => {
    const el = isTextarea.value ? textareaRef.value : inputRef.value
    el?.select()
  })
}

const setRangeText = (
  replacement: string,
  start: number,
  end: number,
  selectMode: SelectionMode = "select",
) => {
  const el = textareaRef.value
  if (!el) return
  el.setRangeText(replacement, start, end, selectMode)
  emit("update:modelValue", el.value)
}

watch(
  () => props.autofocus,
  (newVal) => {
    if (newVal) {
      nextTick(() => focus())
    }
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  () => {
    if (isTextarea.value && props.autosize) {
      nextTick(() => adjustHeight())
    }
  },
)

onMounted(() => {
  if (isTextarea.value && props.autosize) {
    nextTick(() => adjustHeight())
  }
})

defineExpose({
  focus,
  blur,
  select,
  setRangeText,
  inputElement: computed(() => isTextarea.value ? textareaRef.value : inputRef.value),
  adjustHeight,
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

  &__wrapper {
    display: flex;
    align-items: center;
    position: relative;
    background: var(--b3-theme-background, $brand-light);
    border: 1px solid var(--b3-border-color, $brand-subtle-gray);
    border-radius: $vp-radius;
    outline: none;

    &:hover:not(.si-input--disabled .si-input__wrapper) {
      border-color: var(--b3-theme-secondary, $brand-blue);
    }

    &:focus-within {
      border-color: var(--b3-theme-primary, $brand-orange);
      box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, $brand-orange), 0.1);
    }

    &--error {
      border-color: var(--b3-theme-error, $brand-orange) !important;

      &:focus-within {
        box-shadow: 0 0 0 3px rgba(var(--b3-theme-error-rgb, $brand-orange), 0.1);
      }
    }
  }

  &__field {
    flex: 1;
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-family: $font-body;
    font-size: $font-size-sm;
    color: var(--b3-theme-on-background, $brand-dark);
    padding: $spacing-2 $spacing-3;

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
      line-height: 1.6;
      align-items: flex-start;

      &::-webkit-scrollbar {
        width: 8px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background: var(--b3-theme-surface-light, $brand-light-gray);
        border-radius: $radius-sm;

        &:hover {
          background: var(--b3-theme-secondary, $brand-mid-gray);
        }
      }
    }
  }

  &__icon {
    flex-shrink: 0;
    color: var(--b3-theme-secondary, $brand-mid-gray);

    &--prefix {
      margin-left: $spacing-3;
    }

    &--suffix {
      margin-right: $spacing-3;
    }
  }

  &__clear,
  &__password-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-1;
    margin-right: $spacing-2;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    cursor: pointer;
    border-radius: $radius-sm;

    &:hover {
      color: var(--b3-theme-on-background, $brand-dark);
      background: var(--b3-theme-surface-lighter, $brand-light-gray);
    }
  }

  &__resize-handle {
    position: absolute;
    bottom: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    cursor: ns-resize;
    border-radius: $radius-sm;

    &::before {
      content: '';
      position: absolute;
      bottom: 5px;
      right: 5px;
      width: 8px;
      height: 2px;
      background: repeating-linear-gradient(
        to right,
        var(--b3-theme-secondary, $brand-mid-gray) 0px,
        var(--b3-theme-secondary, $brand-mid-gray) 2px,
        transparent 2px,
        transparent 4px
      );
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 8px;
      right: 5px;
      width: 8px;
      height: 2px;
      background: repeating-linear-gradient(
        to right,
        var(--b3-theme-secondary, $brand-mid-gray) 0px,
        var(--b3-theme-secondary, $brand-mid-gray) 2px,
        transparent 2px,
        transparent 4px
      );
    }

    &:hover::before,
    &:hover::after {
      background: repeating-linear-gradient(
        to right,
        var(--b3-theme-primary, $brand-orange) 0px,
        var(--b3-theme-primary, $brand-orange) 2px,
        transparent 2px,
        transparent 4px
      );
    }

    &:hover {
      background: rgba(var(--b3-theme-primary-rgb, 201, 122, 93), 0.1);
    }

    &:active::before,
    &:active::after {
      background: var(--b3-theme-primary, $brand-orange);
    }
  }

  &--small {
    .si-input__field {
      padding: $spacing-1 $spacing-2;
      font-size: $font-size-xs;
      min-height: 28px;
    }
  }

  &--medium {
    .si-input__field {
      padding: $spacing-2 $spacing-3;
      font-size: $font-size-sm;
      min-height: 36px;
    }
  }

  &--large {
    .si-input__field {
      padding: $spacing-3 $spacing-4;
      font-size: 15px;
      min-height: 44px;
    }
  }

  &--textarea {
    .si-input__wrapper {
      align-items: stretch;
    }
  }

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
