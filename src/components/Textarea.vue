<template>
  <div :class="textareaClasses" v-bind="containerAttrs">
    <label v-if="label" class="si-textarea__label">
      {{ label }}
      <span v-if="required" class="si-textarea__required">*</span>
    </label>
    <div class="si-textarea__wrapper" :class="{ 'si-textarea__wrapper--error': error }">
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
        class="si-textarea__field"
        :class="{ 'si-textarea__field--error': error }"
        :style="textareaStyle"
        @input="handleInput"
        @change="handleChange"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <div
        v-if="showClear && clearable && modelValue && !disabled && !readonly"
        class="si-textarea__clear"
        @click="handleClear"
      >
        <IconWrapper :name="'x' as IconKey" :size="iconSize" />
      </div>
      <div
        v-if="showResizeHandle && !disabled && !readonly"
        class="si-textarea__resize-handle"
        @mousedown="startResize"
      />
    </div>
    <div v-if="hint || error" class="si-textarea__hint" :class="{ 'si-textarea__hint--error': error }">
      {{ error || hint }}
    </div>
    <div v-if="showCount && (maxlength || showCountWithoutMax)" class="si-textarea__count">
      {{ currentLength }}<span v-if="maxlength"> / {{ maxlength }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, useAttrs } from "vue";
import IconWrapper from "@/components/IconWrapper.vue";
import type { IconKey } from "@/config/icons";

type TextareaSize = "small" | "medium" | "large";
type TextareaResize = "none" | "both" | "horizontal" | "vertical";
type TextareaWrap = "hard" | "soft" | "off";

interface Props {
	/** 绑定值 */
	modelValue?: string | null;
	/** 尺寸 */
	size?: TextareaSize;
	/** 占位文本 */
	placeholder?: string;
	/** 禁用状态 */
	disabled?: boolean;
	/** 只读状态 */
	readonly?: boolean;
	/** 标签文本 */
	label?: string;
	/** 是否必填 */
	required?: boolean;
	/** 提示文本 */
	hint?: string;
	/** 错误文本 */
	error?: string;
	/** 最大长度 */
	maxlength?: number;
	/** 最小长度 */
	minlength?: number;
	/** 默认行数 */
	rows?: number;
	/** 列数 */
	cols?: number;
	/** 最小行数（自动高度） */
	minRows?: number;
	/** 最大行数（自动高度） */
	maxRows?: number;
	/** 是否自动高度 */
	autosize?: boolean;
	/** 是否可调整大小 */
	resize?: TextareaResize;
	/** 是否显示字符计数 */
	showCount?: boolean;
	/** 无最大长度时是否显示计数 */
	showCountWithoutMax?: boolean;
	/** 是否可清空 */
	clearable?: boolean;
	/** 是否显示清除按钮 */
	showClear?: boolean;
	/** 是否显示调整手柄 */
	showResizeHandle?: boolean;
	/** 图标大小 */
	iconSize?: number;
	/** 是否自动获得焦点 */
	autofocus?: boolean;
	/** 自动完成 */
	autocomplete?: string;
	/** 换行方式 */
	wrap?: TextareaWrap;
	/** 拼写检查 */
	spellcheck?: boolean;
	/** 输入模式 */
	inputmode?:
		| "none"
		| "text"
		| "tel"
		| "url"
		| "email"
		| "numeric"
		| "decimal"
		| "search";
	/** 原生 name 属性 */
	name?: string;
	/** 原生 form 属性 */
	form?: string;
}

interface Emits {
	(e: "update:modelValue", value: string | null): void;
	(e: "input", value: string, event: Event): void;
	(e: "change", value: string, event: Event): void;
	(e: "focus", event: FocusEvent): void;
	(e: "blur", event: Event): void;
	(e: "clear"): void;
	(e: "keydown", event: KeyboardEvent): void;
}

const props = withDefaults(defineProps<Props>(), {
	size: "medium",
	placeholder: "",
	disabled: false,
	readonly: false,
	modelValue: null,
	required: false,
	rows: 3,
	minRows: 1,
	maxRows: 10,
	autosize: false,
	resize: "vertical",
	showCount: false,
	showCountWithoutMax: false,
	clearable: false,
	showClear: false,
	showResizeHandle: false,
	iconSize: 16,
	autofocus: false,
	autocomplete: "off",
	wrap: "soft",
	spellcheck: true,
	inputmode: "text",
});

const emit = defineEmits<Emits>();
const attrs = useAttrs();

const containerAttrs = computed(() => {
	const { class: className, style, ...rest } = attrs;
	return rest;
});

const textareaRef = ref<HTMLTextAreaElement>();
const isResizing = ref(false);
const startY = ref(0);
const startHeight = ref(0);

const currentLength = computed(() => {
	if (props.modelValue === null || props.modelValue === undefined) {
		return 0;
	}
	return String(props.modelValue).length;
});

const textareaClasses = computed(() => [
	"si-textarea",
	`si-textarea--${props.size}`,
	{
		"si-textarea--disabled": props.disabled,
		"si-textarea--readonly": props.readonly,
		"si-textarea--labeled": props.label,
		"si-textarea--error": props.error,
		"si-textarea--autosize": props.autosize,
	},
]);

const textareaStyle = computed(() => {
	const style: Record<string, string> = {};

	if (props.autosize || props.resize === "none") {
		style.resize = "none";
	} else if (props.resize) {
		style.resize = props.resize;
	}

	if (props.autosize) {
		style.overflow = "hidden";
	}

	return style;
});

const adjustHeight = () => {
	if (!props.autosize || !textareaRef.value) return;

	const textarea = textareaRef.value;
	textarea.style.height = "auto";

	const styles = window.getComputedStyle(textarea);
	const paddingTop = parseFloat(styles.paddingTop);
	const paddingBottom = parseFloat(styles.paddingBottom);
	const lineHeight = parseFloat(styles.lineHeight);
	const minHeight = paddingTop + paddingBottom + lineHeight * props.minRows;
	const maxHeight = paddingTop + paddingBottom + lineHeight * props.maxRows;

	let newHeight = textarea.scrollHeight;

	if (newHeight < minHeight) {
		newHeight = minHeight;
	} else if (newHeight > maxHeight) {
		newHeight = maxHeight;
		textarea.style.overflowY = "auto";
	} else {
		textarea.style.overflowY = "hidden";
	}

	textarea.style.height = `${newHeight}px`;
};

const handleInput = (event: Event) => {
	const target = event.target as HTMLTextAreaElement;
	const value = target.value;
	emit("update:modelValue", value);
	emit("input", value, event);

	if (props.autosize) {
		nextTick(() => adjustHeight());
	}
};

const handleChange = (event: Event) => {
	const target = event.target as HTMLTextAreaElement;
	emit("change", target.value, event);
};

const handleFocus = (event: FocusEvent) => {
	emit("focus", event);
};

const handleBlur = (event: FocusEvent) => {
	emit("blur", event);
};

const handleKeydown = (event: KeyboardEvent) => {
	emit("keydown", event);
};

const handleClear = () => {
	emit("update:modelValue", "");
	emit("clear");
};

const startResize = (event: MouseEvent) => {
	if (props.disabled || props.readonly) return;

	isResizing.value = true;
	startY.value = event.clientY;
	startHeight.value = textareaRef.value?.offsetHeight || 0;

	document.addEventListener("mousemove", onResize);
	document.addEventListener("mouseup", stopResize);
	event.preventDefault();
};

const onResize = (event: MouseEvent) => {
	if (!isResizing.value || !textareaRef.value) return;

	const deltaY = event.clientY - startY.value;
	const newHeight = Math.max(startHeight.value + deltaY, 40);

	textareaRef.value.style.height = `${newHeight}px`;
};

const stopResize = () => {
	isResizing.value = false;
	document.removeEventListener("mousemove", onResize);
	document.removeEventListener("mouseup", stopResize);
};

const focus = () => {
	nextTick(() => {
		textareaRef.value?.focus();
	});
};

const blur = () => {
	nextTick(() => {
		textareaRef.value?.blur();
	});
};

const select = () => {
	nextTick(() => {
		textareaRef.value?.select();
	});
};

const setRangeText = (
	replacement: string,
	start: number,
	end: number,
	selectMode: SelectionMode = "select",
) => {
	const textarea = textareaRef.value;
	if (!textarea) return;

	textarea.setRangeText(replacement, start, end, selectMode);
	emit("update:modelValue", textarea.value);
};

// 监听 modelValue 变化
watch(
	() => props.modelValue,
	() => {
		if (props.autosize) {
			nextTick(() => adjustHeight());
		}
	},
);

// 监听 autofocus
watch(
	() => props.autofocus,
	(newVal) => {
		if (newVal) {
			nextTick(() => {
				textareaRef.value?.focus();
			});
		}
	},
);

// 初始化时调整高度
watch(
	() => props.autosize,
	(newVal) => {
		if (newVal) {
			nextTick(() => adjustHeight());
		}
	},
	{ immediate: true },
);

defineExpose({
	focus,
	blur,
	select,
	setRangeText,
	textareaElement: textareaRef,
	adjustHeight,
});
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-textarea {
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
    color: var(--b3-theme-on-background, $brand-dark);
    font-family: $font-heading;
  }

  &__required {
    color: var(--b3-theme-primary, $brand-orange);
    margin-left: 2px;
  }

  &__wrapper {
    position: relative;
    display: flex;
    align-items: stretch;
    background: var(--b3-theme-background, $brand-light);
    border: 1px solid var(--b3-border-color, $brand-subtle-gray);
    border-radius: 6px;
    transition: all 0.2s ease;
    outline: none;

    &:hover:not(.si-textarea__wrapper--disabled) {
      border-color: var(--b3-theme-secondary, $brand-blue);
    }

    &:focus-within {
      border-color: var(--b3-theme-primary, $brand-orange);
      box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 201, 122, 93), 0.1);
    }

    &--error {
      border-color: var(--b3-theme-error, $brand-orange);

      &:focus-within {
        box-shadow: 0 0 0 3px rgba($brand-orange, 0.1);
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
    color: var(--b3-theme-on-background, $brand-dark);
    line-height: 1.6;

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
      border-color: var(--b3-theme-error, $brand-orange);
    }

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--b3-theme-surface-light, $brand-light-gray);
      border-radius: 4px;

      &:hover {
        background: var(--b3-theme-secondary, $brand-mid-gray);
      }
    }
  }

  &__clear {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
    background: var(--b3-theme-background, $brand-light);

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
    border-radius: 4px;
    transition: all 0.2s ease;

    // 使用伪元素创建手柄条纹效果
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
      border-radius: 1px;
      transition: all 0.2s ease;
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
      border-radius: 1px;
      transition: all 0.2s ease;
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

    span {
      color: var(--b3-theme-secondary, $brand-mid-gray);
      opacity: 0.7;
    }
  }

  // 尺寸变体
  &--small {
    .si-textarea__field {
      padding: 6px 10px;
      font-size: 13px;
    }

    .si-textarea__label {
      font-size: 12px;
    }
  }

  &--medium {
    .si-textarea__field {
      padding: 8px 12px;
      font-size: 14px;
    }

    .si-textarea__label {
      font-size: 13px;
    }
  }

  &--large {
    .si-textarea__field {
      padding: 10px 14px;
      font-size: 15px;
    }

    .si-textarea__label {
      font-size: 14px;
    }
  }

  // 状态变体
  &--disabled {
    .si-textarea__wrapper {
      background: var(--b3-theme-surface, $brand-light-gray);
      cursor: not-allowed;
    }
  }

  &--readonly {
    .si-textarea__wrapper {
      background: var(--b3-theme-surface-lighter, $brand-light-gray);
    }
  }

  &--error {
    .si-textarea__wrapper {
      border-color: var(--b3-theme-error, $brand-orange);
    }
  }

  &--labeled {
    width: 100%;
  }

  &--autosize {
    .si-textarea__field {
      overflow: hidden;
    }
  }
}
</style>
