<template>
  <button
    :class="switchClasses"
    :disabled="disabled || loading"
    role="switch"
    :aria-checked="checked"
    :aria-disabled="disabled"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
  >
    <span class="si-switch__track">
      <span v-if="loading" class="si-switch__loading"></span>
      <span v-else class="si-switch__thumb"></span>
    </span>
    <span v-if="label || $slots.default" class="si-switch__label">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, useSlots } from "vue";

type SwitchSize = "small" | "medium" | "large";

interface Props {
	/** 是否选中 */
	modelValue?: boolean;
	/** 标签文本 */
	label?: string;
	/** 开关尺寸 */
	size?: SwitchSize;
	/** 是否禁用 */
	disabled?: boolean;
	/** 是否加载中 */
	loading?: boolean;
	/** 选中时的颜色 */
	activeColor?: string;
	/** 未选中时的颜色 */
	inactiveColor?: string;
	/** 是否显示标签在左侧 */
	labelBefore?: boolean;
}

interface Emits {
	(e: "update:modelValue", value: boolean): void;
	(e: "change", value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
	modelValue: false,
	size: "medium",
	disabled: false,
	loading: false,
	labelBefore: false,
});

const emit = defineEmits<Emits>();
const slots = useSlots();

const checked = computed(() => props.modelValue);

const switchClasses = computed(() => [
	"si-switch",
	`si-switch--${props.size}`,
	{
		"si-switch--checked": checked.value,
		"si-switch--disabled": props.disabled || props.loading,
		"si-switch--loading": props.loading,
		"si-switch--has-label": props.label || slots.default,
		"si-switch--label-before": props.labelBefore,
	},
]);

const handleClick = () => {
	if (!props.disabled && !props.loading) {
		const newValue = !props.modelValue;
		emit("update:modelValue", newValue);
		emit("change", newValue);
	}
};
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-switch {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  font-family: $font-body;
  user-select: none;
  vertical-align: middle;

  &:focus-visible {
    outline: 2px solid var(--b3-theme-primary, $brand-orange);
    outline-offset: 2px;
  }

  // 禁用状态
  &--disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  // 标签在前
  &--label-before {
    flex-direction: row-reverse;
  }

  // 轨道
  &__track {
    position: relative;
    display: inline-block;
    background: var(--b3-theme-surface-lighter, #e5e5e5);
    border-radius: $radius-full;
    transition: $transition-base;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);

    // 尺寸变体
    .si-switch--small & {
      width: 36px;
      height: 20px;
    }

    .si-switch--medium & {
      width: 44px;
      height: 24px;
    }

    .si-switch--large & {
      width: 52px;
      height: 28px;
    }

    // 选中状态
    .si-switch--checked & {
      background: var(--b3-theme-primary, $brand-orange);
    }
  }

  // 滑块
  &__thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    background: white;
    border-radius: $radius-full;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: $transition-base;

    // 尺寸变体
    .si-switch--small & {
      width: 16px;
      height: 16px;
    }

    .si-switch--medium & {
      width: 20px;
      height: 20px;
    }

    .si-switch--large & {
      width: 24px;
      height: 24px;
    }

    // 选中状态 - 滑块位置
    .si-switch--checked.si-switch--small & {
      transform: translateX(16px);
    }

    .si-switch--checked.si-switch--medium & {
      transform: translateX(20px);
    }

    .si-switch--checked.si-switch--large & {
      transform: translateX(24px);
    }
  }

  // 加载动画
  &__loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: $radius-full;

    .si-switch--small & {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
    }

    .si-switch--medium & {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
    }

    .si-switch--large & {
      width: 24px;
      height: 24px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
    }

    .si-switch--checked & {
      animation: spin 0.8s linear infinite;
    }
  }

  // 标签
  &__label {
    font-size: $font-size-sm;
    color: var(--b3-theme-on-background, $brand-dark);
    line-height: 1.5;
  }
}

@keyframes spin {
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
</style>
