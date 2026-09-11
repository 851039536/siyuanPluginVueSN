<!-- 多行文本域：四档尺寸 / 描边实底 / 自动增高 / 禁用只读 / 校验态 -->
<template>
  <div
    :class="textareaClasses"
    v-bind="containerAttrs"
  >
    <FormField
      :label="label"
      :label-id="labelId"
      :required="required"
      :hint="hint"
      :error="error"
      :size="size"
      :show-count="showCount"
      :show-count-without-max="showCountWithoutMax"
      :count-current="currentLength"
      :count-max="maxlength"
    >
      <div class="si-textarea__wrapper">
        <textarea
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
          :aria-labelledby="labelledBy"
          :aria-label="ariaLabel"
          :aria-invalid="error ? 'true' : undefined"
          class="si-textarea__field"
          :style="fieldStyle"
          @input="handleInput"
          @change="handleChange"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown="handleKeydown"
        />
      </div>
    </FormField>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  ref,
  useAttrs,
  useId,
  watch,
} from "vue"
import FormField from "./FormField.vue"
import { applyAutoResize, clearAutoResize } from "./textarea/autoResize"
import "./kit/theme"

type TextareaSize = "xsmall" | "small" | "medium" | "large"
type TextareaVariant = "outlined" | "filled"
type TextareaResize = "none" | "both" | "horizontal" | "vertical"
type TextareaWrap = "hard" | "soft" | "off"

interface Props {
  /** 绑定值 */
  modelValue?: string | null
  /** 尺寸档位 */
  size?: TextareaSize
  /** 视觉变体：描边（默认）/ 实底 */
  variant?: TextareaVariant
  /** 是否占满容器宽度；关闭时由原生 cols 决定固有宽度 */
  fluid?: boolean
  /** 内容增多时自动增高（不出现滚动条；超过 maxRows 后转为内部滚动） */
  autoResize?: boolean
  /** 自动增高的行数下限（不传时回落到 rows） */
  minRows?: number
  /** 自动增高的行数上限（不传则不设上限，随内容持续增高） */
  maxRows?: number
  /** 可见行数（autoResize 开启时同时作为初始高度与默认下限） */
  rows?: number
  /** 原生列数（仅 fluid 关闭时决定固有宽度） */
  cols?: number
  /** 手动拖拽方向（autoResize 开启时强制为 none） */
  resize?: TextareaResize
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
  /** 错误文本（同时切换校验态样式与 aria-invalid） */
  error?: string
  /** 是否显示字数统计（需配合 maxlength） */
  showCount?: boolean
  /** 字数统计在无 maxlength 时也显示 */
  showCountWithoutMax?: boolean
  /** 最大字符数 */
  maxlength?: number
  /** 最小字符数 */
  minlength?: number
  /** 是否自动聚焦 */
  autofocus?: boolean
  /** 原生 autocomplete */
  autocomplete?: string
  /** 换行方式 */
  wrap?: TextareaWrap
  /** 是否启用拼写检查 */
  spellcheck?: boolean
  /** 原生 inputmode */
  inputmode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search"
  /** 原生 name */
  name?: string
  /** 所属表单 id */
  form?: string
  /** 无可见标签时的无障碍名称 */
  ariaLabel?: string
  /** 外部标签元素 id（有可见 label 时优先关联组件自身生成的标签 id） */
  ariaLabelledby?: string
}

interface Emits {
  (e: "update:modelValue", value: string): void
  (e: "input", value: string, event: Event): void
  (e: "change", value: string, event: Event): void
  (e: "focus", event: FocusEvent): void
  (e: "blur", event: FocusEvent): void
  (e: "keydown", event: KeyboardEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  size: "small",
  variant: "outlined",
  fluid: true,
  autoResize: false,
  rows: 3,
  resize: "vertical",
  placeholder: "",
  disabled: false,
  readonly: false,
  required: false,
  showCount: false,
  showCountWithoutMax: false,
  autofocus: false,
  autocomplete: "off",
  wrap: "soft",
  spellcheck: true,
  inputmode: "text",
})

const emit = defineEmits<Emits>()
const attrs = useAttrs()

/** 剥离 class / style：避免调用方的布局类与组件根类冲突，其余 attrs 透传到根元素 */
const containerAttrs = computed(() => {
  const {
    class: className,
    style,
    ...rest
  } = attrs
  return rest
})

const textareaRef = ref<HTMLTextAreaElement>()

/** 可见标签元素 id（打在 FormField 的 label 上，供文本域的 aria-labelledby 关联） */
const labelId = `${useId()}-label`

/** 无障碍名称关联：外部显式指定优先，其次关联组件自己生成的可见标签 */
const labelledBy = computed(() =>
  props.ariaLabelledby || (props.label ? labelId : undefined),
)

const currentLength = computed(() => props.modelValue?.length ?? 0)

const textareaClasses = computed(() => [
  "si-textarea",
  `si-textarea--${props.size}`,
  `si-textarea--${props.variant}`,
  {
    "si-textarea--fluid": props.fluid,
    "si-textarea--autoresize": props.autoResize,
    "si-textarea--disabled": props.disabled,
    "si-textarea--readonly": props.readonly,
    "si-textarea--error": !!props.error,
  },
])

/**
 * 非 autoResize 时用内联样式承载 resize 档位；autoResize 时交出控制权
 * （由 --autoresize 类固定 resize:none + overflow:hidden），
 * 否则 Vue 重渲染会把手写计算的 overflow-y 覆盖回 hidden。
 */
const fieldStyle = computed<Record<string, string>>(() =>
  props.autoResize ? {} : { resize: props.resize },
)

/** 自动增高：行数下限未显式指定时回落到 rows，上限不传则不设 */
const adjustHeight = () => {
  applyAutoResize(textareaRef.value, {
    minRows: props.minRows ?? props.rows,
    maxRows: props.maxRows,
  })
}

/** 仅在自动增高生效时排一次重测（输入 / 内容变化 / 档位切换 / 首挂载共用一个入口） */
const remeasure = () => {
  if (props.autoResize) {
    nextTick(() => adjustHeight())
  }
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit("update:modelValue", target.value)
  emit("input", target.value, event)
  remeasure()
}

const handleChange = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
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

const focus = () => {
  nextTick(() => textareaRef.value?.focus())
}

const blur = () => {
  nextTick(() => textareaRef.value?.blur())
}

const select = () => {
  nextTick(() => textareaRef.value?.select())
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

/** 内容变化（含父组件回填）后需要重新测量 */
watch(
  () => props.modelValue,
  () => remeasure(),
)

/** 开关自动增高：开启时接管高度，关闭时清除内联高度交还原生 rows */
watch(
  () => props.autoResize,
  (enabled) => {
    if (enabled) {
      remeasure()
      return
    }
    clearAutoResize(textareaRef.value)
  },
)

/** 档位切换会改变字号与行高，需重新测量 */
watch(
  () => props.size,
  () => remeasure(),
)

watch(
  () => props.autofocus,
  (enabled) => {
    if (enabled) {
      focus()
    }
  },
  { immediate: true },
)

onMounted(() => remeasure())

defineExpose({
  focus,
  blur,
  select,
  setRangeText,
  textareaElement: textareaRef,
  adjustHeight,
})
</script>

<style scoped lang="scss">
@use './styles/Textarea.scss';
</style>
